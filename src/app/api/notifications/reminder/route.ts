import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface ReminderRequest {
  userId?: string;
  checkTime?: string; // 特定時刻のリマインダーチェック用
}

interface EventReminder {
  id: string;
  title: string;
  start_time: string;
  location?: string;
  description?: string;
}

interface TaskReminder {
  id: string;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  scheduled_date?: string;
  estimated_minutes?: number;
}

/**
 * リマインダー生成と通知API
 * POST /api/notifications/reminder - 現在時刻からのリマインダーをチェックして通知を生成
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as ReminderRequest;
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const checkTime = body.checkTime ? new Date(body.checkTime) : new Date();
    const reminderResults = {
      eventsReminders: [] as any[],
      taskReminders: [] as any[],
      urgentTaskReminders: [] as any[],
      totalScheduled: 0,
    };

    // 1. イベントリマインダー（15分前）
    const eventReminderTime = new Date(checkTime.getTime() + 15 * 60 * 1000);
    const eventReminderStart = new Date(eventReminderTime.getTime() - 2 * 60 * 1000); // 2分の幅
    const eventReminderEnd = new Date(eventReminderTime.getTime() + 2 * 60 * 1000);

    const { data: upcomingEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', eventReminderStart.toISOString())
      .lte('start_time', eventReminderEnd.toISOString());

    if (eventsError) {
      console.error('Error fetching upcoming events:', eventsError);
    } else if (upcomingEvents) {
      for (const event of upcomingEvents) {
        // 既に同じイベントの通知が送信されていないかチェック
        const { data: existingNotification } = await supabase
          .from('scheduled_notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'event_reminder')
          .eq('target_id', event.id)
          .eq('status', 'sent')
          .single();

        if (!existingNotification) {
          const eventStartTime = new Date(event.start_time);
          const reminderData = {
            type: 'event_reminder' as const,
            targetId: event.id,
            notifyAt: new Date().toISOString(), // 即座に通知
            title: `📅 イベントリマインダー`,
            body: `「${event.title}」が15分後 (${eventStartTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}) に開始されます`,
            priority: 'medium' as const,
          };

          // 通知をスケジュール（即座に送信）
          const scheduleResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/schedule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reminderData)
          });

          if (scheduleResponse.ok) {
            reminderResults.eventsReminders.push({
              eventId: event.id,
              title: event.title,
              startTime: event.start_time,
              notificationScheduled: true
            });
            reminderResults.totalScheduled++;
          }
        }
      }
    }

    // 2. タスクリマインダー（今日の予定タスクで15分前）
    const { data: scheduledTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .not('scheduled_date', 'is', null);

    if (tasksError) {
      console.error('Error fetching scheduled tasks:', tasksError);
    } else if (scheduledTasks) {
      for (const task of scheduledTasks) {
        const scheduledTime = new Date(task.scheduled_date);
        const taskReminderTime = new Date(scheduledTime.getTime() - 15 * 60 * 1000);
        
        // 現在時刻がリマインダー時刻の±2分以内かチェック
        const timeDiff = Math.abs(checkTime.getTime() - taskReminderTime.getTime());
        
        if (timeDiff <= 2 * 60 * 1000) { // 2分以内
          const { data: existingNotification } = await supabase
            .from('scheduled_notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'task_reminder')
            .eq('target_id', task.id)
            .eq('status', 'sent')
            .single();

          if (!existingNotification) {
            const reminderData = {
              type: 'task_reminder' as const,
              targetId: task.id,
              notifyAt: new Date().toISOString(),
              title: `✅ タスクリマインダー`,
              body: `「${task.title}」の予定時刻 (${scheduledTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}) が近づいています`,
              priority: task.priority === 'high' ? 'high' as const : 'medium' as const,
            };

            const scheduleResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/schedule`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reminderData)
            });

            if (scheduleResponse.ok) {
              reminderResults.taskReminders.push({
                taskId: task.id,
                title: task.title,
                scheduledTime: task.scheduled_date,
                priority: task.priority,
                notificationScheduled: true
              });
              reminderResults.totalScheduled++;
            }
          }
        }
      }
    }

    // 3. 緊急タスクリマインダー（高優先度タスクで2時間前）
    const { data: highPriorityTasks, error: urgentTasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('priority', 'high')
      .in('status', ['pending', 'in_progress'])
      .not('due_date', 'is', null);

    if (urgentTasksError) {
      console.error('Error fetching urgent tasks:', urgentTasksError);
    } else if (highPriorityTasks) {
      for (const task of highPriorityTasks) {
        const dueTime = new Date(task.due_date);
        const urgentReminderTime = new Date(dueTime.getTime() - 2 * 60 * 60 * 1000); // 2時間前
        
        // 現在時刻が緊急リマインダー時刻の±5分以内かチェック
        const timeDiff = Math.abs(checkTime.getTime() - urgentReminderTime.getTime());
        
        if (timeDiff <= 5 * 60 * 1000) { // 5分以内
          const { data: existingNotification } = await supabase
            .from('scheduled_notifications')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'urgent_task')
            .eq('target_id', task.id)
            .eq('status', 'sent')
            .single();

          if (!existingNotification) {
            const reminderData = {
              type: 'urgent_task' as const,
              targetId: task.id,
              notifyAt: new Date().toISOString(),
              title: `🚨 緊急タスク通知`,
              body: `高優先度タスク「${task.title}」の期限 (${dueTime.toLocaleString('ja-JP')}) まで2時間です！`,
              priority: 'high' as const,
            };

            const scheduleResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/notifications/schedule`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(reminderData)
            });

            if (scheduleResponse.ok) {
              reminderResults.urgentTaskReminders.push({
                taskId: task.id,
                title: task.title,
                dueDate: task.due_date,
                notificationScheduled: true
              });
              reminderResults.totalScheduled++;
            }
          }
        }
      }
    }

    // リマインダー処理のログ
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'reminder_check_executed',
        event_data: {
          check_time: checkTime.toISOString(),
          events_found: reminderResults.eventsReminders.length,
          tasks_found: reminderResults.taskReminders.length,
          urgent_tasks_found: reminderResults.urgentTaskReminders.length,
          total_scheduled: reminderResults.totalScheduled,
        },
      });

    return NextResponse.json({
      success: true,
      checkTime: checkTime.toISOString(),
      results: reminderResults,
      message: `${reminderResults.totalScheduled}件のリマインダー通知をスケジュールしました`,
    });

  } catch (error) {
    console.error('Reminder processing error:', error);
    
    return NextResponse.json(
      { 
        error: 'リマインダー処理に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 今日のリマインダー対象一覧取得API
 * GET /api/notifications/reminder?date=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 今日のイベント
    const { data: todaysEvents, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .order('start_time', { ascending: true });

    // 今日予定のタスク
    const { data: todaysTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .gte('scheduled_date', startOfDay.toISOString())
      .lte('scheduled_date', endOfDay.toISOString())
      .order('scheduled_date', { ascending: true });

    // 今日期限の高優先度タスク
    const { data: urgentTasks, error: urgentError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('priority', 'high')
      .in('status', ['pending', 'in_progress'])
      .gte('due_date', startOfDay.toISOString())
      .lte('due_date', endOfDay.toISOString())
      .order('due_date', { ascending: true });

    const reminderSummary = {
      date: targetDate.toISOString().split('T')[0],
      eventsWithReminders: (todaysEvents || []).map(event => ({
        id: event.id,
        title: event.title,
        startTime: event.start_time,
        reminderTime: new Date(new Date(event.start_time).getTime() - 15 * 60 * 1000).toISOString(),
      })),
      tasksWithReminders: (todaysTasks || []).map(task => ({
        id: task.id,
        title: task.title,
        scheduledTime: task.scheduled_date,
        reminderTime: new Date(new Date(task.scheduled_date).getTime() - 15 * 60 * 1000).toISOString(),
        priority: task.priority,
      })),
      urgentTasksWithReminders: (urgentTasks || []).map(task => ({
        id: task.id,
        title: task.title,
        dueDate: task.due_date,
        urgentReminderTime: new Date(new Date(task.due_date).getTime() - 2 * 60 * 60 * 1000).toISOString(),
      })),
    };

    return NextResponse.json({
      success: true,
      reminderSummary,
      counts: {
        events: reminderSummary.eventsWithReminders.length,
        tasks: reminderSummary.tasksWithReminders.length,
        urgentTasks: reminderSummary.urgentTasksWithReminders.length,
        total: reminderSummary.eventsWithReminders.length + 
               reminderSummary.tasksWithReminders.length + 
               reminderSummary.urgentTasksWithReminders.length,
      }
    });

  } catch (error) {
    console.error('Reminder summary retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'リマインダー一覧の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}