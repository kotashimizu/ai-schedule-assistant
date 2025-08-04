import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openaiClient, mockOpenAIClient } from '@/lib/openai';

/**
 * AI提案フィードバックシステムAPI
 * POST /api/ai/feedback
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
    const { 
      taskId,
      suggestionId,
      feedback,
      rating,
      adopted,
      reason,
      actualTime,
      difficulty 
    } = body;

    if (!taskId || !feedback) {
      return NextResponse.json(
        { error: 'タスクIDとフィードバックが必要です' },
        { status: 400 }
      );
    }

    // フィードバックデータを保存
    const feedbackData = {
      user_id: user.id,
      task_id: taskId,
      suggestion_id: suggestionId,
      feedback_type: feedback, // 'positive' | 'negative' | 'neutral'
      rating: rating || null, // 1-5
      adopted: adopted || false,
      reason: reason || null,
      actual_time: actualTime || null,
      difficulty: difficulty || null, // 'easy' | 'medium' | 'hard'
      created_at: new Date().toISOString(),
    };

    const { data: savedFeedback, error: saveError } = await supabase
      .from('ai_feedback')
      .insert(feedbackData)
      .select()
      .single();

    if (saveError) {
      throw saveError;
    }

    // フィードバックを分析ログに記録
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        action: 'ai_feedback_submitted',
        data: {
          feedback_type: feedback,
          rating,
          adopted,
          has_reason: !!reason,
        },
      });

    // 定期的なフィードバック分析をトリガー
    const shouldAnalyze = await checkIfAnalysisNeeded(supabase, user.id);
    let analysisResult = null;

    if (shouldAnalyze) {
      analysisResult = await performFeedbackAnalysis(supabase, user.id);
    }

    return NextResponse.json({
      success: true,
      feedback: savedFeedback,
      analysis_triggered: shouldAnalyze,
      analysis_result: analysisResult,
      message: 'フィードバックを受け付けました',
    });

  } catch (error) {
    console.error('AIフィードバックエラー:', error);
    
    return NextResponse.json(
      { 
        error: 'フィードバックの保存に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * フィードバック統計取得API
 * GET /api/ai/feedback
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
    const period = searchParams.get('period') || '30'; // days
    const includeDetails = searchParams.get('details') === 'true';

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // フィードバックデータを取得
    let query = supabase
      .from('ai_feedback')
      .select(`
        *,
        tasks:task_id(
          title,
          priority,
          status,
          estimated_time
        )
      `)
      .eq('user_id', user.id)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (!includeDetails) {
      query = query.limit(100);
    }

    const { data: feedbacks, error } = await query;

    if (error) {
      throw error;
    }

    // 統計情報を計算
    const stats = calculateFeedbackStats(feedbacks || []);

    // 最新の分析結果を取得
    const { data: latestAnalysis } = await supabase
      .from('ai_analysis_results')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      statistics: stats,
      recent_feedbacks: includeDetails ? feedbacks : feedbacks?.slice(0, 10),
      latest_analysis: latestAnalysis,
      period_days: parseInt(period),
      total_feedback_count: feedbacks?.length || 0,
    });

  } catch (error) {
    console.error('フィードバック統計エラー:', error);
    
    return NextResponse.json(
      { error: 'フィードバック統計の取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 定期的な分析が必要かチェック
 */
async function checkIfAnalysisNeeded(supabase: any, userId: string): Promise<boolean> {
  // フィードバック数をチェック
  const { count: totalFeedback } = await supabase
    .from('ai_feedback')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);

  // 100件以上のフィードバックがあるか
  if ((totalFeedback || 0) < 100) {
    return false;
  }

  // 最後の分析からの日数をチェック
  const { data: lastAnalysis } = await supabase
    .from('ai_analysis_results')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!lastAnalysis) {
    return true; // 初回分析
  }

  const daysSinceLastAnalysis = Math.floor(
    (Date.now() - new Date(lastAnalysis.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceLastAnalysis >= 30; // 30日ごとに分析
}

/**
 * フィードバック分析を実行
 */
async function performFeedbackAnalysis(supabase: any, userId: string) {
  try {
    // 過去30日のフィードバックを取得
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentFeedbacks } = await supabase
      .from('ai_feedback')
      .select(`
        *,
        tasks:task_id(
          title,
          priority,
          status,
          estimated_time
        )
      `)
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (!recentFeedbacks || recentFeedbacks.length < 10) {
      return null; // 分析に十分なデータがない
    }

    // タスク完了データを取得
    const { data: completedTasks } = await supabase
      .from('tasks')
      .select('title, estimated_time, actual_time, priority, updated_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('updated_at', thirtyDaysAgo.toISOString());

    // 延期タスクデータを取得
    const { data: postponedTasks } = await supabase
      .from('tasks')
      .select('title, postpone_count, postpone_reason')
      .eq('user_id', userId)
      .gte('postpone_count', 1)
      .gte('updated_at', thirtyDaysAgo.toISOString());

    // AI分析を実行
    const useMock = process.env.NODE_ENV === 'development' || !process.env.OPENAI_API_KEY;
    const aiClient = useMock ? mockOpenAIClient : openaiClient;

    const analysisResult = await aiClient.analyzeTaskPerformance(
      (completedTasks || []).map(task => ({
        title: task.title,
        estimatedTime: task.estimated_time || 30,
        actualTime: task.actual_time || task.estimated_time || 30,
        priority: task.priority,
        completedAt: task.updated_at,
      })),
      (postponedTasks || []).map(task => ({
        title: task.title,
        postponeCount: task.postpone_count,
        reason: task.postpone_reason,
      }))
    );

    // 分析結果を保存
    const { data: savedAnalysis } = await supabase
      .from('ai_analysis_results')
      .insert({
        user_id: userId,
        analysis_type: 'task_performance',
        insights: analysisResult.insights,
        recommendations: analysisResult.recommendations,
        productivity_score: analysisResult.productivityScore,
        feedback_count: recentFeedbacks.length,
        completed_tasks_count: completedTasks?.length || 0,
        postponed_tasks_count: postponedTasks?.length || 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    return savedAnalysis;

  } catch (error) {
    console.error('フィードバック分析エラー:', error);
    return null;
  }
}

/**
 * フィードバック統計を計算
 */
function calculateFeedbackStats(feedbacks: any[]) {
  const total = feedbacks.length;
  
  if (total === 0) {
    return {
      total_feedback: 0,
      adoption_rate: 0,
      average_rating: 0,
      sentiment_breakdown: { positive: 0, neutral: 0, negative: 0 },
      difficulty_breakdown: { easy: 0, medium: 0, hard: 0 },
    };
  }

  const adopted = feedbacks.filter(f => f.adopted).length;
  const adoptionRate = Math.round((adopted / total) * 100);

  const ratings = feedbacks.filter(f => f.rating).map(f => f.rating);
  const averageRating = ratings.length > 0 
    ? Math.round((ratings.reduce((sum, r) => sum + r, 0) / ratings.length) * 10) / 10
    : 0;

  const sentimentCounts = {
    positive: feedbacks.filter(f => f.feedback_type === 'positive').length,
    neutral: feedbacks.filter(f => f.feedback_type === 'neutral').length,
    negative: feedbacks.filter(f => f.feedback_type === 'negative').length,
  };

  const difficultyCounts = {
    easy: feedbacks.filter(f => f.difficulty === 'easy').length,
    medium: feedbacks.filter(f => f.difficulty === 'medium').length,
    hard: feedbacks.filter(f => f.difficulty === 'hard').length,
  };

  return {
    total_feedback: total,
    adoption_rate: adoptionRate,
    average_rating: averageRating,
    sentiment_breakdown: sentimentCounts,
    difficulty_breakdown: difficultyCounts,
  };
}
