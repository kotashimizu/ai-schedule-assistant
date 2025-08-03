'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestSupabasePage() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'success' | 'error'>('testing');
  const [error, setError] = useState<string | null>(null);
  const [tables, setTables] = useState<string[]>([]);

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      setConnectionStatus('testing');
      setError(null);

      // 1. 基本接続テスト
      const { data: connectionTest, error: connectionError } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true });

      if (connectionError) {
        throw new Error(`接続エラー: ${connectionError.message}`);
      }

      // 2. テーブル存在確認
      const tableQueries = [
        'users',
        'events', 
        'tasks',
        'notifications',
        'analytics_logs'
      ];

      const tableChecks = await Promise.all(
        tableQueries.map(async (table) => {
          const { error } = await supabase
            .from(table)
            .select('count', { count: 'exact', head: true });
          return error ? null : table;
        })
      );

      const existingTables = tableChecks.filter(Boolean) as string[];
      setTables(existingTables);

      if (existingTables.length === 5) {
        setConnectionStatus('success');
      } else {
        throw new Error(`不足テーブル: ${5 - existingTables.length}個のテーブルが見つかりません`);
      }

    } catch (err) {
      setConnectionStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            🧪 Supabase接続テスト
          </h1>

          <div className="space-y-6">
            {/* 接続ステータス */}
            <div className="border rounded-lg p-4">
              <h2 className="text-lg font-semibold mb-3">接続ステータス</h2>
              <div className="flex items-center space-x-3">
                {connectionStatus === 'testing' && (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-blue-600">接続テスト中...</span>
                  </>
                )}
                {connectionStatus === 'success' && (
                  <>
                    <div className="h-5 w-5 bg-green-500 rounded-full"></div>
                    <span className="text-green-600 font-medium">✅ 接続成功！</span>
                  </>
                )}
                {connectionStatus === 'error' && (
                  <>
                    <div className="h-5 w-5 bg-red-500 rounded-full"></div>
                    <span className="text-red-600 font-medium">❌ 接続失敗</span>
                  </>
                )}
              </div>
            </div>

            {/* エラー情報 */}
            {error && (
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <h3 className="text-red-800 font-semibold mb-2">エラー詳細:</h3>
                <p className="text-red-700 text-sm font-mono">{error}</p>
                <div className="mt-4 text-sm text-red-600">
                  <p><strong>確認事項:</strong></p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>.env.localファイルのSupabase設定</li>
                    <li>NEXT_PUBLIC_SUPABASE_URLの値</li>
                    <li>NEXT_PUBLIC_SUPABASE_ANON_KEYの値</li>
                    <li>データベーススキーマの実行</li>
                  </ul>
                </div>
              </div>
            )}

            {/* テーブル情報 */}
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-3">データベーステーブル</h3>
              <div className="grid grid-cols-1 gap-2">
                {['users', 'events', 'tasks', 'notifications', 'analytics_logs'].map((table) => (
                  <div key={table} className="flex items-center space-x-3">
                    {tables.includes(table) ? (
                      <span className="text-green-600">✅</span>
                    ) : (
                      <span className="text-red-600">❌</span>
                    )}
                    <span className="font-mono text-sm">{table}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600 mt-3">
                検出済み: {tables.length}/5 テーブル
              </p>
            </div>

            {/* 再テストボタン */}
            <button
              onClick={testConnection}
              disabled={connectionStatus === 'testing'}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {connectionStatus === 'testing' ? '接続テスト中...' : '🔄 再テスト'}
            </button>

            {/* 成功時のメッセージ */}
            {connectionStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-green-800 font-semibold mb-2">🎉 セットアップ完了！</h3>
                <p className="text-green-700 text-sm">
                  Supabase統合が正常に動作しています。
                  <br />
                  次のステップ: <strong>1.3 認証システムの基本実装</strong> に進んでください。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}