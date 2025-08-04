'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleCalendarEvent } from '@/types/shared';
import { calendarOfflineManager } from '@/lib/services/calendarOfflineManager';
import { CalendarErrorHandler, CalendarError } from '@/lib/services/calendarErrorHandler';

interface CalendarSyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // minutes
  onSyncSuccess?: (events: GoogleCalendarEvent[]) => void;
  onSyncError?: (error: string) => void;
}

interface CalendarSyncState {
  events: GoogleCalendarEvent[];
  isLoading: boolean;
  error: CalendarError | null;
  lastSynced: Date | null;
  isConnected: boolean;
  isOffline: boolean;
  usingCachedData: boolean;
  retryCount: number;
}

/**
 * Google Calendarの自動同期を管理するカスタムフック
 * 5分間隔での自動同期とリアルタイム状態管理を提供
 */
export function useCalendarSync({
  autoSync = true,
  syncInterval = 5, // 5分間隔
  onSyncSuccess,
  onSyncError,
}: CalendarSyncOptions = {}) {
  const [state, setState] = useState<CalendarSyncState>({
    events: [],
    isLoading: false,
    error: null,
    lastSynced: null,
    isConnected: false,
    isOffline: false,
    usingCachedData: false,
    retryCount: 0,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);

  // コンポーネントのマウント状態を追跡
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  // Google Calendar連携状態確認
  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/user/google-status');
      if (response.ok) {
        const data = await response.json();
        const connected = !!data.hasGoogleAuth;
        
        if (!isUnmountedRef.current) {
          setState(prev => ({ ...prev, isConnected: connected }));
        }
        
        return connected;
      }
      return false;
    } catch (error) {
      console.error('Google Calendar連携状態確認エラー:', error);
      return false;
    }
  }, []);

  // オフライン状態監視
  useEffect(() => {
    const updateOnlineStatus = () => {
      const isOffline = !navigator.onLine;
      setState(prev => ({ ...prev, isOffline }));
      
      if (!isOffline && state.error?.code === 'NETWORK_ERROR') {
        // オンライン復帰時、ネットワークエラーがあれば同期を再試行
        setTimeout(() => syncEvents(), 1000);
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // 初期状態設定

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // 手動同期実行（オフライン対応 + エラーハンドリング強化）
  const syncEvents = useCallback(async (options?: {
    todayOnly?: boolean;
    startDate?: string;
    endDate?: string;
    forceOnline?: boolean;
  }) => {
    if (isUnmountedRef.current) return null;

    const isOffline = !navigator.onLine;
    
    // オフライン時はキャッシュからデータを取得
    if (isOffline && !options?.forceOnline) {
      try {
        const cachedEvents = options?.todayOnly 
          ? await calendarOfflineManager.getTodayCachedEvents()
          : await calendarOfflineManager.getCachedEvents(options?.startDate, options?.endDate);
        
        const lastSyncTime = await calendarOfflineManager.getLastSyncTime();
        
        setState(prev => ({
          ...prev,
          events: cachedEvents,
          isLoading: false,
          error: null,
          lastSynced: lastSyncTime,
          isOffline: true,
          usingCachedData: true,
        }));
        
        return cachedEvents;
      } catch (cacheError) {
        const error = CalendarErrorHandler.handleError(cacheError);
        CalendarErrorHandler.logError(error, 'cache_read');
        
        setState(prev => ({
          ...prev,
          isLoading: false,
          error,
          isOffline: true,
          usingCachedData: false,
        }));
        
        return null;
      }
    }

    // オンライン同期処理
    let retryCount = state.retryCount;
    
    const performSync = async (): Promise<GoogleCalendarEvent[] | null> => {
      try {
        setState(prev => ({ 
          ...prev, 
          isLoading: true, 
          error: null,
          isOffline: false,
          usingCachedData: false,
          retryCount,
        }));

        // 連携状態確認
        const connected = await checkConnectionStatus();
        if (!connected) {
          const error = CalendarErrorHandler.handleError(new Error('Google Calendar連携が必要です'));
          CalendarErrorHandler.logError(error, 'connection_check');
          
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            error,
            isConnected: false,
            retryCount: 0,
          }));
          
          onSyncError?.(error.userMessage);
          return null;
        }

        // イベント取得
        const params = new URLSearchParams();
        if (options?.todayOnly) params.append('todayOnly', 'true');
        if (options?.startDate) params.append('start', options.startDate);
        if (options?.endDate) params.append('end', options.endDate);
        params.append('maxResults', '50');

        const response = await fetch(`/api/calendar/events?${params}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'イベント同期に失敗しました');
        }

        const data = await response.json();
        
        if (data.success && !isUnmountedRef.current) {
          // 成功時はキャッシュに保存
          await calendarOfflineManager.cacheEvents(data.events);
          
          // 同期キューを処理
          await calendarOfflineManager.processSyncQueue();
          
          const newState = {
            events: data.events,
            isLoading: false,
            error: null,
            lastSynced: new Date(),
            isConnected: true,
            isOffline: false,
            usingCachedData: false,
            retryCount: 0,
          };
          
          setState(prev => ({ ...prev, ...newState }));
          onSyncSuccess?.(data.events);
          
          return data.events;
        }
        
        return null;
      } catch (syncError) {
        const error = CalendarErrorHandler.handleError(syncError);
        CalendarErrorHandler.logError(error, 'sync_events');
        
        // リトライ戦略を決定
        const retryStrategy = CalendarErrorHandler.getRetryStrategy(error, retryCount);
        
        if (retryStrategy.shouldRetry) {
          retryCount++;
          
          // 指定時間後にリトライ
          setTimeout(() => {
            if (!isUnmountedRef.current) {
              performSync();
            }
          }, retryStrategy.delayMs);
          
          setState(prev => ({
            ...prev,
            isLoading: true,
            error,
            retryCount,
          }));
          
          return null;
        } else {
          // リトライ不可能、またはリトライ回数上限に達した場合
          
          // キャッシュからデータを取得してフォールバック
          try {
            const cachedEvents = options?.todayOnly 
              ? await calendarOfflineManager.getTodayCachedEvents()
              : await calendarOfflineManager.getCachedEvents(options?.startDate, options?.endDate);
            
            const lastSyncTime = await calendarOfflineManager.getLastSyncTime();
            
            setState(prev => ({
              ...prev,
              events: cachedEvents,
              isLoading: false,
              error,
              lastSynced: lastSyncTime,
              usingCachedData: true,
              retryCount: 0,
            }));
            
            onSyncError?.(error.userMessage);
            return cachedEvents;
          } catch (cacheError) {
            setState(prev => ({
              ...prev,
              isLoading: false,
              error,
              usingCachedData: false,
              retryCount: 0,
            }));
            
            onSyncError?.(error.userMessage);
            return null;
          }
        }
      }
    };

    return performSync();
  }, [checkConnectionStatus, onSyncSuccess, onSyncError, state.retryCount]);

  // 今日のイベント取得
  const syncTodayEvents = useCallback(() => {
    return syncEvents({ todayOnly: true });
  }, [syncEvents]);

  // 月間イベント取得
  const syncMonthEvents = useCallback((year: number, month: number) => {
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    
    return syncEvents({ startDate, endDate });
  }, [syncEvents]);

  // 自動同期の開始・停止
  const startAutoSync = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 初回同期
    syncTodayEvents();

    // 5分間隔で自動同期
    intervalRef.current = setInterval(() => {
      if (!isUnmountedRef.current) {
        syncTodayEvents();
      }
    }, syncInterval * 60 * 1000);
  }, [syncTodayEvents, syncInterval]);

  const stopAutoSync = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 自動同期の制御
  useEffect(() => {
    if (autoSync) {
      startAutoSync();
    } else {
      stopAutoSync();
    }

    return () => {
      stopAutoSync();
    };
  }, [autoSync, startAutoSync, stopAutoSync]);

  // 初回連携状態確認
  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  // エラー回復機能
  const retrySync = useCallback(() => {
    setState(prev => ({ ...prev, error: null, retryCount: 0 }));
    syncTodayEvents();
  }, [syncTodayEvents]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null, retryCount: 0 }));
  }, []);

  // キャッシュクリア機能
  const clearCache = useCallback(async () => {
    try {
      await calendarOfflineManager.clearCache();
      setState(prev => ({ 
        ...prev, 
        events: [], 
        usingCachedData: false,
        lastSynced: null 
      }));
    } catch (error) {
      console.error('キャッシュクリアエラー:', error);
    }
  }, []);

  return {
    // 状態
    events: state.events,
    isLoading: state.isLoading,
    error: state.error,
    lastSynced: state.lastSynced,
    isConnected: state.isConnected,
    isOffline: state.isOffline,
    usingCachedData: state.usingCachedData,
    retryCount: state.retryCount,
    
    // 手動操作
    syncEvents,
    syncTodayEvents,
    syncMonthEvents,
    
    // 自動同期制御
    startAutoSync,
    stopAutoSync,
    
    // 連携状態管理
    checkConnectionStatus,
    
    // エラー回復機能
    retrySync,
    clearError,
    clearCache,
    
    // エラー情報取得
    getRecoverySteps: () => state.error ? CalendarErrorHandler.getRecoverySteps(state.error) : [],
    getErrorLogs: CalendarErrorHandler.getErrorLogs,
    clearErrorLogs: CalendarErrorHandler.clearErrorLogs,
  };
}