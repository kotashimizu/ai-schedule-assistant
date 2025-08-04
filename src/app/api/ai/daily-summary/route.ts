import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface DailySummaryRequest {
  targetDate?: string; // YYYY-MM-DD format, defaults to today
  userId?: string; // Optional, for manual generation
}

interface TaskCompletionData {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  completed_at: string;
  completion_metadata: any;
  postpone_count: number;
}

interface DailySummaryData {
  date: string;
  totalTasks: number;
  completedTasks: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  completionRate: number;
  averageAccuracy: number;
  categoryBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  postponedTasks: number;
  tasks: TaskCompletionData[];
}

/**
 * Helper function to calculate time accuracy statistics
 */
function calculateTimeAccuracy(tasks: TaskCompletionData[]): number {
  const tasksWithBothTimes = tasks.filter(t => 
    t.estimated_minutes && t.actual_minutes && t.estimated_minutes > 0 && t.actual_minutes > 0
  );
  
  if (tasksWithBothTimes.length === 0) return 0;
  
  const accuracyScores = tasksWithBothTimes.map(task => {
    const ratio = task.estimated_minutes! / task.actual_minutes!;
    // Convert ratio to accuracy score (1.0 = perfect, decreasing as ratio deviates from 1.0)
    return Math.max(0, 1 - Math.abs(1 - ratio));
  });
  
  return accuracyScores.reduce((sum, score) => sum + score, 0) / accuracyScores.length;
}

/**
 * Generate AI-powered daily summary analysis
 */
async function generateAISummary(summaryData: DailySummaryData): Promise<string> {
  const prompt = `以下のタスク実行データを分析し、1日の振り返りサマリーを生成してください：

日付: ${summaryData.date}
完了タスク数: ${summaryData.completedTasks}/${summaryData.totalTasks}
完了率: ${(summaryData.completionRate * 100).toFixed(1)}%
総見積時間: ${summaryData.totalEstimatedMinutes}分
総実行時間: ${summaryData.totalActualMinutes}分
時間見積精度: ${(summaryData.averageAccuracy * 100).toFixed(1)}%
延期されたタスク: ${summaryData.postponedTasks}件

カテゴリ別完了数:
${Object.entries(summaryData.categoryBreakdown).map(([cat, count]) => `- ${cat || '未分類'}: ${count}件`).join('\n')}

優先度別完了数:
${Object.entries(summaryData.priorityBreakdown).map(([priority, count]) => `- ${priority}: ${count}件`).join('\n')}

完了したタスク:
${summaryData.tasks.map(task => `- ${task.title}${task.category ? ` [${task.category}]` : ''}${task.estimated_minutes && task.actual_minutes ? ` (見積: ${task.estimated_minutes}分, 実行: ${task.actual_minutes}分)` : ''}`).join('\n')}

以下の観点で分析してください：
1. 本日の成果と達成度
2. 時間管理の効率性
3. 優先度の管理状況
4. 改善点と明日への提案
5. ポジティブな評価

出力は日本語で、読みやすく親しみやすい口調でお願いします。`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "あなたは優秀なタスク管理アシスタントです。ユーザーの1日の作業を振り返り、建設的で励ましになるフィードバックを提供してください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '分析結果の生成に失敗しました。';
  } catch (error) {
    console.error('AI summary generation error:', error);
    return `本日は${summaryData.completedTasks}件のタスクを完了しました。完了率は${(summaryData.completionRate * 100).toFixed(1)}%でした。詳細な分析は現在利用できません。`;
  }
}

/**
 * 毎日18:00に自動実行される日次サマリー生成API
 * POST /api/ai/daily-summary - 日次サマリー生成
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as DailySummaryRequest;
    const targetDate = body.targetDate || new Date().toISOString().split('T')[0];
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    // Get all tasks completed on the target date
    const startOfDay = new Date(targetDate + 'T00:00:00.000Z');
    const endOfDay = new Date(targetDate + 'T23:59:59.999Z');
    
    const { data: completedTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', startOfDay.toISOString())
      .lte('completed_at', endOfDay.toISOString())
      .order('completed_at', { ascending: true });

    if (tasksError) {
      throw tasksError;
    }

    // Get total tasks for the day (created or scheduled for this day)
    const { data: allDayTasks, error: allTasksError } = await supabase
      .from('tasks')
      .select('id, status')
      .eq('user_id', user.id)
      .or(`scheduled_date.gte.${startOfDay.toISOString()},scheduled_date.lte.${endOfDay.toISOString()},created_at.gte.${startOfDay.toISOString()},created_at.lte.${endOfDay.toISOString()}`);

    if (allTasksError) {
      throw allTasksError;
    }

    const completedTasksData = completedTasks as TaskCompletionData[];
    
    // Calculate summary statistics
    const totalTasks = allDayTasks.length;
    const completedCount = completedTasksData.length;
    const totalEstimatedMinutes = completedTasksData.reduce((sum, task) => sum + (task.estimated_minutes || 0), 0);
    const totalActualMinutes = completedTasksData.reduce((sum, task) => sum + (task.actual_minutes || 0), 0);
    const completionRate = totalTasks > 0 ? completedCount / totalTasks : 0;
    const averageAccuracy = calculateTimeAccuracy(completedTasksData);
    
    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    completedTasksData.forEach(task => {
      const category = task.category || '未分類';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    });
    
    // Priority breakdown
    const priorityBreakdown: Record<string, number> = {};
    completedTasksData.forEach(task => {
      priorityBreakdown[task.priority] = (priorityBreakdown[task.priority] || 0) + 1;
    });
    
    // Count postponed tasks
    const postponedTasks = completedTasksData.reduce((sum, task) => sum + (task.postpone_count || 0), 0);
    
    const summaryData: DailySummaryData = {
      date: targetDate,
      totalTasks,
      completedTasks: completedCount,
      totalEstimatedMinutes,
      totalActualMinutes,
      completionRate,
      averageAccuracy,
      categoryBreakdown,
      priorityBreakdown,
      postponedTasks,
      tasks: completedTasksData,
    };
    
    // Generate AI-powered summary
    const aiSummary = await generateAISummary(summaryData);
    
    // Check if summary already exists for this date
    const { data: existingSummary } = await supabase
      .from('daily_summaries')
      .select('id')
      .eq('user_id', user.id)
      .eq('summary_date', targetDate)
      .single();
    
    const summaryRecord = {
      user_id: user.id,
      summary_date: targetDate,
      total_tasks: totalTasks,
      completed_tasks: completedCount,
      completion_rate: completionRate,
      total_estimated_minutes: totalEstimatedMinutes,
      total_actual_minutes: totalActualMinutes,
      time_accuracy: averageAccuracy,
      category_breakdown: categoryBreakdown,
      priority_breakdown: priorityBreakdown,
      postponed_tasks: postponedTasks,
      ai_summary: aiSummary,
      task_details: completedTasksData,
      generated_at: new Date().toISOString(),
    };
    
    let result;
    if (existingSummary) {
      // Update existing summary
      const { data, error } = await supabase
        .from('daily_summaries')
        .update(summaryRecord)
        .eq('id', existingSummary.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new summary
      const { data, error } = await supabase
        .from('daily_summaries')
        .insert(summaryRecord)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    // Log the summary generation
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'daily_summary_generated',
        event_data: {
          summary_date: targetDate,
          completed_tasks: completedCount,
          total_tasks: totalTasks,
          completion_rate: completionRate,
          time_accuracy: averageAccuracy,
          auto_generated: !body.userId, // true if automatically generated
        },
      });
    
    return NextResponse.json({
      success: true,
      summary: result,
      metrics: summaryData,
      message: `${targetDate}の日次サマリーを生成しました`,
    });

  } catch (error) {
    console.error('Daily summary generation error:', error);
    
    return NextResponse.json(
      { 
        error: '日次サマリーの生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 日次サマリーの取得API
 * GET /api/ai/daily-summary?date=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const { data: summary, error } = await supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', user.id)
      .eq('summary_date', targetDate)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: '指定された日付のサマリーが見つかりません' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      summary,
    });

  } catch (error) {
    console.error('Daily summary retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: '日次サマリーの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}