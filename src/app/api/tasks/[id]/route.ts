import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TaskPriority, TaskStatus } from '@/types/shared';

interface UpdateTaskRequest {
  title?: string;
  description?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
  category?: string;
  dueDate?: string;
  scheduledDate?: string;
  eventId?: string;
}

/**
 * 個別タスク操作API
 * GET /api/tasks/[id] - タスク詳細取得
 * PUT /api/tasks/[id] - タスク更新
 * DELETE /api/tasks/[id] - タスク削除
 */

/**
 * タスク詳細取得API
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    const taskId = params.id;

    const { data: task, error } = await supabase
      .from('tasks')
      .select(`
        *,
        events:event_id(
          id,
          title,
          start_time,
          end_time,
          location,
          description
        )
      `)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'タスクが見つかりません' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      task,
    });

  } catch (error) {
    console.error('タスク詳細取得エラー:', error);
    
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
 * タスク更新API
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    const taskId = params.id;

    // 既存タスクの確認
    const { data: existingTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'タスクが見つかりません' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    const body = await request.json() as UpdateTaskRequest;
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };

    // 更新データを準備
    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json(
          { error: 'タイトルは必須です' },
          { status: 400 }
        );
      }
      updateData.title = body.title.substring(0, 500);
    }

    if (body.description !== undefined) {
      updateData.description = body.description ? body.description.substring(0, 2000) : null;
    }

    if (body.estimatedMinutes !== undefined) {
      if (body.estimatedMinutes < 1 || body.estimatedMinutes > 480) {
        return NextResponse.json(
          { error: '予想時間は1分から8時間の間で設定してください' },
          { status: 400 }
        );
      }
      updateData.estimated_minutes = body.estimatedMinutes;
    }

    if (body.actualMinutes !== undefined) {
      if (body.actualMinutes < 0 || body.actualMinutes > 960) {
        return NextResponse.json(
          { error: '実際時間は0分から16時間の間で設定してください' },
          { status: 400 }
        );
      }
      updateData.actual_minutes = body.actualMinutes;
    }

    if (body.priority !== undefined) {
      if (!['high', 'medium', 'low'].includes(body.priority)) {
        return NextResponse.json(
          { error: '優先度は high, medium, low のいずれかを指定してください' },
          { status: 400 }
        );
      }
      updateData.priority = body.priority;
    }

    if (body.status !== undefined) {
      if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(body.status)) {
        return NextResponse.json(
          { error: 'ステータスは pending, in_progress, completed, cancelled のいずれかを指定してください' },
          { status: 400 }
        );
      }
      updateData.status = body.status;
      
      // 完了時の処理
      if (body.status === 'completed' && existingTask.status !== 'completed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      // 完了から他のステータスに戻す場合
      if (body.status !== 'completed' && existingTask.status === 'completed') {
        updateData.completed_at = null;
      }
    }

    if (body.category !== undefined) {
      updateData.category = body.category ? body.category.substring(0, 100) : null;
    }

    if (body.dueDate !== undefined) {
      updateData.due_date = body.dueDate ? new Date(body.dueDate).toISOString() : null;
    }

    if (body.scheduledDate !== undefined) {
      updateData.scheduled_date = body.scheduledDate ? new Date(body.scheduledDate).toISOString() : null;
    }

    if (body.eventId !== undefined) {
      updateData.event_id = body.eventId || null;
    }

    // 延期カウントの更新（スケジュール日が変更された場合）
    if (body.scheduledDate && existingTask.scheduled_date) {
      const oldScheduled = new Date(existingTask.scheduled_date);
      const newScheduled = new Date(body.scheduledDate);
      if (newScheduled > oldScheduled) {
        updateData.postpone_count = (existingTask.postpone_count || 0) + 1;
      }
    }

    // タスクを更新
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', user.id)
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

    // ログを記録
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'task_updated',
        event_data: {
          task_id: taskId,
          changes: Object.keys(updateData).filter(key => key !== 'updated_at'),
          status_changed: body.status !== undefined,
          completed: body.status === 'completed',
          postponed: updateData.postpone_count > (existingTask.postpone_count || 0),
        },
      });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: 'タスクを更新しました',
    });

  } catch (error) {
    console.error('タスク更新エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'タスクの更新に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * タスク削除API
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    const taskId = params.id;

    // 削除前にタスク情報を取得（ログ用）
    const { data: taskToDelete, error: fetchError } = await supabase
      .from('tasks')
      .select('title, status, priority, category')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'タスクが見つかりません' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // タスクを削除
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    // 削除ログを記録
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'task_deleted',
        event_data: {
          task_id: taskId,
          title: taskToDelete.title,
          status: taskToDelete.status,
          priority: taskToDelete.priority,
          category: taskToDelete.category,
          deleted_at: new Date().toISOString(),
        },
      });

    return NextResponse.json({
      success: true,
      message: 'タスクを削除しました',
    });

  } catch (error) {
    console.error('タスク削除エラー:', error);
    
    return NextResponse.json(
      { 
        error: 'タスクの削除に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}