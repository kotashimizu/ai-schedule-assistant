import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TaskStatus } from '@/types/shared';

interface BulkUpdateRequest {
  action: 'update_status' | 'delete' | 'reschedule';
  taskIds: string[];
  data?: {
    status?: TaskStatus;
    scheduledDate?: string;
    actualMinutes?: number;
  };
}

/**
 * タスク一括操作API
 * POST /api/tasks/bulk
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const body = await request.json() as BulkUpdateRequest;
    const { action, taskIds, data } = body;

    // バリデーション
    if (!action || !taskIds || taskIds.length === 0) {
      return NextResponse.json(
        { error: 'アクションとタスクIDリストが必要です' },
        { status: 400 }
      );
    }

    if (taskIds.length > 100) {
      return NextResponse.json(
        { error: '一度に操作できるタスクは100個までです' },
        { status: 400 }
      );
    }

    // ユーザーのタスクのみを対象にする
    const { data: userTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('id, title, status, postpone_count')
      .eq('user_id', user.id)
      .in('id', taskIds);

    if (fetchError) {
      throw fetchError;
    }

    const validTaskIds = userTasks?.map(task => task.id) || [];
    
    if (validTaskIds.length === 0) {
      return NextResponse.json(
        { error: '操作対象のタスクが見つかりません' },
        { status: 404 }
      );
    }

    let result;
    let logData;

    switch (action) {
      case 'update_status':
        if (!data?.status) {
          return NextResponse.json(
            { error: 'ステータスが指定されていません' },
            { status: 400 }
          );
        }

        if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(data.status)) {
          return NextResponse.json(
            { error: '無効なステータスです' },
            { status: 400 }
          );
        }

        const updateData: Record<string, any> = {
          status: data.status,
          updated_at: new Date().toISOString(),
        };

        // 完了時の処理
        if (data.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
          if (data.actualMinutes) {
            updateData.actual_minutes = data.actualMinutes;
          }
        }

        const { data: updatedTasks, error: updateError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('user_id', user.id)
          .in('id', validTaskIds)
          .select('id, title, status');

        if (updateError) {
          throw updateError;
        }

        result = updatedTasks;
        logData = {
          action: 'bulk_status_update',
          task_count: validTaskIds.length,
          new_status: data.status,
          updated_task_ids: validTaskIds,
        };
        break;

      case 'delete':
        const { error: deleteError } = await supabase
          .from('tasks')
          .delete()
          .eq('user_id', user.id)
          .in('id', validTaskIds);

        if (deleteError) {
          throw deleteError;
        }

        result = { deleted_count: validTaskIds.length };
        logData = {
          action: 'bulk_delete',
          task_count: validTaskIds.length,
          deleted_task_ids: validTaskIds,
          deleted_task_titles: userTasks?.map(t => t.title) || [],
        };
        break;

      case 'reschedule':
        if (!data?.scheduledDate) {
          return NextResponse.json(
            { error: 'スケジュール日が指定されていません' },
            { status: 400 }
          );
        }

        const rescheduleData = {
          scheduled_date: new Date(data.scheduledDate).toISOString(),
          updated_at: new Date().toISOString(),
        };

        // 延期カウントを更新（将来の日付にスケジュールされる場合）
        const scheduledDate = new Date(data.scheduledDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (scheduledDate > today) {
          // 既存の延期カウントを取得して更新
          const updatePromises = userTasks?.map(async (task) => {
            return supabase
              .from('tasks')
              .update({
                ...rescheduleData,
                postpone_count: (task.postpone_count || 0) + 1,
              })
              .eq('id', task.id)
              .eq('user_id', user.id);
          }) || [];

          await Promise.all(updatePromises);
        } else {
          const { data: rescheduledTasks, error: rescheduleError } = await supabase
            .from('tasks')
            .update(rescheduleData)
            .eq('user_id', user.id)
            .in('id', validTaskIds)
            .select('id, title, scheduled_date');

          if (rescheduleError) {
            throw rescheduleError;
          }

          result = rescheduledTasks;
        }

        logData = {
          action: 'bulk_reschedule',
          task_count: validTaskIds.length,
          new_scheduled_date: data.scheduledDate,
          task_ids: validTaskIds,
        };
        break;

      default:
        return NextResponse.json(
          { error: '無効なアクションです' },
          { status: 400 }
        );
    }

    // ログを記録
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'bulk_task_operation',
        event_data: logData,
      });

    return NextResponse.json({
      success: true,
      result,
      processed_count: validTaskIds.length,
      skipped_count: taskIds.length - validTaskIds.length,
      message: `${validTaskIds.length}個のタスクを${action === 'update_status' ? '更新' : action === 'delete' ? '削除' : 'リスケジュール'}しました`,
    });

  } catch (error) {
    console.error('一括タスク操作エラー:', error);
    
    return NextResponse.json(
      { 
        error: '一括操作に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}