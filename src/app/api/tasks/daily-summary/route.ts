import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface DailySummaryRequest {
  date?: string; // Optional, defaults to today
  includeReschedulingSuggestions?: boolean;
}

interface ReschedulingSuggestion {
  taskId: string;
  title: string;
  reason: 'overdue' | 'postponed_multiple' | 'high_priority_incomplete';
  suggestedDate: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Daily Task Summary API
 * GET /api/tasks/daily-summary - Get daily task completion summary
 * POST /api/tasks/daily-summary - Generate and store daily summary
 */

/**
 * Get daily task summary
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
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const includeRescheduling = searchParams.get('includeReschedulingSuggestions') === 'true';

    // Use the database function to get comprehensive summary
    const { data: summaryData, error: summaryError } = await supabase
      .rpc('get_daily_task_summary', {
        target_date: targetDate,
        target_user_id: user.id
      });

    if (summaryError) {
      throw summaryError;
    }

    let reschedulingSuggestions: ReschedulingSuggestion[] = [];

    if (includeRescheduling) {
      // Generate rescheduling suggestions for incomplete tasks
      const incompleteTasks = summaryData?.incomplete_tasks || [];
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      reschedulingSuggestions = incompleteTasks
        .filter((task: any) => task.suggest_reschedule)
        .map((task: any) => {
          let reason: ReschedulingSuggestion['reason'] = 'high_priority_incomplete';
          let suggestedDate = tomorrow.toISOString().split('T')[0];

          if (task.due_date && new Date(task.due_date) < today) {
            reason = 'overdue';
            suggestedDate = tomorrow.toISOString().split('T')[0]; // Urgent - tomorrow
          } else if (task.postpone_count >= 3) {
            reason = 'postponed_multiple';
            suggestedDate = nextWeek.toISOString().split('T')[0]; // Give more time
          } else if (task.priority === 'high') {
            reason = 'high_priority_incomplete';
            suggestedDate = tomorrow.toISOString().split('T')[0];
          }

          return {
            taskId: task.id,
            title: task.title,
            reason,
            suggestedDate,
            priority: task.priority
          };
        });
    }

    // Calculate performance insights
    const stats = summaryData?.summary_stats || {};
    const performanceInsights = {
      productivity_score: calculateProductivityScore(stats),
      time_estimation_accuracy: stats.average_efficiency || 0,
      completion_rate: stats.total_completed > 0 ? 
        (stats.total_completed / (stats.total_completed + (summaryData?.incomplete_tasks?.length || 0))) * 100 : 0,
      efficiency_trend: getEfficiencyTrend(stats.average_efficiency),
      recommendations: generateRecommendations(stats, summaryData?.completed_tasks || [])
    };

    const response = {
      success: true,
      summary: {
        date: targetDate,
        user_id: user.id,
        completed_tasks: summaryData?.completed_tasks || [],
        incomplete_tasks: summaryData?.incomplete_tasks || [],
        summary_stats: stats,
        performance_insights: performanceInsights,
        rescheduling_suggestions: reschedulingSuggestions,
        generated_at: new Date().toISOString()
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Daily summary retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'デイリーサマリーの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Generate and store daily summary (for automated 18:00 generation)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const body = await request.json() as DailySummaryRequest;
    const targetDate = body.date || new Date().toISOString().split('T')[0];

    // Generate the summary using the GET logic
    const summaryResponse = await GET(request);
    const summaryJson = await summaryResponse.json();

    if (!summaryJson.success) {
      throw new Error('Failed to generate summary data');
    }

    // Store the summary in the database
    const { data: storedSummary, error: insertError } = await supabase
      .from('daily_summaries')
      .upsert({
        user_id: user.id,
        summary_date: targetDate,
        summary_data: summaryJson.summary,
        generated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,summary_date'
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Log the summary generation
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'daily_summary_generated',
        event_data: {
          summary_date: targetDate,
          completed_tasks_count: summaryJson.summary.summary_stats.total_completed,
          incomplete_tasks_count: summaryJson.summary.incomplete_tasks.length,
          productivity_score: summaryJson.summary.performance_insights.productivity_score,
          auto_generated: request.headers.get('x-cron-trigger') === 'true'
        }
      });

    return NextResponse.json({
      success: true,
      summary: storedSummary,
      message: 'デイリーサマリーを生成・保存しました'
    });

  } catch (error) {
    console.error('Daily summary generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'デイリーサマリーの生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Helper functions
 */

function calculateProductivityScore(stats: any): number {
  const completed = stats.total_completed || 0;
  const actualTime = stats.total_actual_time || 0;
  const efficiency = stats.average_efficiency || 1;

  // Base score from completion count (0-50 points)
  const completionScore = Math.min(completed * 10, 50);
  
  // Efficiency bonus/penalty (0-30 points)
  let efficiencyScore = 15; // Neutral
  if (efficiency >= 0.9 && efficiency <= 1.1) {
    efficiencyScore = 30; // Perfect estimation
  } else if (efficiency >= 0.8 && efficiency <= 1.2) {
    efficiencyScore = 20; // Good estimation
  } else if (efficiency < 0.7 || efficiency > 1.5) {
    efficiencyScore = 5; // Poor estimation
  }

  // Time investment bonus (0-20 points)
  const timeScore = Math.min(actualTime / 60 * 2, 20); // 2 points per hour worked

  return Math.round(completionScore + efficiencyScore + timeScore);
}

function getEfficiencyTrend(averageEfficiency: number): string {
  if (!averageEfficiency) return 'insufficient_data';
  if (averageEfficiency >= 0.9 && averageEfficiency <= 1.1) return 'accurate';
  if (averageEfficiency > 1.1) return 'underestimating';
  if (averageEfficiency < 0.9) return 'overestimating';
  return 'inconsistent';
}

function generateRecommendations(stats: any, completedTasks: any[]): string[] {
  const recommendations: string[] = [];
  const efficiency = stats.average_efficiency || 1;
  const completed = stats.total_completed || 0;
  const postponed = stats.tasks_postponed || 0;

  if (efficiency < 0.8) {
    recommendations.push('タスクの時間見積もりを長めに設定することをお勧めします');
  } else if (efficiency > 1.3) {
    recommendations.push('タスクをより細かく分割して、より正確な時間見積もりを行いましょう');
  }

  if (completed === 0) {
    recommendations.push('明日は1つでも良いので、小さなタスクから始めてみましょう');
  } else if (completed >= 5) {
    recommendations.push('素晴らしい生産性です！この調子を維持しましょう');
  }

  if (postponed > 2) {
    recommendations.push('延期が多いタスクは、より小さな単位に分割することを検討してください');
  }

  // Analyze completion patterns
  const completionHours = completedTasks.map((task: any) => 
    new Date(task.completed_at).getHours()
  );
  
  if (completionHours.length > 0) {
    const avgHour = completionHours.reduce((a, b) => a + b, 0) / completionHours.length;
    if (avgHour > 18) {
      recommendations.push('夜遅くの作業が多いようです。より早い時間帯でのタスク完了を目指しましょう');
    } else if (avgHour < 10) {
      recommendations.push('朝の生産性が高いようです！この時間帯を活用して重要なタスクを進めましょう');
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('バランスの取れた1日でした。この調子で継続しましょう！');
  }

  return recommendations;
}