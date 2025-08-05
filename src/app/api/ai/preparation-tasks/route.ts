import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { openaiClient, mockOpenAIClient } from '@/lib/openai';
import { AITaskSuggestion } from '@/types/shared';

/**
 * AI準備タスク生成API
 * POST /api/ai/preparation-tasks
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 開発用: テスト用のユーザーIDを使用
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const body = await request.json();
    const { 
      eventId,
      eventTitle,
      eventDescription,
      eventStartTime,
      eventLocation 
    } = body;

    if (!eventTitle || !eventStartTime) {
      return NextResponse.json(
        { error: 'イベントタイトルと開始時間が必要です' },
        { status: 400 }
      );
    }

    // ユーザーの過去の類似タスクを取得
    const { data: pastTasks } = await supabase
      .from('tasks')
      .select('title, description')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .ilike('title', `%${eventTitle.split(' ')[0]}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    const userContext = {
      pastTasks: pastTasks?.map(t => t.title) || [],
      preferences: [], // TODO: ユーザー設定から取得
    };

    // 開発モードではmockClient、本番ではopenaiClientを使用
    const useMock = process.env.NODE_ENV === 'development' || !process.env.OPENAI_API_KEY;
    const aiClient = useMock ? mockOpenAIClient : openaiClient;

    // AIによる準備タスク生成
    const suggestions = await aiClient.generatePreparationTasks(
      {
        title: eventTitle,
        description: eventDescription,
        startTime: eventStartTime,
        location: eventLocation,
      },
      userContext
    );

    // 生成されたタスクをデータベースに保存（オプション）
    const tasksToInsert = suggestions.map(suggestion => ({
      user_id: user.id,
      title: suggestion.title,
      description: suggestion.description,
      priority: suggestion.priority,
      estimated_time: suggestion.estimated_time,
      status: 'pending',
      related_event_id: eventId || null,
      created_by_ai: true,
      ai_reasoning: suggestion.reasoning,
    }));

    // タスクを一括挿入
    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select();

    if (insertError) {
      console.error('タスク保存エラー:', insertError);
    }

    // AI使用量をログに記録
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        action: 'ai_preparation_tasks_generated',
        data: {
          event_title: eventTitle,
          suggestions_count: suggestions.length,
          used_mock: useMock,
        },
      });

    return NextResponse.json({
      success: true,
      suggestions,
      saved_tasks: insertedTasks,
      metadata: {
        generated_at: new Date().toISOString(),
        event_id: eventId,
        user_context_used: userContext.pastTasks.length > 0,
        used_mock_ai: useMock,
      },
    });

  } catch (error) {
    console.error('AI準備タスク生成エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'AIタスク生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 準備タスク履歴取得API
 * GET /api/ai/preparation-tasks
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
    const eventId = searchParams.get('eventId');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = supabase
      .from('tasks')
      .select(`
        *,
        events:related_event_id(
          title,
          start_time,
          location
        )
      `)
      .eq('user_id', user.id)
      .eq('created_by_ai', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (eventId) {
      query = query.eq('related_event_id', eventId);
    }

    const { data: aiTasks, error } = await query;

    if (error) {
      throw error;
    }

    // 統計情報を取得
    const { data: stats } = await supabase
      .from('analytics_logs')
      .select('created_at, data')
      .eq('user_id', user.id)
      .eq('action', 'ai_preparation_tasks_generated')
      .order('created_at', { ascending: false })
      .limit(30);

    const completionRate = aiTasks?.length > 0 
      ? aiTasks.filter(task => task.status === 'completed').length / aiTasks.length 
      : 0;

    return NextResponse.json({
      success: true,
      tasks: aiTasks,
      statistics: {
        total_generated: stats?.length || 0,
        completion_rate: Math.round(completionRate * 100),
        last_generated: stats?.[0]?.created_at,
        monthly_usage: stats?.filter(s => 
          new Date(s.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length || 0,
      },
    });

  } catch (error) {
    console.error('準備タスク履歴取得エラー:', error);
    
    return NextResponse.json(
      { error: 'タスク履歴の取得に失敗しました' },
      { status: 500 }
    );
  }
}
