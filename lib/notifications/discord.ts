// Discord Webhook クライアント - AI Schedule Assistant

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: {
    url: string;
  };
  image?: {
    url: string;
  };
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  fields?: DiscordEmbedField[];
}

export interface DiscordMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  tts?: boolean;
  embeds?: DiscordEmbed[];
}

export interface DiscordNotificationConfig {
  webhookUrl: string;
  defaultUsername?: string;
  defaultAvatarUrl?: string;
  retryAttempts?: number;
  retryDelay?: number;
}

export class DiscordWebhookClient {
  private config: DiscordNotificationConfig;
  private rateLimitReset: number = 0;
  private requestCount: number = 0;

  constructor(config: DiscordNotificationConfig) {
    this.config = {
      defaultUsername: 'AI Schedule Assistant',
      defaultAvatarUrl: 'https://cdn.discordapp.com/attachments/placeholder/ai-assistant-avatar.png',
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };
  }

  /**
   * Discord Webhook URLの検証
   */
  static validateWebhookUrl(url: string): boolean {
    const webhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    return webhookRegex.test(url);
  }

  /**
   * レート制限のチェック
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    if (now < this.rateLimitReset) {
      const waitTime = this.rateLimitReset - now;
      console.log(`Discord rate limit active, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Discord Webhookは1分間に30リクエストまで
    if (this.requestCount >= 30) {
      this.rateLimitReset = now + 60000; // 1分後にリセット
      this.requestCount = 0;
      await this.checkRateLimit();
    }
  }

  /**
   * メッセージを送信
   */
  async sendMessage(message: DiscordMessage): Promise<boolean> {
    if (!DiscordWebhookClient.validateWebhookUrl(this.config.webhookUrl)) {
      throw new Error('Invalid Discord Webhook URL format');
    }

    await this.checkRateLimit();

    const payload: DiscordMessage = {
      username: this.config.defaultUsername,
      avatar_url: this.config.defaultAvatarUrl,
      ...message
    };

    // メッセージの検証
    if (!payload.content && (!payload.embeds || payload.embeds.length === 0)) {
      throw new Error('Message must have either content or embeds');
    }

    // コンテンツの長さ制限チェック
    if (payload.content && payload.content.length > 2000) {
      payload.content = payload.content.substring(0, 1997) + '...';
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.retryAttempts!; attempt++) {
      try {
        this.requestCount++;
        
        const response = await fetch(this.config.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          console.log('Discord message sent successfully');
          return true;
        }

        // レート制限の処理
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get('retry-after') || '1000');
          this.rateLimitReset = Date.now() + retryAfter;
          
          if (attempt < this.config.retryAttempts!) {
            console.log(`Discord rate limited, retrying after ${retryAfter}ms`);
            await new Promise(resolve => setTimeout(resolve, retryAfter));
            continue;
          }
        }

        // その他のエラー
        const errorText = await response.text();
        lastError = new Error(`Discord API error: ${response.status} - ${errorText}`);
        
        if (attempt < this.config.retryAttempts!) {
          console.log(`Discord send failed (attempt ${attempt + 1}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay! * (attempt + 1)));
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.config.retryAttempts!) {
          console.log(`Discord network error (attempt ${attempt + 1}), retrying...`);
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay! * (attempt + 1)));
        }
      }
    }

    console.error('Discord message send failed after all retries:', lastError);
    throw lastError || new Error('Failed to send Discord message');
  }

  /**
   * 簡単なテキストメッセージを送信
   */
  async sendText(text: string): Promise<boolean> {
    return this.sendMessage({ content: text });
  }

  /**
   * Embedメッセージを送信
   */
  async sendEmbed(embed: DiscordEmbed): Promise<boolean> {
    return this.sendMessage({ embeds: [embed] });
  }

  /**
   * 複数のEmbedを送信
   */
  async sendEmbeds(embeds: DiscordEmbed[]): Promise<boolean> {
    // Discordは1つのメッセージに最大10個のEmbedまで
    if (embeds.length > 10) {
      embeds = embeds.slice(0, 10);
    }
    
    return this.sendMessage({ embeds });
  }
}

/**
 * 通知タイプ別のカラーコード
 */
export const NotificationColors = {
  INFO: 0x3498db,      // 青
  SUCCESS: 0x2ecc71,   // 緑
  WARNING: 0xf39c12,   // オレンジ
  ERROR: 0xe74c3c,     // 赤
  URGENT: 0x9b59b6,    // 紫
  TASK: 0x1abc9c,      // ティール
  EVENT: 0x34495e,     // ダークグレー
} as const;

/**
 * タスク通知用のEmbed生成ヘルパー
 */
export class TaskNotificationBuilder {
  static createTaskReminder(task: {
    id: string;
    title: string;
    description?: string;
    priority: string;
    scheduledDate?: string;
    estimatedMinutes?: number;
    category?: string;
  }): DiscordEmbed {
    const priorityEmoji = {
      high: '🔴',
      medium: '🟡',
      low: '🟢'
    };

    const fields: DiscordEmbedField[] = [
      {
        name: '優先度',
        value: `${priorityEmoji[task.priority as keyof typeof priorityEmoji]} ${task.priority.toUpperCase()}`,
        inline: true
      }
    ];

    if (task.category) {
      fields.push({
        name: 'カテゴリ',
        value: task.category,
        inline: true
      });
    }

    if (task.estimatedMinutes) {
      fields.push({
        name: '見積時間',
        value: `${task.estimatedMinutes}分`,
        inline: true
      });
    }

    if (task.scheduledDate) {
      fields.push({
        name: '予定時刻',
        value: new Date(task.scheduledDate).toLocaleString('ja-JP'),
        inline: false
      });
    }

    return {
      title: '📋 タスクリマインダー',
      description: task.title,
      color: task.priority === 'high' ? NotificationColors.URGENT : NotificationColors.TASK,
      fields,
      footer: {
        text: 'AI Schedule Assistant',
      },
      timestamp: new Date().toISOString()
    };
  }

  static createEventReminder(event: {
    id: string;
    title: string;
    description?: string;
    startTime: string;
    location?: string;
  }): DiscordEmbed {
    const fields: DiscordEmbedField[] = [
      {
        name: '開始時刻',
        value: new Date(event.startTime).toLocaleString('ja-JP'),
        inline: true
      }
    ];

    if (event.location) {
      fields.push({
        name: '場所',
        value: event.location,
        inline: true
      });
    }

    return {
      title: '📅 イベントリマインダー',
      description: event.title,
      color: NotificationColors.EVENT,
      fields,
      footer: {
        text: 'AI Schedule Assistant',
      },
      timestamp: new Date().toISOString()
    };
  }

  static createUrgentTaskAlert(task: {
    id: string;
    title: string;
    dueDate: string;
    priority: string;
  }): DiscordEmbed {
    return {
      title: '🚨 緊急タスク警告',
      description: `**${task.title}**\n\n期限まで2時間を切りました！`,
      color: NotificationColors.ERROR,
      fields: [
        {
          name: '期限',
          value: new Date(task.dueDate).toLocaleString('ja-JP'),
          inline: true
        },
        {
          name: '優先度',
          value: `🔴 ${task.priority.toUpperCase()}`,
          inline: true
        }
      ],
      footer: {
        text: 'AI Schedule Assistant - 緊急通知',
      },
      timestamp: new Date().toISOString()
    };
  }

  static createDailySummary(summary: {
    date: string;
    completedTasks: number;
    totalTasks: number;
    completionRate: number;
    productivityScore: number;
    topCategories: Array<{ category: string; count: number }>;
  }): DiscordEmbed {
    const completionRatePercent = (summary.completionRate * 100).toFixed(1);
    const scoreEmoji = summary.productivityScore >= 80 ? '🎉' : 
                     summary.productivityScore >= 60 ? '👍' : 
                     summary.productivityScore >= 40 ? '📈' : '💪';

    const fields: DiscordEmbedField[] = [
      {
        name: '完了タスク',
        value: `${summary.completedTasks}/${summary.totalTasks}`,
        inline: true
      },
      {
        name: '完了率',
        value: `${completionRatePercent}%`,
        inline: true
      },
      {
        name: '生産性スコア',
        value: `${scoreEmoji} ${summary.productivityScore}点`,
        inline: true
      }
    ];

    if (summary.topCategories.length > 0) {
      const categoryText = summary.topCategories
        .slice(0, 3)
        .map(cat => `• ${cat.category}: ${cat.count}件`)
        .join('\n');
      
      fields.push({
        name: '主なカテゴリ',
        value: categoryText,
        inline: false
      });
    }

    return {
      title: '📊 今日の作業サマリー',
      description: `${summary.date} の作業が完了しました`,
      color: summary.completionRate >= 0.8 ? NotificationColors.SUCCESS : 
             summary.completionRate >= 0.6 ? NotificationColors.WARNING : 
             NotificationColors.INFO,
      fields,
      footer: {
        text: 'AI Schedule Assistant - 日次レポート',
      },
      timestamp: new Date().toISOString()
    };
  }
}