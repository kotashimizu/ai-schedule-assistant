import { NextRequest, NextResponse } from 'next/server';
import { DiscordWebhookClient, TaskNotificationBuilder, NotificationColors, DiscordEmbed } from '@/lib/notifications/discord';

interface DiscordTestRequest {
  webhookUrl: string;
  testScenario?: 'basic' | 'task_reminder' | 'event_reminder' | 'urgent_task' | 'daily_summary' | 'all';
}

/**
 * Discord通知の詳細テストAPI
 * POST /api/notifications/discord/test - 様々な通知パターンをテスト
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as DiscordTestRequest;
    const { webhookUrl, testScenario = 'basic' } = body;

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
          error: '無効なDiscord Webhook URL形式です'
        },
        { status: 400 }
      );
    }

    // Discord クライアントの初期化
    const discordClient = new DiscordWebhookClient({
      webhookUrl,
      defaultUsername: 'AI Schedule Assistant (テスト)',
      defaultAvatarUrl: 'https://cdn.discordapp.com/attachments/placeholder/ai-test-avatar.png',
      retryAttempts: 1,
    });

    const testResults: Array<{
      test: string;
      success: boolean;
      error?: string;
    }> = [];

    // テストシナリオの実行
    switch (testScenario) {
      case 'basic':
        await runBasicTest(discordClient, testResults);
        break;

      case 'task_reminder':
        await runTaskReminderTest(discordClient, testResults);
        break;

      case 'event_reminder':
        await runEventReminderTest(discordClient, testResults);
        break;

      case 'urgent_task':
        await runUrgentTaskTest(discordClient, testResults);
        break;

      case 'daily_summary':
        await runDailySummaryTest(discordClient, testResults);
        break;

      case 'all':
        await runBasicTest(discordClient, testResults);
        await new Promise(resolve => setTimeout(resolve, 1000)); // レート制限対策
        await runTaskReminderTest(discordClient, testResults);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await runEventReminderTest(discordClient, testResults);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await runUrgentTaskTest(discordClient, testResults);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await runDailySummaryTest(discordClient, testResults);
        break;

      default:
        return NextResponse.json(
          { error: '無効なテストシナリオです' },
          { status: 400 }
        );
    }

    const successCount = testResults.filter(r => r.success).length;
    const totalTests = testResults.length;

    return NextResponse.json({
      success: successCount === totalTests,
      message: `${successCount}/${totalTests} のテストが成功しました`,
      testScenario,
      results: testResults,
      overallSuccess: successCount === totalTests
    });

  } catch (error) {
    console.error('Discord test error:', error);
    
    return NextResponse.json(
      { 
        error: 'Discordテストの実行に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 基本的な接続テスト
 */
async function runBasicTest(client: DiscordWebhookClient, results: any[]): Promise<void> {
  try {
    await client.sendText('🔧 **基本接続テスト**\nAI Schedule Assistant からの基本的な接続テストです。');
    results.push({ test: '基本接続テスト', success: true });
  } catch (error) {
    results.push({ 
      test: '基本接続テスト', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * タスクリマインダーテスト
 */
async function runTaskReminderTest(client: DiscordWebhookClient, results: any[]): Promise<void> {
  try {
    const testTask = {
      id: 'test-task-001',
      title: 'プレゼンテーション資料の作成',
      description: '来週の会議で使用するプレゼンテーション資料を作成する',
      priority: 'high',
      category: '仕事',
      estimatedMinutes: 90,
      scheduledDate: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15分後
    };

    const embed = TaskNotificationBuilder.createTaskReminder(testTask);
    await client.sendEmbed(embed);
    results.push({ test: 'タスクリマインダーテスト', success: true });
  } catch (error) {
    results.push({ 
      test: 'タスクリマインダーテスト', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * イベントリマインダーテスト
 */
async function runEventReminderTest(client: DiscordWebhookClient, results: any[]): Promise<void> {
  try {
    const testEvent = {
      id: 'test-event-001',
      title: 'チーム定例会議',
      description: '週次の進捗確認会議',
      startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15分後
      location: '会議室A / Zoom'
    };

    const embed = TaskNotificationBuilder.createEventReminder(testEvent);
    await client.sendEmbed(embed);
    results.push({ test: 'イベントリマインダーテスト', success: true });
  } catch (error) {
    results.push({ 
      test: 'イベントリマインダーテスト', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * 緊急タスクテスト
 */
async function runUrgentTaskTest(client: DiscordWebhookClient, results: any[]): Promise<void> {
  try {
    const urgentTask = {
      id: 'test-urgent-001',
      title: '重要な契約書の確認',
      dueDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2時間後
      priority: 'high'
    };

    const embed = TaskNotificationBuilder.createUrgentTaskAlert(urgentTask);
    await client.sendEmbed(embed);
    results.push({ test: '緊急タスクテスト', success: true });
  } catch (error) {
    results.push({ 
      test: '緊急タスクテスト', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * 日次サマリーテスト
 */
async function runDailySummaryTest(client: DiscordWebhookClient, results: any[]): Promise<void> {
  try {
    const testSummary = {
      date: new Date().toISOString().split('T')[0],
      completedTasks: 8,
      totalTasks: 10,
      completionRate: 0.8,
      productivityScore: 85,
      topCategories: [
        { category: '仕事', count: 5 },
        { category: '個人', count: 2 },
        { category: '勉強', count: 1 }
      ]
    };

    const embed = TaskNotificationBuilder.createDailySummary(testSummary);
    await client.sendEmbed(embed);
    results.push({ test: '日次サマリーテスト', success: true });
  } catch (error) {
    results.push({ 
      test: '日次サマリーテスト', 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}

/**
 * カスタムテストシナリオの作成
 * GET /api/notifications/discord/test - 利用可能なテストシナリオの一覧
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    success: true,
    availableScenarios: {
      basic: {
        name: '基本接続テスト',
        description: 'シンプルなテキストメッセージを送信',
        duration: '約5秒'
      },
      task_reminder: {
        name: 'タスクリマインダーテスト',
        description: 'タスクリマインダー形式のEmbed通知を送信',
        duration: '約5秒'
      },
      event_reminder: {
        name: 'イベントリマインダーテスト',
        description: 'イベントリマインダー形式のEmbed通知を送信',
        duration: '約5秒'
      },
      urgent_task: {
        name: '緊急タスクテスト',
        description: '緊急タスク警告形式のEmbed通知を送信',
        duration: '約5秒'
      },
      daily_summary: {
        name: '日次サマリーテスト',
        description: '日次作業サマリー形式のEmbed通知を送信',
        duration: '約5秒'
      },
      all: {
        name: '全機能テスト',
        description: '上記すべてのテストを順次実行',
        duration: '約30秒',
        warning: 'Discordのレート制限により間隔を空けて実行されます'
      }
    },
    usage: {
      endpoint: 'POST /api/notifications/discord/test',
      parameters: {
        webhookUrl: 'Discord Webhook URL（必須）',
        testScenario: 'テストシナリオ名（デフォルト: basic）'
      },
      example: {
        webhookUrl: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN',
        testScenario: 'all'
      }
    },
    troubleshooting: [
      'Webhook URLの形式が正しいか確認してください',
      'DiscordチャンネルでWebhookが有効になっているか確認してください',
      '連続実行時はレート制限にご注意ください（1分間に30リクエストまで）',
      'ネットワーク接続を確認してください'
    ]
  });
}