import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createUserCalendarClient } from '@/lib/google/calendar';

/**
 * 手動同期トリガーAPI
 * POST /api/calendar/sync
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Authorization ヘッダーからトークンを取得
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { force = false, range = 'today' } = body;

    // ユーザーのGoogle認証情報を取得
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('google_access_token, google_refresh_token, last_calendar_sync')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.google_refresh_token) {
      return NextResponse.json(
        { error: 'Google Calendar連携が必要です' },
        { status: 400 }
      );
    }

    // 強制同期でない場合、最後の同期時間をチェック（5分以内なら同期スキップ）
    if (!force && userData.last_calendar_sync) {
      const lastSync = new Date(userData.last_calendar_sync);
      const now = new Date();
      const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60);
      
      if (diffMinutes < 5) {
        return NextResponse.json({
          success: true,
          message: '最近同期済みのためスキップしました',
          last_synced: userData.last_calendar_sync,
          skipped: true,
        });
      }
    }

    // 同期範囲の設定
    let startDate: string | undefined;
    let endDate: string | undefined;
    
    switch (range) {
      case 'today':
        const today = new Date();
        startDate = today.toISOString().split('T')[0] + 'T00:00:00.000Z';
        endDate = today.toISOString().split('T')[0] + 'T23:59:59.999Z';
        break;
      case 'week':
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        startDate = weekStart.toISOString();
        endDate = weekEnd.toISOString();
        break;
      case 'month':
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setDate(0);
        monthEnd.setHours(23, 59, 59, 999);
        startDate = monthStart.toISOString();
        endDate = monthEnd.toISOString();
        break;
    }

    // Google Calendar APIクライアント作成
    const calendarClient = createUserCalendarClient(
      userData.google_access_token || '',
      userData.google_refresh_token
    );

    // イベント取得
    const events = await calendarClient.getEvents(startDate, endDate, 100);

    // Supabaseに同期保存
    let syncedCount = 0;
    let errorCount = 0;

    for (const event of events) {
      try {
        await supabase
          .from('events')
          .upsert(
            {
              user_id: user.id,
              google_event_id: event.id,
              title: event.summary,
              description: event.description,
              start_time: event.start.dateTime,
              end_time: event.end.dateTime,
              location: event.location,
              event_source: 'google_calendar',
              last_synced_at: new Date().toISOString(),
            },
            { 
              onConflict: 'user_id,google_event_id',
              ignoreDuplicates: false 
            }
          );
        syncedCount++;
      } catch (error) {
        console.error('イベント同期エラー:', event.id, error);
        errorCount++;
      }
    }

    // 最後の同期時間を更新
    await supabase
      .from('users')
      .update({
        last_calendar_sync: new Date().toISOString(),
      })
      .eq('id', user.id);

    return NextResponse.json({
      success: true,
      message: '同期が完了しました',
      statistics: {
        total_events: events.length,
        synced_count: syncedCount,
        error_count: errorCount,
        range,
      },
      last_synced: new Date().toISOString(),
      skipped: false,
    });

  } catch (error) {
    console.error('カレンダー同期エラー:', error);
    
    return NextResponse.json(
      { error: 'カレンダー同期に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 同期状態取得API
 * GET /api/calendar/sync
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Authorization ヘッダーからトークンを取得
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // ユーザーの同期状態を取得
    const { data: userData } = await supabase
      .from('users')
      .select('last_calendar_sync, google_refresh_token')
      .eq('id', user.id)
      .single();

    // 最近のイベント数を取得
    const { count } = await supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .eq('event_source', 'google_calendar')
      .gte('last_synced_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // 24時間以内

    return NextResponse.json({
      success: true,
      sync_status: {
        is_connected: !!userData?.google_refresh_token,
        last_synced: userData?.last_calendar_sync,
        recent_events_count: count || 0,
        needs_sync: !userData?.last_calendar_sync || 
          (new Date().getTime() - new Date(userData.last_calendar_sync).getTime()) > (5 * 60 * 1000),
      },
    });

  } catch (error) {
    console.error('同期状態取得エラー:', error);
    
    return NextResponse.json(
      { error: '同期状態の取得に失敗しました' },
      { status: 500 }
    );
  }
}