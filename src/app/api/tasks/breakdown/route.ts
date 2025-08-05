import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface TaskBreakdownRequest {
  originalTaskId: string;
  subtasks: {
    title: string;
    description: string;
    estimatedMinutes: number;
    priority: 'high' | 'medium' | 'low';
    category: string | null;
  }[];
  breakdownReason?: string;
}

/**
 * タスク分割実行API
 * POST /api/tasks/breakdown - 分析結果に基づいてタスクをサブタスクに分割
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as TaskBreakdownRequest;
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const { originalTaskId, subtasks, breakdownReason } = body;

    if (!originalTaskId || !subtasks || subtasks.length === 0) {
      return NextResponse.json(
        { error: 'originalTaskIdとsubtasksは必須です' },
        { status: 400 }
      );
    }

    // Get original task
    const { data: originalTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', originalTaskId)
      .eq('user_id', user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: '元のタスクが見つかりません' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Start transaction-like operations
    const createdSubtasks = [];
    const now = new Date().toISOString();

    // Create subtasks
    for (let i = 0; i < subtasks.length; i++) {
      const subtask = subtasks[i];
      
      // Validate subtask data
      if (!subtask.title || subtask.title.trim().length === 0) {
        return NextResponse.json(
          { error: `サブタスク${i + 1}のタイトルが必要です` },
          { status: 400 }
        );
      }

      if (subtask.estimatedMinutes <= 0 || subtask.estimatedMinutes > 480) {
        return NextResponse.json(
          { error: `サブタスク${i + 1}の見積時間は1分から8時間の間で設定してください` },
          { status: 400 }
        );
      }

      const subtaskData = {
        user_id: user.id,
        title: subtask.title.substring(0, 500),
        description: subtask.description ? subtask.description.substring(0, 2000) : null,
        estimated_minutes: subtask.estimatedMinutes,
        priority: subtask.priority,
        category: subtask.category,
        status: 'pending',
        parent_task_id: originalTaskId,
        // Inherit some properties from original task
        due_date: originalTask.due_date,
        scheduled_date: i === 0 ? originalTask.scheduled_date : null, // Only first subtask gets original schedule
        created_at: now,
        updated_at: now,
      };

      const { data: createdSubtask, error: createError } = await supabase
        .from('tasks')
        .insert(subtaskData)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      createdSubtasks.push(createdSubtask);
    }

    // Update original task status to cancelled and add breakdown metadata
    const { data: updatedOriginalTask, error: updateError } = await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        updated_at: now,
        breakdown_metadata: {
          broken_down_at: now,
          breakdown_reason: breakdownReason || 'タスクが複雑すぎるため、より小さなタスクに分割しました',
          subtask_count: subtasks.length,
          subtask_ids: createdSubtasks.map(st => st.id),
          original_estimated_minutes: originalTask.estimated_minutes,
          new_total_estimated_minutes: subtasks.reduce((sum, st) => sum + st.estimatedMinutes, 0),
        }
      })
      .eq('id', originalTaskId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log the breakdown action
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'task_broken_down',
        event_data: {
          original_task_id: originalTaskId,
          original_title: originalTask.title,
          subtask_count: createdSubtasks.length,
          subtask_ids: createdSubtasks.map(st => st.id),
          postpone_count: originalTask.postpone_count,
          breakdown_reason: breakdownReason,
          estimated_time_change: {
            original: originalTask.estimated_minutes,
            new_total: subtasks.reduce((sum, st) => sum + st.estimatedMinutes, 0),
          }
        },
      });

    return NextResponse.json({
      success: true,
      originalTask: updatedOriginalTask,
      subtasks: createdSubtasks,
      message: `タスクを${createdSubtasks.length}個のサブタスクに分割しました`,
    });

  } catch (error) {
    console.error('Task breakdown error:', error);
    
    return NextResponse.json(
      { 
        error: 'タスク分割の実行に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * タスク分割履歴の取得API
 * GET /api/tasks/breakdown?parentId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    if (parentId) {
      // Get subtasks for a specific parent task
      const { data: subtasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('parent_task_id', parentId)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        subtasks,
        parentId,
      });
    } else {
      // Get all broken down tasks (parent tasks that have been cancelled due to breakdown)
      const { data: brokenDownTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'cancelled')
        .not('breakdown_metadata', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        brokenDownTasks,
      });
    }

  } catch (error) {
    console.error('Task breakdown retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'タスク分割履歴の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}