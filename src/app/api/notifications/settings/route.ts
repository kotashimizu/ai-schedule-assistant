import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DiscordWebhookClient } from '@/lib/notifications/discord';

interface NotificationSettings {
  // Discord設定
  discordEnabled: boolean;
  discordWebhookUrl?: string;
  discordUsername?: string;
  
  // ブラウザ通知設定
  browserEnabled: boolean;
  browserPermissionGranted: boolean;
  
  // 通知タイプ別設定
  taskReminders: boolean;
  eventReminders: boolean;
  urgentTaskAlerts: boolean;
  dailySummary: boolean;
  
  // タイミング設定
  taskReminderMinutes: number; // デフォルト15分前
  eventReminderMinutes: number; // デフォルト15分前
  urgentTaskHours: number; // デフォルト2時間前
  dailySummaryTime: string; // デフォルト"18:00"
  
  // 集中モード
  focusModeEnabled: boolean;
  focusModeStart?: string; // HH:MM format
  focusModeEnd?: string; // HH:MM format
  focusModeAllowUrgent: boolean;
  
  // 通知頻度制限
  maxNotificationsPerHour: number; // デフォルト10
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:MM format
  quietHoursEnd?: string; // HH:MM format
}

const defaultSettings: NotificationSettings = {
  discordEnabled: false,
  browserEnabled: true,
  browserPermissionGranted: false,
  taskReminders: true,
  eventReminders: true,
  urgentTaskAlerts: true,
  dailySummary: true,
  taskReminderMinutes: 15,
  eventReminderMinutes: 15,
  urgentTaskHours: 2,
  dailySummaryTime: "18:00",
  focusModeEnabled: false,
  focusModeAllowUrgent: true,
  maxNotificationsPerHour: 10,
  quietHoursEnabled: false
};

/**
 * 通知設定管理API
 * GET/POST/PUT /api/notifications/settings - 通知設定の取得・更新
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // 開発環境では認証スキップ
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    // 設定が存在しない場合はデフォルト設定を返す
    let settings = defaultSettings;
    
    try {
      // ユーザーの通知設定を取得（テーブルが存在しない場合はスキップ）
      const { data: settingsData } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (settingsData?.settings) {
        settings = settingsData.settings;
      }
    } catch (error) {
      console.log('notification_settings table not found, using defaults');
    }

    // Discord設定の検証
    if (settings.discordWebhookUrl) {
      settings.discordEnabled = DiscordWebhookClient.validateWebhookUrl(settings.discordWebhookUrl);
    }

    // 環境変数からのDiscord設定も確認
    const envWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (envWebhookUrl && !settings.discordWebhookUrl) {
      settings.discordWebhookUrl = envWebhookUrl;
      settings.discordEnabled = true;
    }

    return NextResponse.json({
      success: true,
      settings,
      hasCustomDiscordWebhook: !!settings.discordWebhookUrl && settings.discordWebhookUrl !== envWebhookUrl,
      usingEnvWebhook: !!envWebhookUrl && !settings.discordWebhookUrl
    });

  } catch (error) {
    console.error('Get notification settings error:', error);
    
    return NextResponse.json(
      { 
        error: '通知設定取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 通知設定更新API
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const newSettings = await request.json() as Partial<NotificationSettings>;

    // 設定の検証
    const validationErrors = validateSettings(newSettings);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: '設定に問題があります',
          validationErrors
        },
        { status: 400 }
      );
    }

    // Discord Webhook URLの検証
    if (newSettings.discordWebhookUrl) {
      if (!DiscordWebhookClient.validateWebhookUrl(newSettings.discordWebhookUrl)) {
        return NextResponse.json(
          { error: 'Discord Webhook URLの形式が正しくありません' },
          { status: 400 }
        );
      }

      // 接続テスト（オプション）
      const testConnection = request.headers.get('x-test-connection') === 'true';
      if (testConnection) {
        try {
          const discordClient = new DiscordWebhookClient({
            webhookUrl: newSettings.discordWebhookUrl,
            retryAttempts: 1
          });
          
          const testSuccess = await discordClient.sendText('✅ 通知設定のテスト接続が成功しました！');
          if (!testSuccess) {
            return NextResponse.json(
              { error: 'Discord接続テストに失敗しました' },
              { status: 400 }
            );
          }
        } catch (testError) {
          return NextResponse.json(
            { 
              error: 'Discord接続テストに失敗しました',
              details: testError instanceof Error ? testError.message : 'Unknown error'
            },
            { status: 400 }
          );
        }
      }
    }

    // 現在の設定を取得
    const { data: currentSettings } = await supabase
      .from('notification_settings')
      .select('settings')
      .eq('user_id', user.id)
      .maybeSingle();

    // 設定をマージ
    const mergedSettings = {
      ...defaultSettings,
      ...(currentSettings?.settings || {}),
      ...newSettings
    };

    // データベースに保存
    const { data: savedSettings, error: saveError } = await supabase
      .from('notification_settings')
      .upsert({
        user_id: user.id,
        settings: mergedSettings,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save notification settings:', saveError);
      return NextResponse.json(
        { error: '通知設定の保存に失敗しました' },
        { status: 500 }
      );
    }

    // 変更ログ
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'notification_settings_updated',
        event_data: {
          updated_fields: Object.keys(newSettings),
          discord_enabled: mergedSettings.discordEnabled,
          browser_enabled: mergedSettings.browserEnabled,
          focus_mode: mergedSettings.focusModeEnabled,
          updated_at: new Date().toISOString()
        }
      });

    return NextResponse.json({
      success: true,
      message: '通知設定を更新しました',
      settings: mergedSettings
    });

  } catch (error) {
    console.error('Update notification settings error:', error);
    
    return NextResponse.json(
      { 
        error: '通知設定更新に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 設定リセット用PUT API
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const { action } = await request.json();

    if (action === 'reset') {
      // デフォルト設定にリセット
      const { error: resetError } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          settings: defaultSettings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (resetError) {
        console.error('Failed to reset notification settings:', resetError);
        return NextResponse.json(
          { error: '設定リセットに失敗しました' },
          { status: 500 }
        );
      }

      // リセットログ
      await supabase
        .from('analytics_logs')
        .insert({
          user_id: user.id,
          event_type: 'notification_settings_reset',
          event_data: {
            reset_at: new Date().toISOString()
          }
        });

      return NextResponse.json({
        success: true,
        message: '通知設定をデフォルトにリセットしました',
        settings: defaultSettings
      });
    }

    return NextResponse.json(
      { error: '無効なアクションです' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Reset notification settings error:', error);
    
    return NextResponse.json(
      { 
        error: '設定リセットに失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 設定の検証
 */
function validateSettings(settings: Partial<NotificationSettings>): string[] {
  const errors: string[] = [];

  // 数値の範囲チェック
  if (settings.taskReminderMinutes !== undefined) {
    if (settings.taskReminderMinutes < 1 || settings.taskReminderMinutes > 1440) {
      errors.push('タスクリマインダー時間は1分～1440分の範囲で設定してください');
    }
  }

  if (settings.eventReminderMinutes !== undefined) {
    if (settings.eventReminderMinutes < 1 || settings.eventReminderMinutes > 1440) {
      errors.push('イベントリマインダー時間は1分～1440分の範囲で設定してください');
    }
  }

  if (settings.urgentTaskHours !== undefined) {
    if (settings.urgentTaskHours < 0.5 || settings.urgentTaskHours > 24) {
      errors.push('緊急タスク警告時間は30分～24時間の範囲で設定してください');
    }
  }

  if (settings.maxNotificationsPerHour !== undefined) {
    if (settings.maxNotificationsPerHour < 1 || settings.maxNotificationsPerHour > 60) {
      errors.push('最大通知数は1～60の範囲で設定してください');
    }
  }

  // 時間形式のチェック
  const timeFields = ['dailySummaryTime', 'focusModeStart', 'focusModeEnd', 'quietHoursStart', 'quietHoursEnd'];
  timeFields.forEach(field => {
    const value = (settings as any)[field];
    if (value && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
      errors.push(`${field}は HH:MM 形式で入力してください`);
    }
  });

  // 集中モードの時間範囲チェック
  if (settings.focusModeStart && settings.focusModeEnd) {
    const start = timeToMinutes(settings.focusModeStart);
    const end = timeToMinutes(settings.focusModeEnd);
    if (start >= end) {
      errors.push('集中モードの終了時刻は開始時刻より後に設定してください');
    }
  }

  // 静音時間の範囲チェック  
  if (settings.quietHoursStart && settings.quietHoursEnd) {
    const start = timeToMinutes(settings.quietHoursStart);
    const end = timeToMinutes(settings.quietHoursEnd);
    if (start >= end) {
      errors.push('静音時間の終了時刻は開始時刻より後に設定してください');
    }
  }

  return errors;
}

/**
 * HH:MM形式を分に変換
 */
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}