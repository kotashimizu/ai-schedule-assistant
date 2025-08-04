'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleCalendarEvent } from '@/types/shared';

interface CalendarSyncOptions {
  autoSync?: boolean;
  syncInterval?: number; // minutes
  onSyncSuccess?: (events: GoogleCalendarEvent[]) => void;
  onSyncError?: (error: string) => void;
}

interface CalendarSyncState {
  events: GoogleCalendarEvent[];
  isLoading: boolean;
  error: string | null;
  lastSynced: Date | null;
  isConnected: boolean;
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

  // 手動同期実行
  const syncEvents = useCallback(async (options?: {
    todayOnly?: boolean;
    startDate?: string;
    endDate?: string;
  }) => {
    if (isUnmountedRef.current) return null;

    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // 連携状態確認
      const connected = await checkConnectionStatus();
      if (!connected) {
        const errorMsg = 'Google Calendar連携が必要です';
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: errorMsg,
          isConnected: false 
        }));
        onSyncError?.(errorMsg);
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
        const newState = {
          events: data.events,
          isLoading: false,
          error: null,
          lastSynced: new Date(),
          isConnected: true,
        };
        
        setState(prev => ({ ...prev, ...newState }));
        onSyncSuccess?.(data.events);
        
        return data.events;
      }
      
      return null;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '同期エラーが発生しました';
      
      if (!isUnmountedRef.current) {
        setState(prev => ({ ...prev, isLoading: false, error: errorMsg }));
      }
      
      onSyncError?.(errorMsg);
      console.error('Calendar sync error:', error);
      return null;
    }
  }, [checkConnectionStatus, onSyncSuccess, onSyncError]);

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

  return {
    // 状態
    events: state.events,
    isLoading: state.isLoading,
    error: state.error,
    lastSynced: state.lastSynced,
    isConnected: state.isConnected,
    
    // 手動操作
    syncEvents,
    syncTodayEvents,
    syncMonthEvents,
    
    // 自動同期制御
    startAutoSync,
    stopAutoSync,
    
    // 連携状態管理
    checkConnectionStatus,
  };
}