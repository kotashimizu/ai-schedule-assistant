import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openaiClient, mockOpenAIClient } from '@/lib/openai';
import { GoogleCalendarEvent, TaskPriority } from '@/types/shared';

/**
 * インテリジェントタスク提案API
 * POST /api/ai/task-suggestions
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const body = await request.json();
    const { date, freeTimeSlots, includeExistingTasks = true } = body;

    if (!date || !freeTimeSlots || freeTimeSlots.length === 0) {
      return NextResponse.json(
        { error: '日付と空き時間情報が必要です' },
        { status: 400 }
      );
    }

    // 空き時間スロットの検証とフォーマット
    const validatedSlots = freeTimeSlots
      .filter((slot: any) => slot.startTime && slot.endTime && slot.durationMinutes > 5)
      .map((slot: any) => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMinutes: Math.min(slot.durationMinutes, 480), // 最大8時間
      }));

    if (validatedSlots.length === 0) {
      return NextResponse.json(
        { error: '有効な空き時間がありません' },
        { status: 400 }
      );
    }

    // 既存タスクを取得
    let existingTasks: {
      title: string;
      priority: TaskPriority;
      estimatedTime?: number;
    }[] = [];

    if (includeExistingTasks) {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('title, priority, estimated_time')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('priority', { ascending: true })
        .limit(10);

      existingTasks = tasks?.map(task => ({
        title: task.title,
        priority: task.priority as TaskPriority,
        estimatedTime: task.estimated_time,
      })) || [];
    }

    // ユーザーの生産性パターンを分析
    const userProductivity = await analyzeUserProductivity(supabase, user.id);

    // 開発モードではmockClient、本番ではopenaiClientを使用
    const useMock = process.env.NODE_ENV === 'development' || !process.env.OPENAI_API_KEY;
    const aiClient = useMock ? mockOpenAIClient : openaiClient;

    // AIによるタスク提案
    const suggestions = await aiClient.suggestTasksForFreeTime(
      validatedSlots,
      existingTasks,
      userProductivity
    );

    // 提案されたタスクを時間帯ごとに最適化
    const optimizedSuggestions = optimizeTasksForTimeSlots(suggestions, validatedSlots);

    // 提案履歴をログに記録
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        action: 'ai_task_suggestions_generated',
        data: {
          date,
          free_slots_count: validatedSlots.length,
          total_free_minutes: validatedSlots.reduce((sum, slot) => sum + slot.durationMinutes, 0),
          suggestions_count: optimizedSuggestions.length,
          existing_tasks_count: existingTasks.length,
          used_mock: useMock,
        },
      });

    return NextResponse.json({
      success: true,
      suggestions: optimizedSuggestions,
      metadata: {
        generated_at: new Date().toISOString(),
        date,
        free_time_slots: validatedSlots,
        user_productivity: userProductivity,
        existing_tasks_considered: existingTasks.length,
        used_mock_ai: useMock,
      },
    });

  } catch (error) {
    console.error('AIタスク提案エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'AIタスク提案に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 空き時間分析API
 * GET /api/ai/task-suggestions/analyze-free-time
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const startTime = searchParams.get('startTime') || '09:00';
    const endTime = searchParams.get('endTime') || '18:00';

    // 今日のイベントを取得
    const startDateTime = `${date}T${startTime}:00.000Z`;
    const endDateTime = `${date}T${endTime}:00.000Z`;

    const { data: events } = await supabase
      .from('events')
      .select('start_time, end_time, title')
      .eq('user_id', user.id)
      .gte('start_time', startDateTime)
      .lt('end_time', endDateTime)
      .order('start_time');

    // 空き時間を計算
    const freeTimeSlots = calculateFreeTimeSlots(
      events || [],
      new Date(startDateTime),
      new Date(endDateTime)
    );

    // 空き時間の統計情報
    const totalFreeTime = freeTimeSlots.reduce((sum, slot) => sum + slot.durationMinutes, 0);
    const longestSlot = freeTimeSlots.reduce((max, slot) => 
      slot.durationMinutes > max ? slot.durationMinutes : max, 0);
    const shortSlots = freeTimeSlots.filter(slot => slot.durationMinutes < 30).length;
    const mediumSlots = freeTimeSlots.filter(slot => slot.durationMinutes >= 30 && slot.durationMinutes < 60).length;
    const longSlots = freeTimeSlots.filter(slot => slot.durationMinutes >= 60).length;

    return NextResponse.json({
      success: true,
      date,
      free_time_slots: freeTimeSlots,
      statistics: {
        total_free_minutes: totalFreeTime,
        total_free_hours: Math.round(totalFreeTime / 60 * 10) / 10,
        slot_count: freeTimeSlots.length,
        longest_slot_minutes: longestSlot,
        breakdown: {
          short_slots: shortSlots, // < 30分
          medium_slots: mediumSlots, // 30-60分
          long_slots: longSlots, // > 60分
        },
      },
      events_count: events?.length || 0,
    });

  } catch (error) {
    console.error('空き時間分析エラー:', error);
    
    return NextResponse.json(
      { error: '空き時間の分析に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * ユーザーの生産性パターンを分析
 */
async function analyzeUserProductivity(supabase: any, userId: string) {
  // 過去30日のタスクデータを取得
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentTasks } = await supabase
    .from('tasks')
    .select('title, status, estimated_time, created_at, updated_at')
    .eq('user_id', userId)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (!recentTasks || recentTasks.length === 0) {
    return {
      completionRate: 0.8, // デフォルト値
      averageTaskTime: 45,
      preferredTaskTypes: [],
    };
  }

  const completedTasks = recentTasks.filter(task => task.status === 'completed');
  const completionRate = completedTasks.length / recentTasks.length;
  
  const averageTaskTime = completedTasks.reduce((sum, task) => {
    return sum + (task.estimated_time || 30);
  }, 0) / Math.max(completedTasks.length, 1);

  // よく使われるキーワードを抽出
  const taskTitles = completedTasks.map(task => task.title.toLowerCase());
  const keywords = extractCommonKeywords(taskTitles);

  return {
    completionRate,
    averageTaskTime: Math.round(averageTaskTime),
    preferredTaskTypes: keywords.slice(0, 3),
  };
}

/**
 * 空き時間スロットを計算
 */
function calculateFreeTimeSlots(
  events: { start_time: string; end_time: string; title: string }[],
  workStart: Date,
  workEnd: Date
): { startTime: string; endTime: string; durationMinutes: number }[] {
  const slots: { startTime: string; endTime: string; durationMinutes: number }[] = [];
  
  // イベントを時間順にソート
  const sortedEvents = events
    .map(event => ({
      start: new Date(event.start_time),
      end: new Date(event.end_time),
      title: event.title,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let currentTime = workStart;

  for (const event of sortedEvents) {
    // イベントの前に空き時間があるかチェック
    if (event.start > currentTime) {
      const freeMinutes = Math.floor((event.start.getTime() - currentTime.getTime()) / (1000 * 60));
      
      if (freeMinutes >= 10) { // 10分以上の空き時間のみ考慮
        slots.push({
          startTime: currentTime.toISOString(),
          endTime: event.start.toISOString(),
          durationMinutes: freeMinutes,
        });
      }
    }
    
    // 次の開始時間を更新
    if (event.end > currentTime) {
      currentTime = event.end;
    }
  }

  // 最後のイベントから終了時間までの空き時間
  if (currentTime < workEnd) {
    const freeMinutes = Math.floor((workEnd.getTime() - currentTime.getTime()) / (1000 * 60));
    
    if (freeMinutes >= 10) {
      slots.push({
        startTime: currentTime.toISOString(),
        endTime: workEnd.toISOString(),
        durationMinutes: freeMinutes,
      });
    }
  }

  return slots;
}

/**
 * タスクを時間スロットに最適化
 */
function optimizeTasksForTimeSlots(
  suggestions: any[],
  timeSlots: { startTime: string; endTime: string; durationMinutes: number }[]
) {
  return suggestions.map(suggestion => {
    // 最適な時間スロットを見つける
    const suitableSlots = timeSlots
      .filter(slot => slot.durationMinutes >= suggestion.estimated_time)
      .sort((a, b) => {
        // 時間のマッチ度でソート（無駄が少ない方を優先）
        const wasteA = a.durationMinutes - suggestion.estimated_time;
        const wasteB = b.durationMinutes - suggestion.estimated_time;
        return wasteA - wasteB;
      });

    return {
      ...suggestion,
      recommended_time_slots: suitableSlots.slice(0, 3), // 上位3個の推奨スロット
      fit_score: suitableSlots.length > 0 
        ? Math.max(0, 100 - (suitableSlots[0].durationMinutes - suggestion.estimated_time) * 2)
        : 0,
    };
  });
}

/**
 * タスクタイトルから共通キーワードを抽出
 */
function extractCommonKeywords(titles: string[]): string[] {
  const words = titles
    .join(' ')
    .split(/[\s、。・ーア-ヶア-ヶぁ-ゖ一-龥]/)
    .filter(word => word.length > 1)
    .map(word => word.toLowerCase());

  const wordCount: { [key: string]: number } = {};
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });

  return Object.entries(wordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}
