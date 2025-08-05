'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/lib/auth/context';
import { useCalendarSync } from '@/lib/hooks/useCalendarSync';
import { MetricsCards } from '@/components/dashboard/MetricsCards';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { ScheduleTimeline } from '@/components/dashboard/ScheduleTimeline';
import { AISuggestionCard } from '@/components/dashboard/AISuggestionCard';

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  
  // カレンダー同期フック
  const {
    events: todayEvents,
    isLoading: syncLoading,
    error: syncError,
    lastSynced,
    isConnected: calendarConnected,
    syncTodayEvents,
  } = useCalendarSync({
    autoSync: true,
    syncInterval: 5, // 5分間隔
    onSyncSuccess: (events) => {
      console.log(`${events.length}件のイベントを同期しました`);
    },
    onSyncError: (error) => {
      console.error('同期エラー:', error);
    },
  });

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('ログアウトエラー:', error);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* ヘッダー */}
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  AI Schedule Assistant
                </h1>
                {/* リアルタイム同期ステータス */}
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${calendarConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span className="text-sm text-gray-600">
                    {syncLoading ? '同期中...' : calendarConnected ? 'オンライン' : 'オフライン'}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {lastSynced && (
                  <span className="text-xs text-gray-500">
                    最終同期: {lastSynced.toLocaleTimeString('ja-JP')}
                  </span>
                )}
                <span className="text-sm text-gray-700">
                  {user?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 sm:px-0">
            {/* エラー表示 */}
            {syncError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">同期エラー</h3>
                    <p className="mt-1 text-sm text-red-700">{syncError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* メトリクスカード */}
            <MetricsCards className="mb-8" />

            {/* 3カラムレイアウト */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* メインコンテンツ（左側2カラム） */}
              <div className="lg:col-span-3 space-y-6">
                {/* AI提案カード */}
                <AISuggestionCard />
              </div>

              {/* サイドバー（右側1カラム） */}
              <div className="space-y-6">
                {/* カレンダーウィジェット - スティッキーポジション対応 */}
                <CalendarWidget sticky={true} />
                
                {/* スケジュールタイムライン */}
                <ScheduleTimeline />
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}