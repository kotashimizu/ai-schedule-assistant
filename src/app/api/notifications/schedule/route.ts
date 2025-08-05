import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface ScheduleNotificationRequest {
  type: 'task_reminder' | 'event_reminder' | 'urgent_task';
  targetId: string; // task ID or event ID
  notifyAt: string; // ISO timestamp
  title: string;
  body: string;
  priority: 'high' | 'medium' | 'low';
}

interface ScheduledNotification {
  id: string;
  userId: string;
  type: string;
  targetId: string;
  title: string;
  body: string;
  notifyAt: string;
  priority: string;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  createdAt: string;
  sentAt?: string;
}

/**
 * 通知スケジューリングAPI
 * POST /api/notifications/schedule - 通知をスケジュール
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as ScheduleNotificationRequest;
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const { type, targetId, notifyAt, title, body: notificationBody, priority } = body;

    // 入力検証
    if (!type || !targetId || !notifyAt || !title || !notificationBody) {
      return NextResponse.json(
        { error: '必要なフィールドが不足しています' },
        { status: 400 }
      );
    }

    const notifyTime = new Date(notifyAt);
    if (isNaN(notifyTime.getTime())) {
      return NextResponse.json(
        { error: '無効な通知時刻です' },
        { status: 400 }
      );
    }

    if (notifyTime <= new Date()) {
      return NextResponse.json(
        { error: '通知時刻は未来の時刻である必要があります' },
        { status: 400 }
      );
    }

    // 既存の同じ通知をチェック（重複防止）
    const { data: existingNotification } = await supabase
      .from('scheduled_notifications')
      .select('id')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('target_id', targetId)
      .eq('status', 'scheduled')
      .single();

    if (existingNotification) {
      return NextResponse.json(
        { error: '同じ通知が既にスケジュールされています' },
        { status: 409 }
      );
    }

    // 通知をデータベースに保存
    const notificationData = {
      user_id: user.id,
      type,
      target_id: targetId,
      title: title.substring(0, 200),
      body: notificationBody.substring(0, 500),
      notify_at: notifyTime.toISOString(),
      priority,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };

    const { data: scheduledNotification, error } = await supabase
      .from('scheduled_notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // 通知スケジューリングのログ
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'notification_scheduled',
        event_data: {
          notification_id: scheduledNotification.id,
          type,
          target_id: targetId,
          notify_at: notifyTime.toISOString(),
          priority,
          schedule_delay_minutes: Math.round((notifyTime.getTime() - Date.now()) / (1000 * 60)),
        },
      });

    return NextResponse.json({
      success: true,
      notification: scheduledNotification,
      message: '通知をスケジュールしました',
    });

  } catch (error) {
    console.error('Notification scheduling error:', error);
    
    return NextResponse.json(
      { 
        error: '通知のスケジューリングに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * スケジュール済み通知の取得API
 * GET /api/notifications/schedule?status=scheduled&limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'scheduled';
    const limit = parseInt(searchParams.get('limit') || '50');
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    let query = supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('notify_at', { ascending: true })
      .limit(Math.min(limit, 100));

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: notifications, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      notifications: notifications || [],
      count: notifications?.length || 0,
    });

  } catch (error) {
    console.error('Scheduled notifications retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'スケジュール済み通知の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 通知のキャンセルAPI
 * DELETE /api/notifications/schedule
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const targetId = searchParams.get('targetId');
    const type = searchParams.get('type');
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    if (!notificationId && !targetId) {
      return NextResponse.json(
        { error: 'notification IDまたはtarget IDが必要です' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('scheduled_notifications')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('status', 'scheduled');

    if (notificationId) {
      query = query.eq('id', notificationId);
    } else if (targetId) {
      query = query.eq('target_id', targetId);
      if (type) {
        query = query.eq('type', type);
      }
    }

    const { data: cancelledNotifications, error } = await query.select();

    if (error) {
      throw error;
    }

    if (!cancelledNotifications || cancelledNotifications.length === 0) {
      return NextResponse.json(
        { error: 'キャンセル対象の通知が見つかりません' },
        { status: 404 }
      );
    }

    // キャンセルログ
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'notification_cancelled',
        event_data: {
          cancelled_count: cancelledNotifications.length,
          notification_ids: cancelledNotifications.map(n => n.id),
          target_id: targetId,
          type,
        },
      });

    return NextResponse.json({
      success: true,
      cancelledCount: cancelledNotifications.length,
      message: `${cancelledNotifications.length}件の通知をキャンセルしました`,
    });

  } catch (error) {
    console.error('Notification cancellation error:', error);
    
    return NextResponse.json(
      { 
        error: '通知のキャンセルに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}