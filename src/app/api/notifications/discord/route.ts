import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DiscordWebhookClient, TaskNotificationBuilder, DiscordEmbed } from '@/lib/notifications/discord';

interface DiscordNotificationRequest {
  type: 'task_reminder' | 'event_reminder' | 'urgent_task' | 'daily_summary' | 'custom';
  webhookUrl?: string; // オプション：ユーザー固有のWebhook URL
  data: any; // 通知データ（タスク、イベント、サマリーなど）
  customMessage?: {
    title?: string;
    description?: string;
    color?: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  };
}

interface DiscordTestRequest {
  webhookUrl: string;
  testType?: 'simple' | 'embed' | 'full';
}

/**
 * Discord通知送信API
 * POST /api/notifications/discord - Discord Webhookに通知を送信
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as DiscordNotificationRequest;
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const { type, webhookUrl, data, customMessage } = body;

    // Webhook URLの決定（ユーザー指定 > 環境変数 > エラー）
    let finalWebhookUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL;
    
    if (!finalWebhookUrl) {
      return NextResponse.json(
        { error: 'Discord Webhook URLが設定されていません' },
        { status: 400 }
      );
    }

    // Webhook URLの検証
    if (!DiscordWebhookClient.validateWebhookUrl(finalWebhookUrl)) {
      return NextResponse.json(
        { error: '無効なDiscord Webhook URL形式です' },
        { status: 400 }
      );
    }

    // Discord クライアントの初期化
    const discordClient = new DiscordWebhookClient({
      webhookUrl: finalWebhookUrl,
      defaultUsername: 'AI Schedule Assistant',
      retryAttempts: 3,
      retryDelay: 1000,
    });

    let embed: DiscordEmbed;
    let notificationTitle = '';

    // 通知タイプ別の処理
    switch (type) {
      case 'task_reminder':
        if (!data.id || !data.title) {
          return NextResponse.json(
            { error: 'タスクリマインダーにはidとtitleが必要です' },
            { status: 400 }
          );
        }
        embed = TaskNotificationBuilder.createTaskReminder(data);
        notificationTitle = `タスクリマインダー: ${data.title}`;
        break;

      case 'event_reminder':
        if (!data.id || !data.title || !data.startTime) {
          return NextResponse.json(
            { error: 'イベントリマインダーにはid、title、startTimeが必要です' },
            { status: 400 }
          );
        }
        embed = TaskNotificationBuilder.createEventReminder(data);
        notificationTitle = `イベントリマインダー: ${data.title}`;
        break;

      case 'urgent_task':
        if (!data.id || !data.title || !data.dueDate) {
          return NextResponse.json(
            { error: '緊急タスクにはid、title、dueDateが必要です' },
            { status: 400 }
          );
        }
        embed = TaskNotificationBuilder.createUrgentTaskAlert(data);
        notificationTitle = `緊急タスク警告: ${data.title}`;
        break;

      case 'daily_summary':
        if (!data.date || typeof data.completedTasks !== 'number') {
          return NextResponse.json(
            { error: '日次サマリーにはdateとcompletedTasksが必要です' },
            { status: 400 }
          );
        }
        embed = TaskNotificationBuilder.createDailySummary(data);
        notificationTitle = `日次サマリー: ${data.date}`;
        break;

      case 'custom':
        if (!customMessage) {
          return NextResponse.json(
            { error: 'カスタム通知にはcustomMessageが必要です' },
            { status: 400 }
          );
        }
        embed = {
          title: customMessage.title || 'AI Schedule Assistant',
          description: customMessage.description,
          color: customMessage.color || 0x3498db,
          fields: customMessage.fields,
          footer: {
            text: 'AI Schedule Assistant',
          },
          timestamp: new Date().toISOString()
        };
        notificationTitle = customMessage.title || 'カスタム通知';
        break;

      default:
        return NextResponse.json(
          { error: '無効な通知タイプです' },
          { status: 400 }
        );
    }

    // Discord に送信
    const success = await discordClient.sendEmbed(embed);

    if (success) {
      // 送信成功をログに記録
      await supabase
        .from('analytics_logs')
        .insert({
          user_id: user.id,
          event_type: 'discord_notification_sent',
          event_data: {
            type,
            title: notificationTitle,
            target_id: data.id || null,
            webhook_used: finalWebhookUrl.split('/').slice(-2, -1)[0], // Webhook IDのみ
            success: true,
            sent_at: new Date().toISOString(),
          },
        });

      return NextResponse.json({
        success: true,
        message: 'Discord通知を送信しました',
        notificationTitle,
      });
    } else {
      throw new Error('Discord送信に失敗しました');
    }

  } catch (error) {
    console.error('Discord notification error:', error);
    
    // エラーをログに記録
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: 'test-user-123',
        event_type: 'discord_notification_failed',
        event_data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          failed_at: new Date().toISOString(),
        },
      });

    return NextResponse.json(
      { 
        error: 'Discord通知の送信に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Discord Webhook接続テストAPI
 * PUT /api/notifications/discord - Webhook URLのテスト
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as DiscordTestRequest;
    const { webhookUrl, testType = 'simple' } = body;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Webhook URLが必要です' },
        { status: 400 }
      );
    }

    // Webhook URLの検証
    if (!DiscordWebhookClient.validateWebhookUrl(webhookUrl)) {
      return NextResponse.json(
        { 
          success: false,
          error: '無効なDiscord Webhook URL形式です',
          details: 'URL形式: https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN'
        },
        { status: 400 }
      );
    }

    // Discord クライアントの初期化
    const discordClient = new DiscordWebhookClient({
      webhookUrl,
      defaultUsername: 'AI Schedule Assistant (テスト)',
      retryAttempts: 1, // テストなので1回のみ
    });

    let success = false;
    let testMessage = '';

    // テストタイプ別の送信
    switch (testType) {
      case 'simple':
        success = await discordClient.sendText('✅ AI Schedule Assistant の接続テストが成功しました！');
        testMessage = '簡単なテキストメッセージ';
        break;

      case 'embed':
        const testEmbed: DiscordEmbed = {
          title: '🧪 接続テスト',
          description: 'AI Schedule Assistant からの接続テストです。',
          color: 0x00ff00,
          fields: [
            {
              name: 'ステータス',
              value: '✅ 正常',
              inline: true
            },
            {
              name: 'テスト時刻',
              value: new Date().toLocaleString('ja-JP'),
              inline: true
            }
          ],
          footer: {
            text: 'AI Schedule Assistant - 接続テスト',
          },
          timestamp: new Date().toISOString()
        };
        success = await discordClient.sendEmbed(testEmbed);
        testMessage = 'Embedメッセージ';
        break;

      case 'full':
        // サンプルタスクでのフル機能テスト
        const sampleTask = {
          id: 'test-task-001',
          title: '接続テスト用のサンプルタスク',
          description: 'これはDiscord通知機能のテストです',
          priority: 'high',
          category: 'テスト',
          estimatedMinutes: 30,
          scheduledDate: new Date().toISOString()
        };
        const fullTestEmbed = TaskNotificationBuilder.createTaskReminder(sampleTask);
        success = await discordClient.sendEmbed(fullTestEmbed);
        testMessage = 'フル機能テスト（タスクリマインダー形式）';
        break;

      default:
        return NextResponse.json(
          { error: '無効なテストタイプです' },
          { status: 400 }
        );
    }

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Discord接続テストが成功しました（${testMessage}）`,
        webhookUrl: `${webhookUrl.split('/').slice(0, -1).join('/')}/***`, // トークン部分を隠す
        testType,
      });
    } else {
      throw new Error('テストメッセージの送信に失敗しました');
    }

  } catch (error) {
    console.error('Discord connection test error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Discord接続テストに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error',
        troubleshooting: [
          'Webhook URLが正しい形式かご確認ください',
          'DiscordチャンネルでWebhookが有効になっているかご確認ください',
          'ネットワーク接続をご確認ください',
          'Discord側でサーバーに問題がないかご確認ください'
        ]
      },
      { status: 500 }
    );
  }
}

/**
 * Discord通知履歴の取得API
 * GET /api/notifications/discord?limit=50
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    // Discord通知ログの取得
    const { data: discordLogs, error } = await supabase
      .from('analytics_logs')
      .select('*')
      .eq('user_id', user.id)
      .in('event_type', ['discord_notification_sent', 'discord_notification_failed'])
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100));

    if (error) {
      throw error;
    }

    // 統計の計算
    const stats = {
      total: discordLogs?.length || 0,
      successful: discordLogs?.filter(log => log.event_type === 'discord_notification_sent').length || 0,
      failed: discordLogs?.filter(log => log.event_type === 'discord_notification_failed').length || 0,
    };

    const successRate = stats.total > 0 ? (stats.successful / stats.total) : 0;

    return NextResponse.json({
      success: true,
      logs: discordLogs || [],
      stats: {
        ...stats,
        successRate: Number(successRate.toFixed(3))
      },
    });

  } catch (error) {
    console.error('Discord notification history error:', error);
    
    return NextResponse.json(
      { 
        error: 'Discord通知履歴の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}