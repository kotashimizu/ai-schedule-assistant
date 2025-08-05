import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { DiscordWebhookClient, TaskNotificationBuilder } from '@/lib/notifications/discord';

interface DailySummaryRequest {
  date?: string; // YYYY-MM-DD format
  testMode?: boolean;
  sendDiscord?: boolean;
}

/**
 * 日次サマリー生成・送信API
 * POST /api/notifications/daily-summary - 18:00自動サマリーの生成と送信
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const body = await request.json() as DailySummaryRequest;
    const { date, testMode = false, sendDiscord = true } = body;

    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 1. 今日のタスク統計を取得
    const [completedTasksResult, totalTasksResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, priority, category, estimated_minutes, actual_minutes, completed_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .gte('completed_at', startOfDay.toISOString())
        .lte('completed_at', endOfDay.toISOString()),
      
      supabase
        .from('tasks')
        .select('id, status, priority, category')
        .eq('user_id', user.id)
        .or(`created_at.gte.${startOfDay.toISOString()},scheduled_date.gte.${startOfDay.toISOString()}`)
        .or(`created_at.lte.${endOfDay.toISOString()},scheduled_date.lte.${endOfDay.toISOString()}`)
    ]);

    const completedTasks = completedTasksResult.data || [];
    const allTasks = totalTasksResult.data || [];
    const totalTasks = allTasks.length;
    const completionRate = totalTasks > 0 ? completedTasks.length / totalTasks : 0;

    // 2. カテゴリ別統計を計算
    const categoryStats: { [key: string]: number } = {};
    completedTasks.forEach(task => {
      const category = task.category || 'その他';
      categoryStats[category] = (categoryStats[category] || 0) + 1;
    });

    const topCategories = Object.entries(categoryStats)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 3. 生産性スコアを計算
    let productivityScore = 0;
    
    // 完了率ベース (0-40点)
    productivityScore += completionRate * 40;
    
    // 高優先度タスク完了ボーナス (0-30点)
    const highPriorityCompleted = completedTasks.filter(t => t.priority === 'high').length;
    const highPriorityTotal = allTasks.filter(t => t.priority === 'high').length;
    if (highPriorityTotal > 0) {
      productivityScore += (highPriorityCompleted / highPriorityTotal) * 30;
    }
    
    // 時間見積もり精度ボーナス (0-20点)
    const tasksWithBothTimes = completedTasks.filter(t => t.estimated_minutes && t.actual_minutes);
    if (tasksWithBothTimes.length > 0) {
      const accuracyScore = tasksWithBothTimes.reduce((acc, task) => {
        const estimated = task.estimated_minutes;
        const actual = task.actual_minutes;
        const accuracy = 1 - Math.abs(estimated - actual) / Math.max(estimated, actual);
        return acc + Math.max(0, accuracy);
      }, 0) / tasksWithBothTimes.length;
      
      productivityScore += accuracyScore * 20;
    }
    
    // 継続ボーナス (0-10点)
    const recentDays = 7;
    const { data: recentSummaries } = await supabase
      .from('daily_summaries')
      .select('completion_rate')
      .eq('user_id', user.id)
      .gte('date', new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .lt('date', dateStr);
    
    if (recentSummaries && recentSummaries.length >= 3) {
      const avgRecentCompletion = recentSummaries.reduce((sum, s) => sum + s.completion_rate, 0) / recentSummaries.length;
      if (avgRecentCompletion >= 0.7) {
        productivityScore += 10;
      }
    }

    productivityScore = Math.round(Math.min(100, productivityScore));

    // 4. サマリーデータを作成
    const summaryData = {
      date: dateStr,
      completedTasks: completedTasks.length,
      totalTasks,
      completionRate,
      productivityScore,
      topCategories
    };

    // 5. データベースに保存
    const { data: savedSummary, error: saveError } = await supabase
      .from('daily_summaries')
      .upsert({
        user_id: user.id,
        date: dateStr,
        completed_tasks: completedTasks.length,
        total_tasks: totalTasks,
        completion_rate: completionRate,
        productivity_score: productivityScore,
        category_breakdown: topCategories,
        summary_data: {
          tasks: completedTasks.map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            category: t.category,
            completed_at: t.completed_at
          })),
          metrics: {
            high_priority_completed: highPriorityCompleted,
            high_priority_total: highPriorityTotal,
            tasks_with_time_tracking: tasksWithBothTimes.length
          }
        },
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,date'
      })
      .select()
      .single();

    if (saveError) {
      console.error('Failed to save daily summary:', saveError);
    }

    // 6. Discord通知を送信
    let discordSent = false;
    if (sendDiscord && !testMode) {
      const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
      if (webhookUrl) {
        try {
          const discordClient = new DiscordWebhookClient({
            webhookUrl,
            defaultUsername: 'AI Schedule Assistant',
            retryAttempts: 2
          });

          const embed = TaskNotificationBuilder.createDailySummary(summaryData);
          discordSent = await discordClient.sendEmbed(embed);

          // Discord送信ログ
          await supabase
            .from('notification_logs')
            .insert({
              user_id: user.id,
              type: 'daily_summary',
              title: `日次サマリー: ${dateStr}`,
              channels: ['discord'],
              notification_data: summaryData,
              status: discordSent ? 'sent' : 'failed',
              sent_at: new Date().toISOString()
            });

        } catch (discordError) {
          console.error('Discord notification failed:', discordError);
        }
      }
    }

    // 7. 未完了タスクのリスケジュール提案
    const incompleteTasks = allTasks.filter(t => t.status !== 'completed');
    let rescheduleSuggestions: any[] = [];
    
    if (incompleteTasks.length > 0 && !testMode) {
      // 翌日にリスケジュール提案を作成
      const tomorrow = new Date(targetDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { data: rescheduled } = await supabase
        .from('reschedule_suggestions')
        .insert({
          user_id: user.id,
          original_date: dateStr,
          suggested_date: tomorrow.toISOString().split('T')[0],
          incomplete_task_ids: incompleteTasks.map(t => t.id),
          reason: 'daily_summary_incomplete',
          suggestion_data: {
            incomplete_count: incompleteTasks.length,
            completion_rate: completionRate,
            generated_at: new Date().toISOString()
          },
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select();
      
      rescheduleSuggestions = rescheduled || [];
    }

    // 分析ログ
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'daily_summary_generated',
        event_data: {
          date: dateStr,
          ...summaryData,
          discord_sent: discordSent,
          reschedule_suggestions: rescheduleSuggestions.length,
          test_mode: testMode
        }
      });

    return NextResponse.json({
      success: true,
      message: `${dateStr}の日次サマリーを生成しました`,
      summary: summaryData,
      discordSent,
      rescheduleSuggestions: rescheduleSuggestions.length,
      insights: {
        message: getProductivityMessage(productivityScore, completionRate),
        recommendations: getRecommendations(summaryData, incompleteTasks.length)
      },
      testMode
    });

  } catch (error) {
    console.error('Daily summary generation error:', error);
    
    return NextResponse.json(
      { 
        error: '日次サマリー生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 日次サマリー履歴取得API
 * GET /api/notifications/daily-summary?limit=30&from=2024-01-01
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const from = searchParams.get('from');

    let query = supabase
      .from('daily_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(Math.min(limit, 100));

    if (from) {
      query = query.gte('date', from);
    }

    const { data: summaries, error } = await query;

    if (error) {
      console.error('Failed to fetch daily summaries:', error);
      return NextResponse.json(
        { error: '日次サマリー履歴の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 統計計算
    const stats = calculateSummaryStats(summaries || []);

    return NextResponse.json({
      success: true,
      summaries: summaries || [],
      count: summaries?.length || 0,
      stats
    });

  } catch (error) {
    console.error('Daily summary history error:', error);
    
    return NextResponse.json(
      { 
        error: '日次サマリー履歴取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// ヘルパー関数
function getProductivityMessage(score: number, completionRate: number): string {
  if (score >= 90) return '🎉 素晴らしい一日でした！この調子を保ちましょう。';
  if (score >= 70) return '👍 良い成果を上げました。明日も頑張りましょう！';
  if (score >= 50) return '📈 まずまずの成果です。改善の余地がありますね。';
  if (score >= 30) return '💪 今日は少し物足りませんでした。明日は頑張りましょう。';
  return '🔄 今日は思うような成果が得られませんでした。明日に向けて計画を見直しましょう。';
}

function getRecommendations(summary: any, incompleteCount: number): string[] {
  const recommendations: string[] = [];
  
  if (summary.completionRate < 0.5) {
    recommendations.push('タスクの量を見直し、より現実的な計画を立てましょう');
  }
  
  if (incompleteCount > 5) {
    recommendations.push('未完了タスクが多いです。優先度を明確にして焦点を絞りましょう');
  }
  
  if (summary.topCategories.length === 1) {
    recommendations.push('作業のバリエーションを増やすと、より充実した一日になります');
  }
  
  if (summary.productivityScore < 50) {
    recommendations.push('休憩を適切に取り、集中力を保つよう心がけましょう');
  }
  
  return recommendations;
}

function calculateSummaryStats(summaries: any[]) {
  if (summaries.length === 0) {
    return {
      avgCompletionRate: 0,
      avgProductivityScore: 0,
      totalCompletedTasks: 0,
      bestDay: null,
      streak: 0
    };
  }

  const avgCompletionRate = summaries.reduce((sum, s) => sum + s.completion_rate, 0) / summaries.length;
  const avgProductivityScore = summaries.reduce((sum, s) => sum + s.productivity_score, 0) / summaries.length;
  const totalCompletedTasks = summaries.reduce((sum, s) => sum + s.completed_tasks, 0);
  
  const bestDay = summaries.reduce((best, current) => 
    current.productivity_score > (best?.productivity_score || 0) ? current : best
  );

  // 連続達成日数計算（完了率70%以上）
  let streak = 0;
  for (const summary of summaries.slice().reverse()) {
    if (summary.completion_rate >= 0.7) {
      streak++;
    } else {
      break;
    }
  }

  return {
    avgCompletionRate: Number(avgCompletionRate.toFixed(3)),
    avgProductivityScore: Math.round(avgProductivityScore),
    totalCompletedTasks,
    bestDay: bestDay ? {
      date: bestDay.date,
      score: bestDay.productivity_score,
      completionRate: bestDay.completion_rate
    } : null,
    streak
  };
}