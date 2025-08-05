import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

/**
 * Google Calendar連携解除
 * POST /api/auth/google/disconnect
 */
export async function POST() {
  try {
    // 現在のユーザーセッション確認
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザーのGoogle認証情報を削除
    const { error: updateError } = await supabase
      .from('users')
      .update({
        google_refresh_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    if (updateError) {
      console.error('Google認証情報削除エラー:', updateError);
      return NextResponse.json(
        { error: 'Google連携の解除に失敗しました' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Google Calendar連携を解除しました',
    });

  } catch (error) {
    console.error('Google連携解除エラー:', error);
    
    return NextResponse.json(
      { error: 'Google連携の解除に失敗しました' },
      { status: 500 }
    );
  }
}