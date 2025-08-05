import { NextResponse } from 'next/server';
import { googleCalendar } from '@/lib/google/calendar';

/**
 * Google OAuth2認証開始
 * GET /api/auth/google
 */
export async function GET() {
  try {
    // Google認証URLを生成
    const authUrl = googleCalendar.getAuthUrl();
    
    // 認証ページにリダイレクト
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Google認証開始エラー:', error);
    
    return NextResponse.json(
      { error: 'Google認証の開始に失敗しました' },
      { status: 500 }
    );
  }
}