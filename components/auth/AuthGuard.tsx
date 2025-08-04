'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth/context';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

// 認証が必要なページ・コンポーネントを保護するガード
export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading } = useAuth();

  // ローディング中の表示
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">認証状態を確認中...</span>
      </div>
    );
  }

  // 未認証の場合のフォールバック表示
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        {fallback || (
          <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
            <div className="mb-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              認証が必要です
            </h2>
            <p className="text-gray-600 mb-6">
              このページにアクセスするにはログインが必要です。
            </p>
            <a
              href="/auth/login"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              ログインページへ
            </a>
          </div>
        )}
      </div>
    );
  }

  // 認証済みの場合は子コンポーネントを表示
  return <>{children}</>;
}