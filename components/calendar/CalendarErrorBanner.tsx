'use client';

import React from 'react';
import { CalendarError } from '@/lib/services/calendarErrorHandler';

interface CalendarErrorBannerProps {
  error: CalendarError;
  isOffline?: boolean;
  usingCachedData?: boolean;
  lastSynced?: Date | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  recoverySteps?: string[];
}

/**
 * カレンダー同期エラーを表示するバナーコンポーネント
 * ユーザーフレンドリーなエラーメッセージと回復手順を表示
 */
export function CalendarErrorBanner({
  error,
  isOffline = false,
  usingCachedData = false,
  lastSynced,
  onRetry,
  onDismiss,
  recoverySteps = [],
}: CalendarErrorBannerProps) {
  const getErrorSeverity = (errorCode: string) => {
    switch (errorCode) {
      case 'NETWORK_ERROR':
        return isOffline ? 'warning' : 'error';
      case 'AUTH_ERROR':
      case 'TOKEN_EXPIRED':
        return 'warning';
      case 'RATE_LIMIT':
        return 'info';
      case 'NO_CALENDAR':
        return 'warning';
      case 'SERVER_ERROR':
      case 'DATABASE_ERROR':
        return 'error';
      default:
        return 'error';
    }
  };

  const severity = getErrorSeverity(error.code);
  
  const getBackgroundColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'bg-red-50 border-red-200';
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'info': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getIconColor = (severity: string) => {
    switch (severity) {
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'info': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatLastSynced = (date: Date | null | undefined) => {
    if (!date) return 'まだ同期されていません';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}時間前`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}日前`;
  };

  return (
    <div className={`rounded-lg border p-4 mb-4 ${getBackgroundColor(severity)}`}>
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 ${getIconColor(severity)}`}>
          {getIcon(severity)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">
              {isOffline ? 'オフラインモード' : 'カレンダー同期エラー'}
            </h3>
            
            <div className="ml-auto flex items-center space-x-2">
              {error.recoverable && onRetry && (
                <button
                  onClick={onRetry}
                  className="text-sm font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:underline"
                >
                  再試行
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <span className="sr-only">閉じる</span>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <p className="mt-1 text-sm text-gray-700">
            {error.userMessage}
          </p>
          
          {usingCachedData && (
            <div className="mt-2 flex items-center text-xs text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1V8zm8 4a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              保存されたデータを表示中（最終同期: {formatLastSynced(lastSynced)}）
            </div>
          )}
          
          {isOffline && (
            <div className="mt-2 flex items-center text-xs text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 000 2h11.586l-4.293 4.293a1 1 0 101.414 1.414L16 7.414V19a1 1 0 102 0V7.414l4.293 4.293a1 1 0 001.414-1.414L19.414 6H18V4a1 1 0 10-2 0v2H4z" clipRule="evenodd" />
              </svg>
              オフライン - インターネット接続を確認してください
            </div>
          )}
          
          {recoverySteps.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-gray-700 mb-1">解決方法:</p>
              <ul className="text-xs text-gray-600 space-y-1">
                {recoverySteps.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <span className="inline-block w-4 h-4 text-center text-xs font-medium text-gray-400 mr-2">
                      {index + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
