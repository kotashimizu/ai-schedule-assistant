import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TaskPriority, TaskStatus } from '@/types/shared';

/**
 * タスクCRUD API
 * GET /api/tasks - タスク取得（フィルタリング対応）
 * POST /api/tasks - タスク作成
 */

interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  search?: string;
  category?: string;
  dueBefore?: string;
  dueAfter?: string;
  scheduledDate?: string;
}

interface CreateTaskRequest {
  title: string;
  description?: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  category?: string;
  dueDate?: string;
  scheduledDate?: string;
  eventId?: string;
}

/**
 * タスク取得API
 * GET /api/tasks?status=pending,in_progress&priority=high&search=会議
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 開発用: テスト用のユーザーIDを使用
    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const { searchParams } = new URL(request.url);
    
    // フィルターパラメータを解析
    const filters: TaskFilters = {
      status: searchParams.get('status')?.split(',') as TaskStatus[],
      priority: searchParams.get('priority')?.split(',') as TaskPriority[],
      search: searchParams.get('search') || undefined,
      category: searchParams.get('category') || undefined,
      dueBefore: searchParams.get('dueBefore') || undefined,
      dueAfter: searchParams.get('dueAfter') || undefined,
      scheduledDate: searchParams.get('scheduledDate') || undefined,
    };

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // クエリビルダーを開始
    let query = supabase
      .from('tasks')
      .select(`
        *,
        events:event_id(
          title,
          start_time,
          location
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // フィルターを適用
    if (filters.status?.length) {
      query = query.in('status', filters.status);
    }

    if (filters.priority?.length) {
      query = query.in('priority', filters.priority);
    }

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.dueBefore) {
      query = query.lte('due_date', filters.dueBefore);
    }

    if (filters.dueAfter) {
      query = query.gte('due_date', filters.dueAfter);
    }

    if (filters.scheduledDate) {
      const date = new Date(filters.scheduledDate);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      
      query = query
        .gte('scheduled_date', date.toISOString())
        .lt('scheduled_date', nextDay.toISOString());
    }

    // ページネーション
    query = query.range(offset, offset + limit - 1);

    const { data: tasks, error, count } = await query;

    if (error) {
      throw error;
    }

    // 統計情報を取得
    const { data: stats } = await supabase
      .from('tasks')
      .select('status, priority')
      .eq('user_id', user.id);

    const statistics = {
      total: count || 0,
      by_status: {
        pending: stats?.filter(t => t.status === 'pending').length || 0,
        in_progress: stats?.filter(t => t.status === 'in_progress').length || 0,
        completed: stats?.filter(t => t.status === 'completed').length || 0,
        cancelled: stats?.filter(t => t.status === 'cancelled').length || 0,
      },
      by_priority: {
        high: stats?.filter(t => t.priority === 'high').length || 0,
        medium: stats?.filter(t => t.priority === 'medium').length || 0,
        low: stats?.filter(t => t.priority === 'low').length || 0,
      },
    };

    return NextResponse.json({
      success: true,
      tasks: tasks || [],
      statistics,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      filters: filters,
    });

  } catch (error) {
    console.error('タスク取得エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'タスクの取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * タスク作成API
 * POST /api/tasks
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const body = await request.json() as CreateTaskRequest;
    const { 
      title,
      description,
      estimatedMinutes,
      priority,
      category,
      dueDate,
      scheduledDate,
      eventId
    } = body;

    // バリデーション
    if (!title || !estimatedMinutes || !priority) {
      return NextResponse.json(
        { error: 'タイトル、予想時間、優先度は必須です' },
        { status: 400 }
      );
    }

    if (estimatedMinutes < 1 || estimatedMinutes > 480) {
      return NextResponse.json(
        { error: '予想時間は1分から8時間の間で設定してください' },
        { status: 400 }
      );
    }

    if (!['high', 'medium', 'low'].includes(priority)) {
      return NextResponse.json(
        { error: '優先度は high, medium, low のいずれかを指定してください' },
        { status: 400 }
      );
    }

    // タスクデータを準備
    const taskData = {
      user_id: user.id,
      title: title.substring(0, 500), // 長さ制限
      description: description?.substring(0, 2000) || null,
      estimated_minutes: estimatedMinutes,
      priority,
      category: category?.substring(0, 100) || null,
      status: 'pending' as TaskStatus,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      event_id: eventId || null,
      postpone_count: 0,
      created_at: new Date().toISOString(),
    };

    const { data: newTask, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select(`
        *,
        events:event_id(
          title,
          start_time,
          location
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    // 作成ログを記録
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'task_created',
        event_data: {
          task_id: newTask.id,
          priority,
          category,
          estimated_minutes: estimatedMinutes,
          has_due_date: !!dueDate,
          has_scheduled_date: !!scheduledDate,
          linked_to_event: !!eventId,
        },
      });

    return NextResponse.json({
      success: true,
      task: newTask,
      message: 'タスクを作成しました',
    });

  } catch (error) {
    console.error('タスク作成エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'タスクの作成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}