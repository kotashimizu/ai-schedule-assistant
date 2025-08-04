import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

/**
 * ユーザーのGoogle認証状態確認
 * GET /api/user/google-status
 */
export async function GET() {
  try {
    // 現在のユーザーセッション確認
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザーのGoogle認証情報を確認
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('google_refresh_token')
      .eq('id', session.user.id)
      .single();

    if (userError) {
      console.error('ユーザー情報取得エラー:', userError);
      return NextResponse.json(
        { error: 'ユーザー情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // Google認証状態を返す
    return NextResponse.json({
      hasGoogleAuth: !!userData?.google_refresh_token,
      userId: session.user.id,
    });

  } catch (error) {
    console.error('Google認証状態確認エラー:', error);
    
    return NextResponse.json(
      { error: 'Google認証状態の確認に失敗しました' },
      { status: 500 }
    );
  }
}