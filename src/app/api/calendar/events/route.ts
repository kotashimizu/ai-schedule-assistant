import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createUserCalendarClient } from '@/lib/google/calendar';

/**
 * カレンダーイベント取得・同期API
 * GET /api/calendar/events
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    // URLパラメータから条件を取得
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const maxResults = parseInt(searchParams.get('maxResults') || '50');
    const todayOnly = searchParams.get('todayOnly') === 'true';

    // 今日のイベント取得の場合は日付範囲を設定
    let actualStartDate = startDate;
    let actualEndDate = endDate;
    
    if (todayOnly) {
      const today = new Date();
      actualStartDate = today.toISOString().split('T')[0] + 'T00:00:00.000Z';
      actualEndDate = today.toISOString().split('T')[0] + 'T23:59:59.999Z';
    }

    // ユーザーのGoogle認証情報を取得
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('google_access_token, google_refresh_token')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.google_refresh_token) {
      return NextResponse.json(
        { error: 'Google Calendar連携が必要です' },
        { status: 400 }
      );
    }

    // Google Calendar APIクライアント作成
    const calendarClient = createUserCalendarClient(
      userData.google_access_token || '',
      userData.google_refresh_token
    );

    // イベント取得
    const events = await calendarClient.getEvents(
      actualStartDate || undefined,
      actualEndDate || undefined,
      maxResults
    );

    // Supabaseにイベントデータを同期保存
    if (events.length > 0) {
      const eventsToSync = events.map(event => ({
        user_id: user.id,
        google_event_id: event.id,
        title: event.summary,
        description: event.description,
        start_time: event.start.dateTime,
        end_time: event.end.dateTime,
        location: event.location,
        event_source: 'google_calendar',
        last_synced_at: new Date().toISOString(),
      }));

      // 既存イベントと重複しないよう upsert
      for (const eventData of eventsToSync) {
        await supabase
          .from('events')
          .upsert(
            eventData,
            { 
              onConflict: 'user_id,google_event_id',
              ignoreDuplicates: false 
            }
          );
      }
    }

    return NextResponse.json({
      success: true,
      events,
      total: events.length,
      synced_at: new Date().toISOString(),
      filter: {
        start: actualStartDate,
        end: actualEndDate,
        todayOnly,
      },
    });

  } catch (error) {
    console.error('カレンダーイベント取得エラー:', error);
    
    return NextResponse.json(
      { error: 'カレンダーイベントの取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * カレンダーイベント作成・同期API
 * POST /api/calendar/events
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, description, startTime, endTime, location } = body;

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'タイトル、開始時間、終了時間は必須です' },
        { status: 400 }
      );
    }

    // ユーザーのGoogle認証情報を取得
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('google_access_token, google_refresh_token')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData?.google_refresh_token) {
      return NextResponse.json(
        { error: 'Google Calendar連携が必要です' },
        { status: 400 }
      );
    }

    // Google Calendar APIクライアント作成
    const calendarClient = createUserCalendarClient(
      userData.google_access_token || '',
      userData.google_refresh_token
    );

    // Google Calendarにイベント作成
    const createdEvent = await calendarClient.createEvent({
      title,
      description,
      startTime,
      endTime,
      location,
    });

    // Supabaseにも同期保存
    const { data: eventRecord, error: insertError } = await supabase
      .from('events')
      .insert({
        user_id: user.id,
        google_event_id: createdEvent.id,
        title: createdEvent.summary,
        description: createdEvent.description,
        start_time: createdEvent.start.dateTime,
        end_time: createdEvent.end.dateTime,
        location: createdEvent.location,
        event_source: 'google_calendar',
        last_synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('イベント保存エラー:', insertError);
    }

    return NextResponse.json({
      success: true,
      event: createdEvent,
      local_record: eventRecord,
      synced_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('カレンダーイベント作成エラー:', error);
    
    return NextResponse.json(
      { error: 'カレンダーイベントの作成に失敗しました' },
      { status: 500 }
    );
  }
}