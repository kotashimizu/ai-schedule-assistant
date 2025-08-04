'use client';

import { useAuth } from '@/lib/auth/context';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            AI Schedule Assistant
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI駆動のスケジュール管理・タスク管理アシスタント
          </p>
          
          {user ? (
            <div className="space-y-4">
              <p className="text-lg text-green-600 font-medium">
                ようこそ、{user.email}さん！
              </p>
              <div className="flex justify-center space-x-4">
                <Link
                  href="/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                >
                  ダッシュボードへ
                </Link>
                <Link
                  href="/test-supabase"
                  className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                >
                  接続テスト
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-lg text-gray-600">
                開始するにはログインが必要です
              </p>
              <Link
                href="/auth/login"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
              >
                ログイン / 新規登録
              </Link>
            </div>
          )}
        </div>

        {/* 機能紹介 */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">スケジュール管理</h3>
            <p className="text-gray-600">Google Calendarと連携したスマートなスケジュール管理</p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">タスク管理</h3>
            <p className="text-gray-600">優先度と期限を考慮したインテリジェントなタスク管理</p>
          </div>

          <div className="text-center p-6 bg-white rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI提案</h3>
            <p className="text-gray-600">AIがスケジュールを分析して最適な提案を提供</p>
          </div>
        </div>

        {/* 開発状況 */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">開発状況</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-green-600 mb-4">✅ 完了済み</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Next.js 14 プロジェクトセットアップ</li>
                <li>• Supabase統合とデータベース設計</li>
                <li>• 認証システムの基本実装</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-600 mb-4">🚧 予定</h3>
              <ul className="space-y-2 text-gray-600">
                <li>• Google Calendar統合機能</li>
                <li>• AI提案機能の実装</li>
                <li>• 通知システム</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}