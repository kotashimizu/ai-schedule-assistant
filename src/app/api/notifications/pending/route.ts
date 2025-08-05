import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 未送信通知の取得API（Service Workerから呼び出し用）
 * GET /api/notifications/pending - 送信すべき通知をチェックして返す
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const currentTime = new Date();
    const checkWindow = new Date(currentTime.getTime() + 5 * 60 * 1000); // 5分以内に送信予定

    // 送信すべき通知を取得
    const { data: pendingNotifications, error } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'scheduled')
      .lte('notify_at', checkWindow.toISOString())
      .order('notify_at', { ascending: true })
      .limit(10); // 一度に最大10件

    if (error) {
      throw error;
    }

    const notifications = [];
    const notificationIds = [];

    if (pendingNotifications) {
      for (const notification of pendingNotifications) {
        const notifyTime = new Date(notification.notify_at);
        
        // 送信時刻が現在時刻を過ぎているかチェック
        if (notifyTime <= currentTime) {
          notifications.push({
            id: notification.id,
            title: notification.title,
            body: notification.body,
            icon: '/icons/icon-192.png',
            tag: `${notification.type}-${notification.target_id}`,
            data: {
              type: notification.type,
              targetId: notification.target_id,
              notificationId: notification.id,
              timestamp: Date.now(),
            }
          });
          
          notificationIds.push(notification.id);
        }
      }

      // 送信済みにステータスを更新
      if (notificationIds.length > 0) {
        const { error: updateError } = await supabase
          .from('scheduled_notifications')
          .update({
            status: 'sent',
            sent_at: currentTime.toISOString(),
            updated_at: currentTime.toISOString(),
          })
          .in('id', notificationIds);

        if (updateError) {
          console.error('Failed to update notification status:', updateError);
        }

        // 送信ログを記録
        await supabase
          .from('analytics_logs')
          .insert({
            user_id: user.id,
            event_type: 'notifications_sent',
            event_data: {
              count: notifications.length,
              notification_ids: notificationIds,
              sent_at: currentTime.toISOString(),
            },
          });
      }
    }

    return NextResponse.json({
      success: true,
      notifications,
      count: notifications.length,
      checkTime: currentTime.toISOString(),
    });

  } catch (error) {
    console.error('Pending notifications error:', error);
    
    return NextResponse.json(
      { 
        error: '未送信通知の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 通知送信の手動実行API
 * POST /api/notifications/pending - 特定の通知を手動で送信
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { notificationId, force = false } = body;
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    if (!notificationId) {
      return NextResponse.json(
        { error: 'notification IDが必要です' },
        { status: 400 }
      );
    }

    // 通知を取得
    const { data: notification, error: fetchError } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: '通知が見つかりません' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // 送信済みかチェック
    if (notification.status === 'sent' && !force) {
      return NextResponse.json(
        { error: '通知は既に送信済みです' },
        { status: 409 }
      );
    }

    // 通知時刻のチェック
    const notifyTime = new Date(notification.notify_at);
    const currentTime = new Date();
    
    if (notifyTime > currentTime && !force) {
      return NextResponse.json(
        { error: '通知時刻になっていません' },
        { status: 400 }
      );
    }

    // 通知データを準備
    const notificationData = {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      icon: '/icons/icon-192.png',
      tag: `${notification.type}-${notification.target_id}`,
      data: {
        type: notification.type,
        targetId: notification.target_id,
        notificationId: notification.id,
        timestamp: Date.now(),
      }
    };

    // ステータスを送信済みに更新
    const { error: updateError } = await supabase
      .from('scheduled_notifications')
      .update({
        status: 'sent',
        sent_at: currentTime.toISOString(),
        updated_at: currentTime.toISOString(),
      })
      .eq('id', notificationId);

    if (updateError) {
      throw updateError;
    }

    // 送信ログを記録
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'notification_manually_sent',
        event_data: {
          notification_id: notificationId,
          type: notification.type,
          target_id: notification.target_id,
          forced: force,
          sent_at: currentTime.toISOString(),
        },
      });

    return NextResponse.json({
      success: true,
      notification: notificationData,
      message: '通知を送信しました',
    });

  } catch (error) {
    console.error('Manual notification send error:', error);
    
    return NextResponse.json(
      { 
        error: '通知の手動送信に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}