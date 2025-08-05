import { NextRequest, NextResponse } from 'next/server';
import { DiscordWebhookClient } from '@/lib/notifications/discord';

/**
 * 環境変数を使った簡易Discord通知テスト
 * POST /api/notifications/discord/simple-test
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message = 'テスト通知：AI Schedule Assistant が正常に動作しています！' } = body;

    // 環境変数からWebhook URLを取得
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      return NextResponse.json(
        { 
          success: false,
          error: 'DISCORD_WEBHOOK_URL環境変数が設定されていません',
          hint: '.env.localファイルにDISCORD_WEBHOOK_URLを設定してください'
        },
        { status: 400 }
      );
    }

    // Discord クライアントの初期化
    const discordClient = new DiscordWebhookClient({
      webhookUrl,
      defaultUsername: 'AI Schedule Assistant',
      retryAttempts: 1,
    });

    // テストメッセージを送信
    const success = await discordClient.sendText(`🎉 ${message}`);
    
    return NextResponse.json({
      success,
      message: 'Discord通知テストが完了しました',
      sentMessage: message,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Discord simple test error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Discord通知テストに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/notifications/discord/simple-test - テスト方法の説明
 */
export async function GET() {
  return NextResponse.json({
    info: '環境変数を使ったDiscord通知の簡易テスト',
    usage: 'POST /api/notifications/discord/simple-test',
    requirements: [
      '.env.localにDISCORD_WEBHOOK_URLが設定されていること',
      '開発サーバーが起動していること (npm run dev)'
    ],
    example: {
      curl: 'curl -X POST http://localhost:3000/api/notifications/discord/simple-test -H "Content-Type: application/json" -d \'{"message": "カスタムテストメッセージ"}\'',
      defaultMessage: 'パラメータなしの場合はデフォルトメッセージが送信されます'
    }
  });
}