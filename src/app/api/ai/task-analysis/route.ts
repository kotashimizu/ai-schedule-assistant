import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TaskAnalysisRequest {
  taskId?: string; // Specific task analysis
  userId?: string; // Optional, for manual analysis
  analysisType?: 'postponed' | 'productivity' | 'comprehensive';
}

interface PostponedTask {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  estimated_minutes: number | null;
  postpone_count: number;
  postpone_reason: string | null;
  created_at: string;
  scheduled_date: string | null;
  due_date: string | null;
  status: string;
}

interface TaskBreakdownSuggestion {
  taskId: string;
  originalTitle: string;
  reason: string;
  postponeCount: number;
  suggestedSubtasks: {
    title: string;
    estimatedMinutes: number;
    priority: 'high' | 'medium' | 'low';
    category: string | null;
    description: string;
  }[];
  complexity: 'high' | 'medium' | 'low';
  recommendedApproach: string;
}

interface ProductivityMetrics {
  period: string; // e.g., "last_7_days", "last_30_days"
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  averageTimeAccuracy: number;
  postponedTasksCount: number;
  highPriorityCompletionRate: number;
  categoryPerformance: Record<string, {
    completed: number;
    total: number;
    completionRate: number;
    averageAccuracy: number;
  }>;
  trends: {
    completionRateTrend: 'improving' | 'declining' | 'stable';
    timeAccuracyTrend: 'improving' | 'declining' | 'stable';
    productivityScore: number; // 0-100
  };
}

/**
 * Helper function to detect tasks that need breakdown
 */
function identifyPostponedTasks(tasks: PostponedTask[]): PostponedTask[] {
  return tasks.filter(task => 
    task.postpone_count >= 3 || 
    (task.postpone_count >= 2 && task.estimated_minutes && task.estimated_minutes > 120) ||
    (task.status === 'pending' && task.created_at && 
     new Date().getTime() - new Date(task.created_at).getTime() > 7 * 24 * 60 * 60 * 1000) // 7 days old
  );
}

/**
 * Generate AI-powered task breakdown suggestions
 */
async function generateTaskBreakdown(task: PostponedTask): Promise<TaskBreakdownSuggestion> {
  const prompt = `以下のタスクが${task.postpone_count}回延期されています。効果的なサブタスクに分割してください：

タスク情報:
- タイトル: ${task.title}
- 説明: ${task.description || 'なし'}
- カテゴリ: ${task.category || '未分類'}
- 優先度: ${task.priority}
- 見積時間: ${task.estimated_minutes ? `${task.estimated_minutes}分` : '未設定'}
- 延期回数: ${task.postpone_count}回
- 延期理由: ${task.postpone_reason || 'なし'}

以下の形式でJSONレスポンスを返してください：
{
  "reason": "このタスクが延期される理由の分析",
  "complexity": "high|medium|low",
  "recommendedApproach": "推奨アプローチの説明",
  "suggestedSubtasks": [
    {
      "title": "サブタスクのタイトル",
      "estimatedMinutes": 30,
      "priority": "high|medium|low",
      "category": "カテゴリ名",
      "description": "具体的な作業内容"
    }
  ]
}

ガイドライン:
- サブタスクは30-60分程度の実行可能な単位にする
- 各サブタスクは明確な完了条件を持つ
- 全体で3-6個のサブタスクに分割する
- 依存関係がある場合は順序を考慮する`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "あなたは優秀なタスク管理コンサルタントです。複雑なタスクを実行可能な小さなステップに分解する専門家として、実用的で具体的な提案を行ってください。"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (aiResponse) {
      try {
        const parsed = JSON.parse(aiResponse);
        return {
          taskId: task.id,
          originalTitle: task.title,
          reason: parsed.reason || `${task.postpone_count}回延期されているため、より小さなタスクに分割することを推奨します。`,
          postponeCount: task.postpone_count,
          suggestedSubtasks: parsed.suggestedSubtasks || [],
          complexity: parsed.complexity || 'medium',
          recommendedApproach: parsed.recommendedApproach || 'タスクを小さなステップに分けて順番に取り組みましょう。',
        };
      } catch (parseError) {
        console.error('Failed to parse AI breakdown suggestion:', parseError);
      }
    }
  } catch (aiError) {
    console.error('AI breakdown generation failed:', aiError);
  }

  // Fallback suggestion if AI fails
  return {
    taskId: task.id,
    originalTitle: task.title,
    reason: `このタスクは${task.postpone_count}回延期されています。大きすぎる可能性があります。`,
    postponeCount: task.postpone_count,
    suggestedSubtasks: [
      {
        title: `${task.title} - 準備・調査`,
        estimatedMinutes: 30,
        priority: task.priority as 'high' | 'medium' | 'low',
        category: task.category,
        description: 'タスクに必要な情報収集と準備作業'
      },
      {
        title: `${task.title} - 実行`,
        estimatedMinutes: Math.max(30, (task.estimated_minutes || 60) - 30),
        priority: task.priority as 'high' | 'medium' | 'low',
        category: task.category,
        description: 'メインの作業実行'
      }
    ],
    complexity: 'medium',
    recommendedApproach: 'タスクを準備フェーズと実行フェーズに分けて取り組むことをお勧めします。',
  };
}

/**
 * Calculate productivity metrics for given time period
 */
async function calculateProductivityMetrics(
  supabase: any,
  userId: string,
  period: string = 'last_7_days'
): Promise<ProductivityMetrics> {
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

  // Get all tasks in the period
  const { data: allTasks, error: allTasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (allTasksError) {
    throw allTasksError;
  }

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t: any) => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
  
  // Calculate time accuracy for completed tasks with both estimated and actual times
  const tasksWithTimes = allTasks.filter((t: any) => 
    t.status === 'completed' && t.estimated_minutes && t.actual_minutes && 
    t.estimated_minutes > 0 && t.actual_minutes > 0
  );
  
  const averageTimeAccuracy = tasksWithTimes.length > 0 
    ? tasksWithTimes.reduce((sum: number, task: any) => {
        const ratio = task.estimated_minutes / task.actual_minutes;
        const accuracy = Math.max(0, 1 - Math.abs(1 - ratio));
        return sum + accuracy;
      }, 0) / tasksWithTimes.length
    : 0;

  // Count postponed tasks
  const postponedTasksCount = allTasks.filter((t: any) => (t.postpone_count || 0) > 0).length;
  
  // High priority completion rate
  const highPriorityTasks = allTasks.filter((t: any) => t.priority === 'high');
  const completedHighPriorityTasks = highPriorityTasks.filter((t: any) => t.status === 'completed');
  const highPriorityCompletionRate = highPriorityTasks.length > 0 
    ? completedHighPriorityTasks.length / highPriorityTasks.length 
    : 0;

  // Category performance
  const categoryPerformance: Record<string, any> = {};
  const categories = [...new Set(allTasks.map((t: any) => t.category || '未分類'))];
  
  categories.forEach(category => {
    const categoryTasks = allTasks.filter((t: any) => (t.category || '未分類') === category);
    const categoryCompleted = categoryTasks.filter((t: any) => t.status === 'completed');
    const categoryTasksWithTimes = categoryTasks.filter((t: any) => 
      t.status === 'completed' && t.estimated_minutes && t.actual_minutes && 
      t.estimated_minutes > 0 && t.actual_minutes > 0
    );
    
    const categoryAccuracy = categoryTasksWithTimes.length > 0
      ? categoryTasksWithTimes.reduce((sum: number, task: any) => {
          const ratio = task.estimated_minutes / task.actual_minutes;
          const accuracy = Math.max(0, 1 - Math.abs(1 - ratio));
          return sum + accuracy;
        }, 0) / categoryTasksWithTimes.length
      : 0;

    categoryPerformance[category] = {
      completed: categoryCompleted.length,
      total: categoryTasks.length,
      completionRate: categoryTasks.length > 0 ? categoryCompleted.length / categoryTasks.length : 0,
      averageAccuracy: categoryAccuracy,
    };
  });

  // Calculate trends (compare with previous period)
  const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
  const { data: previousTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', previousPeriodStart.toISOString())
    .lt('created_at', startDate.toISOString());

  const previousCompletionRate = previousTasks && previousTasks.length > 0 
    ? previousTasks.filter((t: any) => t.status === 'completed').length / previousTasks.length 
    : 0;

  const completionRateTrend = completionRate > previousCompletionRate + 0.1 ? 'improving' 
    : completionRate < previousCompletionRate - 0.1 ? 'declining' : 'stable';

  // Calculate productivity score (0-100)
  const productivityScore = Math.round(
    (completionRate * 40) + 
    (averageTimeAccuracy * 30) + 
    (highPriorityCompletionRate * 20) + 
    (Math.max(0, 1 - (postponedTasksCount / Math.max(1, totalTasks))) * 10)
  );

  return {
    period,
    completionRate,
    totalTasks,
    completedTasks,
    averageTimeAccuracy,
    postponedTasksCount,
    highPriorityCompletionRate,
    categoryPerformance,
    trends: {
      completionRateTrend,
      timeAccuracyTrend: 'stable', // Simplified for now
      productivityScore,
    }
  };
}

/**
 * タスク分析API
 * POST /api/ai/task-analysis - 包括的なタスク分析の実行
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as TaskAnalysisRequest;
    const analysisType = body.analysisType || 'comprehensive';
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const results: any = {
      analysisType,
      timestamp: new Date().toISOString(),
    };

    // Postponed tasks analysis
    if (analysisType === 'postponed' || analysisType === 'comprehensive') {
      const { data: postponedTasks, error: postponedError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .gte('postpone_count', 2)
        .order('postpone_count', { ascending: false });

      if (postponedError) {
        throw postponedError;
      }

      const problemTasks = identifyPostponedTasks(postponedTasks as PostponedTask[]);
      const breakdownSuggestions: TaskBreakdownSuggestion[] = [];

      // Generate breakdown suggestions for the most problematic tasks
      for (const task of problemTasks.slice(0, 5)) { // Limit to top 5 to avoid excessive API calls
        const suggestion = await generateTaskBreakdown(task);
        breakdownSuggestions.push(suggestion);
      }

      results.postponedAnalysis = {
        totalPostponedTasks: postponedTasks.length,
        criticalTasks: problemTasks.length,
        breakdownSuggestions,
        flags: {
          highlyPostponedTasks: postponedTasks.filter((t: any) => t.postpone_count >= 5).length,
          oldUncompletedTasks: postponedTasks.filter((t: any) => {
            const daysSinceCreated = (new Date().getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceCreated > 14;
          }).length,
        }
      };
    }

    // Productivity metrics analysis
    if (analysisType === 'productivity' || analysisType === 'comprehensive') {
      const weeklyMetrics = await calculateProductivityMetrics(supabase, user.id, 'last_7_days');
      const monthlyMetrics = await calculateProductivityMetrics(supabase, user.id, 'last_30_days');
      
      results.productivityAnalysis = {
        weekly: weeklyMetrics,
        monthly: monthlyMetrics,
        alerts: {
          lowCompletionRate: weeklyMetrics.completionRate < 0.6,
          poorTimeEstimation: weeklyMetrics.averageTimeAccuracy < 0.5,
          tooManyPostponements: weeklyMetrics.postponedTasksCount > weeklyMetrics.totalTasks * 0.3,
          decliningTrend: weeklyMetrics.trends.completionRateTrend === 'declining',
        }
      };
    }

    // Store analysis results
    const analysisRecord = {
      user_id: user.id,
      analysis_type: analysisType,
      analysis_results: results,
      generated_at: new Date().toISOString(),
    };

    const { data: storedAnalysis, error: storeError } = await supabase
      .from('task_analyses')
      .insert(analysisRecord)
      .select()
      .single();

    if (storeError) {
      console.error('Failed to store analysis:', storeError);
      // Continue without storing if table doesn't exist yet
    }

    // Log the analysis
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'task_analysis_generated',
        event_data: {
          analysis_type: analysisType,
          postponed_tasks_found: results.postponedAnalysis?.totalPostponedTasks || 0,
          critical_tasks_found: results.postponedAnalysis?.criticalTasks || 0,
          productivity_score: results.productivityAnalysis?.weekly?.trends?.productivityScore || null,
        },
      });

    return NextResponse.json({
      success: true,
      analysis: results,
      message: 'タスク分析が完了しました',
    });

  } catch (error) {
    console.error('Task analysis error:', error);
    
    return NextResponse.json(
      { 
        error: 'タスク分析の実行に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * タスク分析結果の取得API
 * GET /api/ai/task-analysis?type=postponed|productivity|comprehensive
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const analysisType = searchParams.get('type') || 'comprehensive';
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    // Get latest analysis
    const { data: latestAnalysis, error } = await supabase
      .from('task_analyses')
      .select('*')
      .eq('user_id', user.id)
      .eq('analysis_type', analysisType)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!latestAnalysis) {
      return NextResponse.json(
        { error: '分析結果が見つかりません。分析を実行してください。' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: latestAnalysis.analysis_results,
      generatedAt: latestAnalysis.generated_at,
    });

  } catch (error) {
    console.error('Task analysis retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'タスク分析結果の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}