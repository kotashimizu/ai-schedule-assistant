import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TaskPriority, TaskStatus } from '@/types/shared';

/**
 * Helper function to categorize time estimation accuracy
 */
function getAccuracyCategory(estimated: number, actual: number): string {
  const ratio = estimated / actual;
  if (ratio >= 0.9 && ratio <= 1.1) return 'accurate';
  if (ratio > 1.1) return 'underestimated';
  if (ratio < 0.9) return 'overestimated';
  return 'unknown';
}

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
  postponeReason?: string;
  forceActualTime?: boolean; // Force set actual time even if auto-calculated
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
      
      // 開始時の処理
      if (body.status === 'in_progress' && existingTask.status !== 'in_progress') {
        updateData.started_at = new Date().toISOString();
        // Initialize time tracking data
        const currentSessions = existingTask.time_tracking_data?.sessions || [];
        updateData.time_tracking_data = {
          sessions: [...currentSessions, {
            started_at: new Date().toISOString(),
            status: 'active'
          }]
        };
      }
      
      // 完了時の処理
      if (body.status === 'completed' && existingTask.status !== 'completed') {
        updateData.completed_at = new Date().toISOString();
        
        // Auto-calculate actual time if not manually provided and we have start time
        if (body.actualMinutes === undefined && !body.forceActualTime && existingTask.started_at) {
          const startTime = new Date(existingTask.started_at);
          const completionTime = new Date();
          const autoCalculatedMinutes = Math.round((completionTime.getTime() - startTime.getTime()) / (1000 * 60));
          updateData.actual_minutes = autoCalculatedMinutes;
        }
        
        // Store completion metadata for analysis
        const estimatedMinutes = body.estimatedMinutes ?? existingTask.estimated_minutes;
        const actualMinutes = body.actualMinutes ?? updateData.actual_minutes;
        
        updateData.completion_metadata = {
          completed_at: new Date().toISOString(),
          estimated_vs_actual: estimatedMinutes && actualMinutes ? {
            estimated: estimatedMinutes,
            actual: actualMinutes,
            difference_minutes: actualMinutes - estimatedMinutes,
            efficiency_ratio: Number((estimatedMinutes / actualMinutes).toFixed(2)),
            accuracy_category: getAccuracyCategory(estimatedMinutes, actualMinutes)
          } : null,
          was_postponed: (existingTask.postpone_count || 0) > 0,
          postpone_count: existingTask.postpone_count || 0,
          completion_context: {
            day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            hour_of_day: new Date().getHours(),
            was_scheduled: !!existingTask.scheduled_date,
            was_due: !!existingTask.due_date,
            overdue: existingTask.due_date ? new Date() > new Date(existingTask.due_date) : false
          }
        };
      }
      
      // 完了から他のステータスに戻す場合
      if (body.status !== 'completed' && existingTask.status === 'completed') {
        updateData.completed_at = null;
        // Keep completion_metadata for historical analysis but mark as incomplete
        if (existingTask.completion_metadata) {
          updateData.completion_metadata = {
            ...existingTask.completion_metadata,
            reverted_at: new Date().toISOString(),
            status: 'reverted'
          };
        }
      }
      
      // Update time tracking for status changes
      if (existingTask.status === 'in_progress' && body.status !== 'in_progress') {
        // Close current session when leaving in_progress status
        const currentData = existingTask.time_tracking_data || { sessions: [] };
        const sessions = currentData.sessions || [];
        const activeSession = sessions.find((s: any) => s.status === 'active');
        
        if (activeSession) {
          activeSession.ended_at = new Date().toISOString();
          activeSession.status = 'completed';
          activeSession.duration_minutes = Math.round(
            (new Date().getTime() - new Date(activeSession.started_at).getTime()) / (1000 * 60)
          );
        }
        
        updateData.time_tracking_data = {
          ...currentData,
          sessions: sessions
        };
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
    
    if (body.postponeReason !== undefined) {
      updateData.postpone_reason = body.postponeReason ? body.postponeReason.substring(0, 500) : null;
    }

    // 延期カウントの更新（スケジュール日が変更された場合）
    if (body.scheduledDate && existingTask.scheduled_date) {
      const oldScheduled = new Date(existingTask.scheduled_date);
      const newScheduled = new Date(body.scheduledDate);
      if (newScheduled > oldScheduled) {
        updateData.postpone_count = (existingTask.postpone_count || 0) + 1;
        // Store postponement reason if provided
        if (body.postponeReason) {
          updateData.postpone_reason = body.postponeReason.substring(0, 500);
        }
      }
    }
    
    // New postponement without schedule change (manual postpone)
    if (body.postponeReason && !body.scheduledDate) {
      updateData.postpone_count = (existingTask.postpone_count || 0) + 1;
      updateData.postpone_reason = body.postponeReason.substring(0, 500);
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

    // Enhanced analytics logging
    const analyticsData = {
      task_id: taskId,
      changes: Object.keys(updateData).filter(key => key !== 'updated_at'),
      status_changed: body.status !== undefined,
      completed: body.status === 'completed',
      postponed: updateData.postpone_count > (existingTask.postpone_count || 0),
      time_tracking: {
        started: body.status === 'in_progress' && existingTask.status !== 'in_progress',
        actual_time_recorded: body.actualMinutes !== undefined,
        auto_calculated_time: body.actualMinutes === undefined && updateData.actual_minutes !== undefined,
        time_accuracy: updateData.completion_metadata?.estimated_vs_actual?.accuracy_category || null,
        efficiency_ratio: updateData.completion_metadata?.estimated_vs_actual?.efficiency_ratio || null,
      },
      scheduling: {
        was_scheduled: !!existingTask.scheduled_date,
        was_rescheduled: body.scheduledDate !== undefined && existingTask.scheduled_date !== body.scheduledDate,
        postpone_reason_provided: !!body.postponeReason,
      }
    };

    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'task_updated',
        event_data: analyticsData,
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