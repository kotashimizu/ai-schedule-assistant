import OpenAI from 'openai';
import { AITaskSuggestion, TaskPriority } from '@/types/shared';

/**
 * OpenAI API クライアント
 * GPT-4o を使用したタスク提案・分析機能
 */
export class OpenAIClient {
  private client: OpenAI;
  private model = 'gpt-4o';
  private maxTokens = 2000;
  
  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * カレンダーイベントから準備タスクを生成
   */
  async generatePreparationTasks(
    event: {
      title: string;
      description?: string;
      startTime: string;
      location?: string;
    },
    userContext?: {
      pastTasks?: string[];
      preferences?: string[];
    }
  ): Promise<AITaskSuggestion[]> {
    const prompt = this.buildPreparationTaskPrompt(event, userContext);
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('AI応答が空です');
      }

      const result = JSON.parse(content);
      return this.validateAndFormatTasks(result.tasks || []);
    } catch (error) {
      console.error('OpenAI API エラー:', error);
      throw new Error('AI タスク生成に失敗しました');
    }
  }

  /**
   * 空き時間に基づくタスク提案
   */
  async suggestTasksForFreeTime(
    freeTimeSlots: {
      startTime: string;
      endTime: string;
      durationMinutes: number;
    }[],
    existingTasks: {
      title: string;
      priority: TaskPriority;
      estimatedTime?: number;
    }[],
    userProductivity?: {
      completionRate: number;
      averageTaskTime: number;
      preferredTaskTypes: string[];
    }
  ): Promise<AITaskSuggestion[]> {
    const prompt = this.buildTimeSlotPrompt(freeTimeSlots, existingTasks, userProductivity);
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getTimeSlotSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.8,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('AI応答が空です');
      }

      const result = JSON.parse(content);
      return this.validateAndFormatTasks(result.suggestions || []);
    } catch (error) {
      console.error('OpenAI API エラー:', error);
      throw new Error('AI タスク提案に失敗しました');
    }
  }

  /**
   * タスク分析とフィードバック
   */
  async analyzeTaskPerformance(
    completedTasks: {
      title: string;
      estimatedTime: number;
      actualTime: number;
      priority: TaskPriority;
      completedAt: string;
    }[],
    postponedTasks: {
      title: string;
      postponeCount: number;
      reason?: string;
    }[]
  ): Promise<{
    insights: string[];
    recommendations: string[];
    productivityScore: number;
  }> {
    const prompt = this.buildAnalysisPrompt(completedTasks, postponedTasks);
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getAnalysisSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.maxTokens,
        temperature: 0.6,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('AI応答が空です');
      }

      return JSON.parse(content);
    } catch (error) {
      console.error('OpenAI API エラー:', error);
      throw new Error('AI 分析に失敗しました');
    }
  }

  /**
   * システムプロンプト（準備タスク生成用）
   */
  private getSystemPrompt(): string {
    return `あなたは優秀なスケジュール管理AIアシスタントです。

役割:
- カレンダーイベントを分析し、準備に必要なタスクを提案する
- 実用的で具体的なタスクを生成する
- 優先度と所要時間を適切に見積もる

出力形式:
{
  "tasks": [
    {
      "title": "具体的なタスクタイトル",
      "description": "詳細な説明",
      "estimated_time": 分単位の数値,
      "priority": "high" | "medium" | "low",
      "reasoning": "このタスクが必要な理由"
    }
  ]
}

重要な原則:
1. アイゼンハワーマトリックス（緊急度×重要度）を考慮
2. 15分-120分の現実的な所要時間を設定
3. 最大5個までのタスクに絞る
4. 日本のビジネス慣習を考慮
5. 具体的で実行可能なタスクのみ提案`;
  }

  /**
   * システムプロンプト（時間枠タスク提案用）
   */
  private getTimeSlotSystemPrompt(): string {
    return `あなたは生産性向上の専門家です。

役割:
- 利用可能な時間枠に最適なタスクを提案する
- ユーザーの生産性パターンを考慮する
- 短時間で効果的なタスクを優先する

出力形式:
{
  "suggestions": [
    {
      "title": "タスクタイトル",
      "description": "実行方法の詳細",
      "estimated_time": 分単位の数値,
      "priority": "high" | "medium" | "low",
      "reasoning": "なぜこの時間枠に適しているか"
    }
  ]
}

最適化の原則:
1. 30分以下の短時間タスクを優先
2. 集中力が必要なタスクは長めの時間枠に配置
3. ルーティンタスクは短い時間枠に活用
4. エネルギーレベルに応じたタスク配置
5. 既存タスクとの重複を避ける`;
  }

  /**
   * システムプロンプト（分析用）
   */
  private getAnalysisSystemPrompt(): string {
    return `あなたは生産性分析の専門家です。

役割:
- タスクの完了パターンを分析する
- 生産性向上のための具体的な提案をする
- データに基づいた客観的な評価を行う

出力形式:
{
  "insights": ["分析結果1", "分析結果2", ...],
  "recommendations": ["改善提案1", "改善提案2", ...],
  "productivityScore": 0-100の数値
}

分析の観点:
1. 時間見積もりの精度
2. タスク完了率
3. 延期パターンの傾向
4. 最適な作業時間帯
5. タスクタイプ別のパフォーマンス`;
  }

  /**
   * 準備タスク用プロンプト構築
   */
  private buildPreparationTaskPrompt(
    event: {
      title: string;
      description?: string;
      startTime: string;
      location?: string;
    },
    userContext?: {
      pastTasks?: string[];
      preferences?: string[];
    }
  ): string {
    const eventTime = new Date(event.startTime);
    const timeUntilEvent = Math.ceil((eventTime.getTime() - Date.now()) / (1000 * 60 * 60));
    
    let prompt = `以下のイベントの準備タスクを生成してください：\n\n`;
    prompt += `イベント情報:\n`;
    prompt += `- タイトル: ${event.title}\n`;
    prompt += `- 開始時間: ${eventTime.toLocaleString('ja-JP')}\n`;
    prompt += `- 残り時間: 約${timeUntilEvent}時間\n`;
    
    if (event.description) {
      prompt += `- 詳細: ${event.description}\n`;
    }
    
    if (event.location) {
      prompt += `- 場所: ${event.location}\n`;
    }
    
    if (userContext?.pastTasks?.length) {
      prompt += `\n過去の類似タスク:\n`;
      userContext.pastTasks.slice(0, 3).forEach(task => {
        prompt += `- ${task}\n`;
      });
    }
    
    prompt += `\n準備に必要なタスクを具体的に提案してください。`;
    
    return prompt;
  }

  /**
   * 時間枠タスク用プロンプト構築
   */
  private buildTimeSlotPrompt(
    freeTimeSlots: {
      startTime: string;
      endTime: string;
      durationMinutes: number;
    }[],
    existingTasks: {
      title: string;
      priority: TaskPriority;
      estimatedTime?: number;
    }[],
    userProductivity?: {
      completionRate: number;
      averageTaskTime: number;
      preferredTaskTypes: string[];
    }
  ): string {
    let prompt = `利用可能な時間枠に最適なタスクを提案してください：\n\n`;
    
    prompt += `空き時間:\n`;
    freeTimeSlots.forEach((slot, index) => {
      const start = new Date(slot.startTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      const end = new Date(slot.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      prompt += `${index + 1}. ${start} - ${end} (${slot.durationMinutes}分)\n`;
    });
    
    if (existingTasks.length > 0) {
      prompt += `\n既存のタスク:\n`;
      existingTasks.slice(0, 5).forEach(task => {
        prompt += `- ${task.title} (優先度: ${task.priority}`;
        if (task.estimatedTime) {
          prompt += `, 予想時間: ${task.estimatedTime}分`;
        }
        prompt += `)\n`;
      });
    }
    
    if (userProductivity) {
      prompt += `\nユーザー情報:\n`;
      prompt += `- 完了率: ${Math.round(userProductivity.completionRate * 100)}%\n`;
      prompt += `- 平均タスク時間: ${userProductivity.averageTaskTime}分\n`;
      if (userProductivity.preferredTaskTypes.length > 0) {
        prompt += `- 得意分野: ${userProductivity.preferredTaskTypes.join(', ')}\n`;
      }
    }
    
    prompt += `\n各時間枠に最適なタスクを提案してください。短時間で効果的なタスクを優先してください。`;
    
    return prompt;
  }

  /**
   * 分析用プロンプト構築
   */
  private buildAnalysisPrompt(
    completedTasks: {
      title: string;
      estimatedTime: number;
      actualTime: number;
      priority: TaskPriority;
      completedAt: string;
    }[],
    postponedTasks: {
      title: string;
      postponeCount: number;
      reason?: string;
    }[]
  ): string {
    let prompt = `以下のタスク履歴を分析してください：\n\n`;
    
    if (completedTasks.length > 0) {
      prompt += `完了タスク:\n`;
      completedTasks.forEach(task => {
        const accuracy = Math.round((task.estimatedTime / task.actualTime) * 100);
        prompt += `- ${task.title} (予想: ${task.estimatedTime}分, 実際: ${task.actualTime}分, 精度: ${accuracy}%)\n`;
      });
    }
    
    if (postponedTasks.length > 0) {
      prompt += `\n延期タスク:\n`;
      postponedTasks.forEach(task => {
        prompt += `- ${task.title} (延期回数: ${task.postponeCount}回`;
        if (task.reason) {
          prompt += `, 理由: ${task.reason}`;
        }
        prompt += `)\n`;
      });
    }
    
    prompt += `\n生産性の傾向を分析し、具体的な改善提案をしてください。`;
    
    return prompt;
  }

  /**
   * AIレスポンスの検証とフォーマット
   */
  private validateAndFormatTasks(tasks: any[]): AITaskSuggestion[] {
    return tasks
      .filter(task => task.title && task.description)
      .map(task => ({
        title: String(task.title).substring(0, 100),
        description: String(task.description).substring(0, 500),
        estimated_time: Math.max(5, Math.min(240, Number(task.estimated_time) || 30)),
        priority: this.validatePriority(task.priority),
        reasoning: String(task.reasoning || '').substring(0, 200),
      }))
      .slice(0, 5); // 最大5個まで
  }

  /**
   * 優先度の検証
   */
  private validatePriority(priority: any): TaskPriority {
    const validPriorities: TaskPriority[] = ['high', 'medium', 'low'];
    return validPriorities.includes(priority) ? priority : 'medium';
  }

  /**
   * API使用量統計
   */
  async getUsageStats(): Promise<{
    totalRequests: number;
    tokensUsed: number;
    estimatedCost: number;
  }> {
    // 実装時はローカルまたはSupabaseでトラッキング
    return {
      totalRequests: 0,
      tokensUsed: 0,
      estimatedCost: 0,
    };
  }
}

// デフォルトクライアント
export const openaiClient = new OpenAIClient();

// 開発用のモック実装
export const mockOpenAIClient = {
  async generatePreparationTasks(): Promise<AITaskSuggestion[]> {
    // 開発用のモックデータ
    return [
      {
        title: '会議資料の準備',
        description: 'プレゼンテーション資料を確認し、必要に応じて更新する',
        estimated_time: 30,
        priority: 'high' as TaskPriority,
        reasoning: '会議で使用する重要な資料のため',
      },
      {
        title: '交通手段の確認',
        description: '会場までの最適な交通手段と所要時間を確認する',
        estimated_time: 10,
        priority: 'medium' as TaskPriority,
        reasoning: '遅刻を防ぐため事前確認が必要',
      },
    ];
  },
  
  async suggestTasksForFreeTime(): Promise<AITaskSuggestion[]> {
    return [
      {
        title: 'メール整理',
        description: '未読メールを確認し、重要なものに返信する',
        estimated_time: 20,
        priority: 'medium' as TaskPriority,
        reasoning: '短時間で処理できる日常業務',
      },
    ];
  },
  
  async analyzeTaskPerformance() {
    return {
      insights: ['時間見積もりの精度が向上しています'],
      recommendations: ['短時間タスクを増やすことをお勧めします'],
      productivityScore: 75,
    };
  },
};