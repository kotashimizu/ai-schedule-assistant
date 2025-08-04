import { NextRequest, NextResponse } from 'next/server';
import { createUserCalendarClient } from '@/lib/google/calendar';
import { supabase } from '@/lib/supabase/client';

/**
 * Google Calendarイベント取得
 * GET /api/calendar/events
 */
export async function GET(request: NextRequest) {
  try {
    // 現在のユーザーセッション確認
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザーのGoogle認証情報を取得
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('google_refresh_token')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData?.google_refresh_token) {
      return NextResponse.json(
        { error: 'Google Calendarが連携されていません' },
        { status: 400 }
      );
    }

    // クエリパラメータ
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const maxResults = parseInt(searchParams.get('maxResults') || '10');

    // Google Calendar APIクライアント作成
    const calendarClient = createUserCalendarClient('', userData.google_refresh_token);

    // イベント取得
    const events = await calendarClient.getEvents(startDate || undefined, endDate || undefined, maxResults);

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });

  } catch (error) {
    console.error('Google Calendarイベント取得エラー:', error);
    
    return NextResponse.json(
      { error: 'カレンダーイベントの取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * Google Calendarイベント作成
 * POST /api/calendar/events
 */
export async function POST(request: NextRequest) {
  try {
    // 現在のユーザーセッション確認
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザーのGoogle認証情報を取得
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('google_refresh_token')
      .eq('id', session.user.id)
      .single();

    if (userError || !userData?.google_refresh_token) {
      return NextResponse.json(
        { error: 'Google Calendarが連携されていません' },
        { status: 400 }
      );
    }

    // リクエストボディ
    const body = await request.json();
    const { title, description, startTime, endTime, location } = body;

    // 必須項目チェック
    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'タイトル、開始時間、終了時間は必須です' },
        { status: 400 }
      );
    }

    // Google Calendar APIクライアント作成
    const calendarClient = createUserCalendarClient('', userData.google_refresh_token);

    // イベント作成
    const createdEvent = await calendarClient.createEvent({
      title,
      description,
      startTime,
      endTime,
      location,
    });

    return NextResponse.json({
      success: true,
      event: createdEvent,
    });

  } catch (error) {
    console.error('Google Calendarイベント作成エラー:', error);
    
    return NextResponse.json(
      { error: 'カレンダーイベントの作成に失敗しました' },
      { status: 500 }
    );
  }
}