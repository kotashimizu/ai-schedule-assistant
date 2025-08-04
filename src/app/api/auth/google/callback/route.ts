import { NextRequest, NextResponse } from 'next/server';
import { googleCalendar } from '@/lib/google/calendar';
import { supabase } from '@/lib/supabase/client';

/**
 * Google OAuth2認証コールバック
 * GET /api/auth/google/callback
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // エラーレスポンスの場合
    if (error) {
      console.error('Google認証エラー:', error);
      return NextResponse.redirect(
        new URL('/dashboard?error=google_auth_denied', request.url)
      );
    }

    // 認証コードが無い場合
    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard?error=google_auth_failed', request.url)
      );
    }

    // 認証コードからトークンを取得
    const tokens = await googleCalendar.getTokenFromCode(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('トークン取得に失敗しました');
    }

    // Supabaseの現在のユーザーを取得
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.redirect(
        new URL('/auth/login?error=not_authenticated', request.url)
      );
    }

    // ユーザーのGoogle認証情報をSupabaseに保存
    const { error: updateError } = await supabase
      .from('users')
      .update({
        google_refresh_token: tokens.refresh_token,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Google認証情報保存エラー:', updateError);
      throw new Error('認証情報の保存に失敗しました');
    }

    // 成功時はダッシュボードにリダイレクト
    return NextResponse.redirect(
      new URL('/dashboard?success=google_connected', request.url)
    );

  } catch (error) {
    console.error('Google認証コールバックエラー:', error);
    
    return NextResponse.redirect(
      new URL('/dashboard?error=google_auth_failed', request.url)
    );
  }
}