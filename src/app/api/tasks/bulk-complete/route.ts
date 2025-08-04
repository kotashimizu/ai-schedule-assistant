import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface BulkCompleteRequest {
  taskIds: string[];
  actualMinutes?: { [taskId: string]: number }; // Optional actual time per task
  completionNotes?: { [taskId: string]: string }; // Optional notes per task
  markAllAsCompleted?: boolean; // If true, complete all provided tasks
}

interface TaskCompletionResult {
  taskId: string;
  title: string;
  success: boolean;
  error?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  efficiencyRatio?: number;
  accuracyCategory?: string;
}

/**
 * Bulk Task Completion API
 * POST /api/tasks/bulk-complete - Complete multiple tasks with enhanced tracking
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const testUserId = 'test-user-123';
    const user = { id: testUserId };

    const body = await request.json() as BulkCompleteRequest;
    const { taskIds, actualMinutes = {}, completionNotes = {}, markAllAsCompleted = false } = body;

    // Validation
    if (!taskIds || taskIds.length === 0) {
      return NextResponse.json(
        { error: 'タスクIDリストが必要です' },
        { status: 400 }
      );
    }

    if (taskIds.length > 50) {
      return NextResponse.json(
        { error: '一度に完了できるタスクは50個までです' },
        { status: 400 }
      );
    }

    // Fetch user's tasks
    const { data: userTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('id', taskIds);

    if (fetchError) {
      throw fetchError;
    }

    if (!userTasks || userTasks.length === 0) {
      return NextResponse.json(
        { error: '操作対象のタスクが見つかりません' },
        { status: 404 }
      );
    }

    const results: TaskCompletionResult[] = [];
    const completionTime = new Date().toISOString();
    let successCount = 0;

    // Process each task individually for detailed tracking
    for (const task of userTasks) {
      try {
        // Skip already completed tasks unless forcing completion
        if (task.status === 'completed' && !markAllAsCompleted) {
          results.push({
            taskId: task.id,
            title: task.title,
            success: false,
            error: 'Task already completed'
          });
          continue;
        }

        // Calculate actual time
        let calculatedActualTime = actualMinutes[task.id];
        
        // Auto-calculate if not provided and task was started
        if (calculatedActualTime === undefined && task.started_at) {
          const startTime = new Date(task.started_at);
          const endTime = new Date();
          calculatedActualTime = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        }

        // Prepare completion metadata
        const estimatedMinutes = task.estimated_minutes;
        const completionMetadata: any = {
          completed_at: completionTime,
          bulk_completion: true,
          completion_context: {
            day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            hour_of_day: new Date().getHours(),
            was_scheduled: !!task.scheduled_date,
            was_due: !!task.due_date,
            overdue: task.due_date ? new Date() > new Date(task.due_date) : false,
            completion_method: 'bulk_api'
          }
        };

        let efficiencyRatio: number | undefined;
        let accuracyCategory: string | undefined;

        // Calculate efficiency metrics if both times are available
        if (estimatedMinutes && calculatedActualTime) {
          efficiencyRatio = Number((estimatedMinutes / calculatedActualTime).toFixed(2));
          accuracyCategory = getAccuracyCategory(estimatedMinutes, calculatedActualTime);
          
          completionMetadata.estimated_vs_actual = {
            estimated: estimatedMinutes,
            actual: calculatedActualTime,
            difference_minutes: calculatedActualTime - estimatedMinutes,
            efficiency_ratio: efficiencyRatio,
            accuracy_category: accuracyCategory
          };
        }

        // Add completion notes if provided
        if (completionNotes[task.id]) {
          completionMetadata.completion_notes = completionNotes[task.id];
        }

        completionMetadata.was_postponed = (task.postpone_count || 0) > 0;
        completionMetadata.postpone_count = task.postpone_count || 0;

        // Update task in database
        const updateData: any = {
          status: 'completed',
          completed_at: completionTime,
          completion_metadata: completionMetadata,
          updated_at: completionTime
        };

        if (calculatedActualTime !== undefined) {
          updateData.actual_minutes = calculatedActualTime;
        }

        // Close any active time tracking session
        if (task.time_tracking_data?.sessions) {
          const sessions = [...task.time_tracking_data.sessions];
          const activeSession = sessions.find((s: any) => s.status === 'active');
          
          if (activeSession) {
            activeSession.ended_at = completionTime;
            activeSession.status = 'completed';
            activeSession.duration_minutes = calculatedActualTime || 0;
          }
          
          updateData.time_tracking_data = {
            ...task.time_tracking_data,
            sessions: sessions
          };
        }

        const { error: updateError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', task.id)
          .eq('user_id', user.id);

        if (updateError) {
          throw updateError;
        }

        results.push({
          taskId: task.id,
          title: task.title,
          success: true,
          estimatedMinutes,
          actualMinutes: calculatedActualTime,
          efficiencyRatio,
          accuracyCategory
        });

        successCount++;

      } catch (taskError) {
        console.error(`Error completing task ${task.id}:`, taskError);
        results.push({
          taskId: task.id,
          title: task.title,
          success: false,
          error: taskError instanceof Error ? taskError.message : 'Unknown error'
        });
      }
    }

    // Calculate bulk completion statistics
    const completedResults = results.filter(r => r.success);
    const totalEstimatedTime = completedResults.reduce((sum, r) => sum + (r.estimatedMinutes || 0), 0);
    const totalActualTime = completedResults.reduce((sum, r) => sum + (r.actualMinutes || 0), 0);
    const averageEfficiency = completedResults.length > 0 ? 
      completedResults.reduce((sum, r) => sum + (r.efficiencyRatio || 1), 0) / completedResults.length : 1;

    const bulkStats = {
      tasks_processed: taskIds.length,
      tasks_completed: successCount,
      tasks_failed: taskIds.length - successCount,
      total_estimated_time: totalEstimatedTime,
      total_actual_time: totalActualTime,
      average_efficiency: Number(averageEfficiency.toFixed(2)),
      accuracy_distribution: {
        accurate: completedResults.filter(r => r.accuracyCategory === 'accurate').length,
        underestimated: completedResults.filter(r => r.accuracyCategory === 'underestimated').length,
        overestimated: completedResults.filter(r => r.accuracyCategory === 'overestimated').length,
        unknown: completedResults.filter(r => !r.accuracyCategory).length
      }
    };

    // Log bulk completion event
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'bulk_task_completion',
        event_data: {
          ...bulkStats,
          task_ids: taskIds,
          completion_timestamp: completionTime,
          individual_results: results.map(r => ({
            task_id: r.taskId,
            success: r.success,
            efficiency_ratio: r.efficiencyRatio,
            accuracy_category: r.accuracyCategory
          }))
        }
      });

    return NextResponse.json({
      success: true,
      results,
      statistics: bulkStats,
      message: `${successCount}個のタスクを完了しました`
    });

  } catch (error) {
    console.error('Bulk completion error:', error);
    
    return NextResponse.json(
      { 
        error: 'タスクの一括完了に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

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