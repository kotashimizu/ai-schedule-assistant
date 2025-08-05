import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface ProductivityMetricsRequest {
  period?: 'last_7_days' | 'last_30_days' | 'last_90_days';
  userId?: string;
}

interface DetailedMetrics {
  period: string;
  startDate: string;
  endDate: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  
  // Time management metrics
  averageTimeAccuracy: number;
  totalEstimatedMinutes: number;
  totalActualMinutes: number;
  timeEfficiencyRatio: number;
  
  // Priority management
  highPriorityCompletionRate: number;
  mediumPriorityCompletionRate: number;
  lowPriorityCompletionRate: number;
  
  // Postponement analysis
  postponedTasksCount: number;
  postponementRate: number;
  averagePostponeCount: number;
  
  // Category performance
  categoryPerformance: Record<string, {
    completed: number;
    total: number;
    completionRate: number;
    averageAccuracy: number;
    postponementRate: number;
  }>;
  
  // Daily patterns
  dailyBreakdown: {
    date: string;
    completed: number;
    total: number;
    completionRate: number;
  }[];
  
  // Trends and scores
  trends: {
    completionRateTrend: 'improving' | 'declining' | 'stable';
    timeAccuracyTrend: 'improving' | 'declining' | 'stable';
    productivityScore: number; // 0-100
    consistencyScore: number; // 0-100 based on daily variation
  };
  
  // Flags and alerts
  alerts: {
    lowCompletionRate: boolean;
    poorTimeEstimation: boolean;
    tooManyPostponements: boolean;
    decliningTrend: boolean;
    inconsistentPerformance: boolean;
  };
  
  // Recommendations
  recommendations: string[];
}

/**
 * Calculate detailed productivity metrics
 */
async function calculateDetailedMetrics(
  supabase: any,
  userId: string,
  period: string = 'last_7_days'
): Promise<DetailedMetrics> {
  const now = new Date();
  let startDate: Date;
  let days: number;
  
  switch (period) {
    case 'last_90_days':
      days = 90;
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30_days':
      days = 30;
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_7_days':
    default:
      days = 7;
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
  }

  // Get all tasks in the period
  const { data: allTasks, error: allTasksError } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true });

  if (allTasksError) {
    throw allTasksError;
  }

  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t: any) => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;
  
  // Time management calculations
  const tasksWithTimes = allTasks.filter((t: any) => 
    t.status === 'completed' && t.estimated_minutes && t.actual_minutes && 
    t.estimated_minutes > 0 && t.actual_minutes > 0
  );
  
  const totalEstimatedMinutes = tasksWithTimes.reduce((sum: number, task: any) => sum + task.estimated_minutes, 0);
  const totalActualMinutes = tasksWithTimes.reduce((sum: number, task: any) => sum + task.actual_minutes, 0);
  const timeEfficiencyRatio = totalEstimatedMinutes > 0 ? totalActualMinutes / totalEstimatedMinutes : 1;
  
  const averageTimeAccuracy = tasksWithTimes.length > 0 
    ? tasksWithTimes.reduce((sum: number, task: any) => {
        const ratio = task.estimated_minutes / task.actual_minutes;
        const accuracy = Math.max(0, 1 - Math.abs(1 - ratio));
        return sum + accuracy;
      }, 0) / tasksWithTimes.length
    : 0;

  // Priority analysis
  const highPriorityTasks = allTasks.filter((t: any) => t.priority === 'high');
  const mediumPriorityTasks = allTasks.filter((t: any) => t.priority === 'medium');
  const lowPriorityTasks = allTasks.filter((t: any) => t.priority === 'low');
  
  const highPriorityCompletionRate = highPriorityTasks.length > 0 
    ? highPriorityTasks.filter((t: any) => t.status === 'completed').length / highPriorityTasks.length : 0;
  const mediumPriorityCompletionRate = mediumPriorityTasks.length > 0 
    ? mediumPriorityTasks.filter((t: any) => t.status === 'completed').length / mediumPriorityTasks.length : 0;
  const lowPriorityCompletionRate = lowPriorityTasks.length > 0 
    ? lowPriorityTasks.filter((t: any) => t.status === 'completed').length / lowPriorityTasks.length : 0;

  // Postponement analysis
  const postponedTasks = allTasks.filter((t: any) => (t.postpone_count || 0) > 0);
  const postponedTasksCount = postponedTasks.length;
  const postponementRate = totalTasks > 0 ? postponedTasksCount / totalTasks : 0;
  const averagePostponeCount = postponedTasks.length > 0 
    ? postponedTasks.reduce((sum: number, task: any) => sum + (task.postpone_count || 0), 0) / postponedTasks.length 
    : 0;

  // Category performance
  const categoryPerformance: Record<string, any> = {};
  const categories = [...new Set(allTasks.map((t: any) => t.category || '未分類'))];
  
  categories.forEach(category => {
    const categoryTasks = allTasks.filter((t: any) => (t.category || '未分類') === category);
    const categoryCompleted = categoryTasks.filter((t: any) => t.status === 'completed');
    const categoryPostponed = categoryTasks.filter((t: any) => (t.postpone_count || 0) > 0);
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
      postponementRate: categoryTasks.length > 0 ? categoryPostponed.length / categoryTasks.length : 0,
    };
  });

  // Daily breakdown
  const dailyBreakdown: any[] = [];
  for (let i = 0; i < days; i++) {
    const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    
    const dayTasks = allTasks.filter((t: any) => {
      const taskDate = new Date(t.created_at);
      return taskDate >= dayStart && taskDate < dayEnd;
    });
    
    const dayCompleted = dayTasks.filter((t: any) => t.status === 'completed');
    
    dailyBreakdown.push({
      date: dayStart.toISOString().split('T')[0],
      completed: dayCompleted.length,
      total: dayTasks.length,
      completionRate: dayTasks.length > 0 ? dayCompleted.length / dayTasks.length : 0,
    });
  }

  // Trends calculation (compare with previous period)
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

  // Consistency score based on daily variation
  const completionRates = dailyBreakdown.map(day => day.completionRate).filter(rate => !isNaN(rate));
  const avgCompletionRate = completionRates.length > 0 
    ? completionRates.reduce((sum, rate) => sum + rate, 0) / completionRates.length : 0;
  const variance = completionRates.length > 0 
    ? completionRates.reduce((sum, rate) => sum + Math.pow(rate - avgCompletionRate, 2), 0) / completionRates.length : 0;
  const consistencyScore = Math.max(0, Math.round((1 - Math.sqrt(variance)) * 100));

  // Overall productivity score
  const productivityScore = Math.round(
    (completionRate * 30) + 
    (averageTimeAccuracy * 25) + 
    (highPriorityCompletionRate * 20) + 
    (Math.max(0, 1 - postponementRate) * 15) +
    (consistencyScore / 100 * 10)
  );

  // Alerts
  const alerts = {
    lowCompletionRate: completionRate < 0.6,
    poorTimeEstimation: averageTimeAccuracy < 0.5,
    tooManyPostponements: postponementRate > 0.3,
    decliningTrend: completionRateTrend === 'declining',
    inconsistentPerformance: consistencyScore < 50,
  };

  // Generate recommendations
  const recommendations: string[] = [];
  if (alerts.lowCompletionRate) {
    recommendations.push('完了率が低いです。タスクの見積もりを見直し、より小さなタスクに分割することを検討してください。');
  }
  if (alerts.poorTimeEstimation) {
    recommendations.push('時間見積もりの精度が低いです。過去の実績を参考に、より現実的な見積もりを心がけましょう。');
  }
  if (alerts.tooManyPostponements) {
    recommendations.push('延期が多すぎます。タスクの優先度を見直し、複雑なタスクは分割して取り組みましょう。');
  }
  if (alerts.decliningTrend) {
    recommendations.push('完了率が低下傾向にあります。作業パターンを見直し、集中できる時間帯を特定しましょう。');
  }
  if (alerts.inconsistentPerformance) {
    recommendations.push('日々のパフォーマンスにばらつきがあります。一定のルーティンを作ることをお勧めします。');
  }
  if (highPriorityCompletionRate < 0.7) {
    recommendations.push('高優先度タスクの完了率が低いです。重要なタスクを優先的に取り組むようスケジュールを調整しましょう。');
  }

  return {
    period,
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
    totalTasks,
    completedTasks,
    completionRate,
    averageTimeAccuracy,
    totalEstimatedMinutes,
    totalActualMinutes,
    timeEfficiencyRatio,
    highPriorityCompletionRate,
    mediumPriorityCompletionRate,
    lowPriorityCompletionRate,
    postponedTasksCount,
    postponementRate,
    averagePostponeCount,
    categoryPerformance,
    dailyBreakdown,
    trends: {
      completionRateTrend,
      timeAccuracyTrend: 'stable', // Simplified for now
      productivityScore,
      consistencyScore,
    },
    alerts,
    recommendations,
  };
}

/**
 * 生産性メトリクス取得API
 * GET /api/tasks/productivity-metrics?period=last_7_days
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') as 'last_7_days' | 'last_30_days' | 'last_90_days' || 'last_7_days';
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const metrics = await calculateDetailedMetrics(supabase, user.id, period);
    
    // Store metrics snapshot
    const metricsRecord = {
      user_id: user.id,
      period,
      metrics_data: metrics,
      generated_at: new Date().toISOString(),
    };

    const { error: storeError } = await supabase
      .from('productivity_metrics_snapshots')
      .insert(metricsRecord);

    if (storeError) {
      console.error('Failed to store metrics snapshot:', storeError);
      // Continue without storing if table doesn't exist yet
    }

    // Log metrics generation
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'productivity_metrics_generated',
        event_data: {
          period,
          completion_rate: metrics.completionRate,
          productivity_score: metrics.trends.productivityScore,
          alerts_count: Object.values(metrics.alerts).filter(Boolean).length,
          recommendations_count: metrics.recommendations.length,
        },
      });

    return NextResponse.json({
      success: true,
      metrics,
      message: '生産性メトリクスを取得しました',
    });

  } catch (error) {
    console.error('Productivity metrics error:', error);
    
    return NextResponse.json(
      { 
        error: '生産性メトリクスの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 生産性メトリクスの比較API
 * POST /api/tasks/productivity-metrics - 複数期間の比較分析
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as ProductivityMetricsRequest;
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    // Calculate metrics for multiple periods
    const weeklyMetrics = await calculateDetailedMetrics(supabase, user.id, 'last_7_days');
    const monthlyMetrics = await calculateDetailedMetrics(supabase, user.id, 'last_30_days');
    const quarterlyMetrics = await calculateDetailedMetrics(supabase, user.id, 'last_90_days');
    
    // Calculate improvement metrics
    const improvements = {
      weekVsMonth: {
        completionRateChange: weeklyMetrics.completionRate - monthlyMetrics.completionRate,
        timeAccuracyChange: weeklyMetrics.averageTimeAccuracy - monthlyMetrics.averageTimeAccuracy,
        productivityScoreChange: weeklyMetrics.trends.productivityScore - monthlyMetrics.trends.productivityScore,
      },
      monthVsQuarter: {
        completionRateChange: monthlyMetrics.completionRate - quarterlyMetrics.completionRate,
        timeAccuracyChange: monthlyMetrics.averageTimeAccuracy - quarterlyMetrics.averageTimeAccuracy,
        productivityScoreChange: monthlyMetrics.trends.productivityScore - quarterlyMetrics.trends.productivityScore,
      }
    };

    const comparison = {
      weekly: weeklyMetrics,
      monthly: monthlyMetrics,
      quarterly: quarterlyMetrics,
      improvements,
      overallTrend: {
        direction: improvements.monthVsQuarter.productivityScoreChange > 5 ? 'improving' 
                   : improvements.monthVsQuarter.productivityScoreChange < -5 ? 'declining' : 'stable',
        strength: Math.abs(improvements.monthVsQuarter.productivityScoreChange),
      }
    };

    return NextResponse.json({
      success: true,
      comparison,
      message: '生産性メトリクスの比較分析が完了しました',
    });

  } catch (error) {
    console.error('Productivity metrics comparison error:', error);
    
    return NextResponse.json(
      { 
        error: '生産性メトリクス比較の実行に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}