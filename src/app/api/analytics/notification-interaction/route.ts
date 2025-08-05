import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface NotificationInteractionRequest {
  action: 'show' | 'click' | 'close' | 'dismiss';
  notificationId?: string;
  title?: string;
  tag?: string;
  timestamp: number;
  userAgent?: string;
  additionalData?: any;
}

/**
 * 通知インタラクション分析ログAPI
 * POST /api/analytics/notification-interaction - 通知の表示・クリック・閉じるなどのアクションをログ
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as NotificationInteractionRequest;
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const { action, notificationId, title, tag, timestamp, userAgent, additionalData } = body;

    // 入力検証
    if (!action || !timestamp) {
      return NextResponse.json(
        { error: 'actionとtimestampは必須です' },
        { status: 400 }
      );
    }

    if (!['show', 'click', 'close', 'dismiss'].includes(action)) {
      return NextResponse.json(
        { error: '無効なactionです' },
        { status: 400 }
      );
    }

    // ブラウザ情報の解析
    const parseUserAgent = (ua: string) => {
      const browser = ua.includes('Chrome') ? 'Chrome' : 
                    ua.includes('Firefox') ? 'Firefox' : 
                    ua.includes('Safari') ? 'Safari' : 'Other';
      const mobile = ua.includes('Mobile') || ua.includes('Android');
      const os = ua.includes('Windows') ? 'Windows' : 
                ua.includes('Mac') ? 'macOS' : 
                ua.includes('Linux') ? 'Linux' : 
                ua.includes('Android') ? 'Android' : 
                ua.includes('iOS') ? 'iOS' : 'Other';
      
      return { browser, mobile, os };
    };

    const deviceInfo = userAgent ? parseUserAgent(userAgent) : null;

    // インタラクションデータを準備
    const interactionData = {
      user_id: user.id,
      action,
      notification_id: notificationId,
      notification_title: title?.substring(0, 200),
      notification_tag: tag?.substring(0, 100),
      interaction_timestamp: new Date(timestamp).toISOString(),
      device_info: deviceInfo,
      user_agent: userAgent?.substring(0, 500),
      additional_data: additionalData,
      created_at: new Date().toISOString(),
    };

    // データベースに記録
    const { data: logEntry, error } = await supabase
      .from('notification_interactions')
      .insert(interactionData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // 集計データの更新（高頻度アクションなので軽量化）
    if (action === 'click') {
      // クリック率の更新（バックグラウンドで実行）
      updateNotificationStats(supabase, user.id, 'click').catch(error => {
        console.error('Failed to update click stats:', error);
      });
    }

    return NextResponse.json({
      success: true,
      interactionId: logEntry.id,
      message: 'インタラクションをログしました',
    });

  } catch (error) {
    console.error('Notification interaction logging error:', error);
    
    return NextResponse.json(
      { 
        error: 'インタラクションログの記録に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 通知インタラクション統計の取得API
 * GET /api/analytics/notification-interaction?period=last_7_days
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'last_7_days';
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    // 期間の計算
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case 'last_30_days':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'last_7_days':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    // インタラクションデータの取得
    const { data: interactions, error } = await supabase
      .from('notification_interactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('interaction_timestamp', startDate.toISOString())
      .order('interaction_timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    // 統計の計算
    const stats = {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      totalInteractions: interactions?.length || 0,
      actionBreakdown: {
        show: 0,
        click: 0,
        close: 0,
        dismiss: 0,
      },
      clickThroughRate: 0,
      deviceBreakdown: {
        mobile: 0,
        desktop: 0,
      },
      browserBreakdown: {} as Record<string, number>,
      tagBreakdown: {} as Record<string, number>,
      dailyStats: [] as any[],
    };

    if (interactions) {
      // アクション別集計
      interactions.forEach(interaction => {
        if (interaction.action in stats.actionBreakdown) {
          stats.actionBreakdown[interaction.action as keyof typeof stats.actionBreakdown]++;
        }

        // デバイス別集計
        if (interaction.device_info?.mobile) {
          stats.deviceBreakdown.mobile++;
        } else {
          stats.deviceBreakdown.desktop++;
        }

        // ブラウザ別集計
        const browser = interaction.device_info?.browser || 'Unknown';
        stats.browserBreakdown[browser] = (stats.browserBreakdown[browser] || 0) + 1;

        // タグ別集計
        if (interaction.notification_tag) {
          const tag = interaction.notification_tag;
          stats.tagBreakdown[tag] = (stats.tagBreakdown[tag] || 0) + 1;
        }
      });

      // クリック率の計算
      if (stats.actionBreakdown.show > 0) {
        stats.clickThroughRate = Number((stats.actionBreakdown.click / stats.actionBreakdown.show).toFixed(3));
      }

      // 日別統計
      const days = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      for (let i = 0; i < days; i++) {
        const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        
        const dayInteractions = interactions.filter(interaction => {
          const interactionTime = new Date(interaction.interaction_timestamp);
          return interactionTime >= dayStart && interactionTime < dayEnd;
        });

        const dayShows = dayInteractions.filter(i => i.action === 'show').length;
        const dayClicks = dayInteractions.filter(i => i.action === 'click').length;

        stats.dailyStats.push({
          date: dayStart.toISOString().split('T')[0],
          shows: dayShows,
          clicks: dayClicks,
          clickThroughRate: dayShows > 0 ? Number((dayClicks / dayShows).toFixed(3)) : 0,
          totalInteractions: dayInteractions.length,
        });
      }
    }

    return NextResponse.json({
      success: true,
      stats,
    });

  } catch (error) {
    console.error('Notification interaction stats error:', error);
    
    return NextResponse.json(
      { 
        error: 'インタラクション統計の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 通知統計の更新（バックグラウンド処理）
 */
async function updateNotificationStats(supabase: any, userId: string, action: string): Promise<void> {
  try {
    // 簡単な統計更新（実装は簡素化）
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('notification_daily_stats')
      .upsert({
        user_id: userId,
        date: today,
        [`${action}_count`]: 1,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,date',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Failed to update notification stats:', error);
    }
  } catch (error) {
    console.error('Notification stats update error:', error);
  }
}