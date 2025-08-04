'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';

interface GoogleCalendarConnectionProps {
  onConnectionChange?: (connected: boolean) => void;
}

export function GoogleCalendarConnection({ onConnectionChange }: GoogleCalendarConnectionProps) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Google Calendar連携状態確認
  useEffect(() => {
    checkConnectionStatus();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkConnectionStatus = async () => {
    if (!user) return;

    try {
      // ユーザー情報からGoogle認証状態を確認
      const response = await fetch(`/api/user/google-status`);
      if (response.ok) {
        const data = await response.json();
        const connected = !!data.hasGoogleAuth;
        setIsConnected(connected);
        onConnectionChange?.(connected);
      }
    } catch (error) {
      console.error('Google Calendar連携状態確認エラー:', error);
      setIsConnected(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      // Google認証開始
      window.location.href = '/api/auth/google';
    } catch {
      setError('Google Calendar連携の開始に失敗しました');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const response = await fetch('/api/auth/google/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setIsConnected(false);
        onConnectionChange?.(false);
      } else {
        throw new Error('連携解除に失敗しました');
      }
    } catch {
      setError('Google Calendar連携の解除に失敗しました');
    } finally {
      setIsConnecting(false);
    }
  };

  // ローディング状態
  if (isConnected === null) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Google Calendar連携状態を確認中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.5 3H4.5C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3zM8 7h8v2H8V7zm0 4h8v2H8v-2zm0 4h5v2H8v-2z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Google Calendar</h3>
            <p className="text-sm text-gray-600">
              {isConnected ? 'カレンダーと同期中' : 'カレンダー連携を有効にする'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* 連携状態表示 */}
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isConnected ? '連携済み' : '未連携'}
          </span>

          {/* 連携ボタン */}
          {isConnected ? (
            <button
              onClick={handleDisconnect}
              disabled={isConnecting}
              className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {isConnecting ? '解除中...' : '連携解除'}
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              {isConnecting ? '連携中...' : 'Google連携'}
            </button>
          )}
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* 連携済み時の機能説明 */}
      {isConnected && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
          <h4 className="text-sm font-medium text-green-800 mb-2">利用可能な機能:</h4>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Google Calendarのイベント表示</li>
            <li>• 新しいイベントの作成・同期</li>
            <li>• イベントの自動インポート</li>
          </ul>
        </div>
      )}

      {/* 未連携時の説明 */}
      {!isConnected && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <h4 className="text-sm font-medium text-blue-800 mb-2">Google Calendar連携の利点:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• 既存のカレンダーとの同期</li>
            <li>• イベントの一元管理</li>
            <li>• AIによるスケジュール最適化</li>
          </ul>
        </div>
      )}
    </div>
  );
}