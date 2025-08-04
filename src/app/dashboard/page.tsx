'use client';

import { AuthGuard } from '@/components/auth/AuthGuard';
import { useAuth } from '@/lib/auth/context';

export default function DashboardPage() {
  const { user, signOut } = useAuth();

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
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <h1 className="text-3xl font-bold text-gray-900">
                ダッシュボード
              </h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  ようこそ、{user?.email}さん
                </span>
                <button
                  onClick={handleSignOut}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* メインコンテンツ */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 認証状態確認カード */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          認証状態
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          ログイン済み
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* ユーザー情報カード */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          ユーザーID
                        </dt>
                        <dd className="text-lg font-medium text-gray-900 truncate">
                          {user?.id?.substring(0, 8)}...
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* テストページリンク */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          テスト
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          <a 
                            href="/test-supabase" 
                            className="text-blue-600 hover:text-blue-500"
                          >
                            DB接続テスト
                          </a>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 開発用デバッグ情報 */}
            <div className="mt-8 bg-gray-100 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">🛠️ 開発用デバッグ情報</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>ユーザー情報:</strong>
                  <pre className="mt-2 bg-white p-3 rounded border text-xs overflow-auto">
                    {JSON.stringify({
                      id: user?.id,
                      email: user?.email,
                      created_at: user?.created_at,
                    }, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>認証状態:</strong>
                  <ul className="mt-2 space-y-1">
                    <li>✅ 認証済み</li>
                    <li>✅ JWT トークン有効</li>
                    <li>✅ セッション維持中</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}