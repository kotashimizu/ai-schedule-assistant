import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RescheduleSuggestionsRequest {
  targetDate?: string; // YYYY-MM-DD format, defaults to today
  userId?: string; // Optional, for manual generation
}

interface IncompleteTask {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  estimated_minutes: number | null;
  due_date: string | null;
  scheduled_date: string | null;
  postpone_count: number;
  postpone_reason: string | null;
  created_at: string;
}

interface RescheduleSuggestion {
  taskId: string;
  title: string;
  currentScheduledDate: string | null;
  suggestedDate: string;
  suggestedTimeSlot: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number | null;
}

interface CalendarEvent {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
}

/**
 * Helper function to find available time slots for the next day
 */
function findAvailableTimeSlots(
  events: CalendarEvent[],
  targetDate: string,
  taskDurationMinutes: number = 60
): { start: string; end: string; label: string }[] {
  const date = new Date(targetDate);
  const workingHours = [
    { start: 9, end: 12, label: '午前' },
    { start: 13, end: 17, label: '午後' },
    { start: 19, end: 21, label: '夜' }
  ];
  
  const availableSlots: { start: string; end: string; label: string }[] = [];
  
  workingHours.forEach(period => {
    const periodStart = new Date(date);
    periodStart.setHours(period.start, 0, 0, 0);
    const periodEnd = new Date(date);
    periodEnd.setHours(period.end, 0, 0, 0);
    
    // Check for conflicts with existing events
    const hasConflict = events.some(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      
      return (
        (eventStart >= periodStart && eventStart < periodEnd) ||
        (eventEnd > periodStart && eventEnd <= periodEnd) ||
        (eventStart <= periodStart && eventEnd >= periodEnd)
      );
    });
    
    if (!hasConflict) {
      availableSlots.push({
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        label: period.label
      });
    }
  });
  
  return availableSlots;
}

/**
 * Generate AI-powered rescheduling suggestions
 */
async function generateRescheduleSuggestions(
  incompleteTasks: IncompleteTask[],
  tomorrowEvents: CalendarEvent[],
  targetDate: string
): Promise<RescheduleSuggestion[]> {
  const tomorrow = new Date(targetDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  const suggestions: RescheduleSuggestion[] = [];
  
  // Sort tasks by priority and postpone count (most urgent first)
  const sortedTasks = incompleteTasks.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 1;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 1;
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }
    
    // If same priority, prioritize tasks with more postponements
    return (b.postpone_count || 0) - (a.postpone_count || 0);
  });
  
  const availableSlots = findAvailableTimeSlots(tomorrowEvents, tomorrowStr);
  
  for (let i = 0; i < Math.min(sortedTasks.length, availableSlots.length); i++) {
    const task = sortedTasks[i];
    const slot = availableSlots[i];
    
    let reason = '';
    if (task.postpone_count > 0) {
      reason = `${task.postpone_count}回延期されています。`;
      if (task.postpone_reason) {
        reason += ` 前回の延期理由: ${task.postpone_reason}`;
      }
    }
    
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const daysDiff = Math.ceil((dueDate.getTime() - tomorrow.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 1) {
        reason += ` 期限まで${daysDiff}日です。`;
      }
    }
    
    if (task.priority === 'high') {
      reason += ' 高優先度のタスクです。';
    }
    
    if (!reason) {
      reason = '時間に余裕があるときに取り組みましょう。';
    }
    
    suggestions.push({
      taskId: task.id,
      title: task.title,
      currentScheduledDate: task.scheduled_date,
      suggestedDate: tomorrowStr,
      suggestedTimeSlot: slot.label,
      reason: reason.trim(),
      priority: task.priority as 'high' | 'medium' | 'low',
      estimatedMinutes: task.estimated_minutes,
    });
  }
  
  // If we have more tasks than available slots, use AI to generate more nuanced suggestions
  if (sortedTasks.length > availableSlots.length && process.env.OPENAI_API_KEY) {
    try {
      const remainingTasks = sortedTasks.slice(availableSlots.length);
      const tasksList = remainingTasks.map(task => 
        `- ${task.title} (優先度: ${task.priority}, 延期回数: ${task.postpone_count || 0}回${task.due_date ? `, 期限: ${task.due_date}` : ''})`
      ).join('\n');
      
      const prompt = `以下のタスクについて、明日(${tomorrowStr})のリスケジュール提案を生成してください：

${tasksList}

明日の既存予定:
${tomorrowEvents.map(event => `- ${event.title} (${new Date(event.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - ${new Date(event.end_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })})`).join('\n')}

以下の形式でJSONレスponseを返してください：
{
  "suggestions": [
    {
      "taskId": "タスクID",
      "suggestedTimeSlot": "午前|午後|夜|空き時間",
      "reason": "リスケジュール理由"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "あなたは効率的なタスク管理アシスタントです。ユーザーのスケジュールと未完了タスクを分析し、最適なリスケジュール提案を行ってください。"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });

      const aiResponse = completion.choices[0]?.message?.content;
      if (aiResponse) {
        try {
          const parsed = JSON.parse(aiResponse);
          parsed.suggestions?.forEach((aiSuggestion: any) => {
            const task = remainingTasks.find(t => t.id === aiSuggestion.taskId);
            if (task) {
              suggestions.push({
                taskId: task.id,
                title: task.title,
                currentScheduledDate: task.scheduled_date,
                suggestedDate: tomorrowStr,
                suggestedTimeSlot: aiSuggestion.suggestedTimeSlot,
                reason: aiSuggestion.reason,
                priority: task.priority as 'high' | 'medium' | 'low',
                estimatedMinutes: task.estimated_minutes,
              });
            }
          });
        } catch (parseError) {
          console.error('Failed to parse AI suggestions:', parseError);
        }
      }
    } catch (aiError) {
      console.error('AI suggestion generation failed:', aiError);
      // Continue with basic suggestions
    }
  }
  
  return suggestions;
}

/**
 * 未完了タスクの翌日リスケジュール提案API
 * POST /api/ai/reschedule-suggestions - リスケジュール提案生成
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json() as RescheduleSuggestionsRequest;
    const targetDate = body.targetDate || new Date().toISOString().split('T')[0];
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    // Get incomplete tasks scheduled for today or overdue
    const startOfDay = new Date(targetDate + 'T00:00:00.000Z');
    const endOfDay = new Date(targetDate + 'T23:59:59.999Z');
    
    const { data: incompleteTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'in_progress'])
      .or(`scheduled_date.gte.${startOfDay.toISOString()},scheduled_date.lte.${endOfDay.toISOString()},due_date.lte.${endOfDay.toISOString()}`)
      .order('priority', { ascending: false })
      .order('postpone_count', { ascending: false });

    if (tasksError) {
      throw tasksError;
    }

    if (incompleteTasks.length === 0) {
      return NextResponse.json({
        success: true,
        suggestions: [],
        message: '未完了のタスクはありません',
      });
    }
    
    // Get tomorrow's calendar events
    const tomorrow = new Date(targetDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const tomorrowStart = new Date(tomorrowStr + 'T00:00:00.000Z');
    const tomorrowEnd = new Date(tomorrowStr + 'T23:59:59.999Z');
    
    const { data: tomorrowEvents, error: eventsError } = await supabase
      .from('events')
      .select('id, title, start_time, end_time')
      .eq('user_id', user.id)
      .gte('start_time', tomorrowStart.toISOString())
      .lte('start_time', tomorrowEnd.toISOString())
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('Error fetching tomorrow events:', eventsError);
      // Continue without events data
    }
    
    const suggestions = await generateRescheduleSuggestions(
      incompleteTasks as IncompleteTask[],
      (tomorrowEvents as CalendarEvent[]) || [],
      targetDate
    );
    
    // Store suggestions in database
    const suggestionRecord = {
      user_id: user.id,
      target_date: targetDate,
      suggestions_for_date: tomorrowStr,
      incomplete_tasks_count: incompleteTasks.length,
      suggestions_count: suggestions.length,
      suggestions_data: suggestions,
      generated_at: new Date().toISOString(),
    };
    
    // Check if suggestions already exist for this date
    const { data: existingSuggestions } = await supabase
      .from('reschedule_suggestions')
      .select('id')
      .eq('user_id', user.id)
      .eq('target_date', targetDate)
      .single();
    
    let result;
    if (existingSuggestions) {
      // Update existing suggestions
      const { data, error } = await supabase
        .from('reschedule_suggestions')
        .update(suggestionRecord)
        .eq('id', existingSuggestions.id)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new suggestions
      const { data, error } = await supabase
        .from('reschedule_suggestions')
        .insert(suggestionRecord)
        .select()
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    // Log the suggestion generation
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'reschedule_suggestions_generated',
        event_data: {
          target_date: targetDate,
          suggestions_for_date: tomorrowStr,
          incomplete_tasks: incompleteTasks.length,
          suggestions_generated: suggestions.length,
          auto_generated: !body.userId, // true if automatically generated
        },
      });
    
    return NextResponse.json({
      success: true,
      suggestions,
      metadata: {
        targetDate,
        suggestionsForDate: tomorrowStr,
        incompleteTasksCount: incompleteTasks.length,
        suggestionsCount: suggestions.length,
      },
      message: `${incompleteTasks.length}件の未完了タスクに対して${suggestions.length}件のリスケジュール提案を生成しました`,
    });

  } catch (error) {
    console.error('Reschedule suggestions generation error:', error);
    
    return NextResponse.json(
      { 
        error: 'リスケジュール提案の生成に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * リスケジュール提案の取得API
 * GET /api/ai/reschedule-suggestions?date=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    const { data: suggestions, error } = await supabase
      .from('reschedule_suggestions')
      .select('*')
      .eq('user_id', user.id)
      .eq('target_date', targetDate)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: '指定された日付のリスケジュール提案が見つかりません' },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      suggestions: suggestions.suggestions_data,
      metadata: {
        targetDate: suggestions.target_date,
        suggestionsForDate: suggestions.suggestions_for_date,
        incompleteTasksCount: suggestions.incomplete_tasks_count,
        suggestionsCount: suggestions.suggestions_count,
        generatedAt: suggestions.generated_at,
      },
    });

  } catch (error) {
    console.error('Reschedule suggestions retrieval error:', error);
    
    return NextResponse.json(
      { 
        error: 'リスケジュール提案の取得に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * リスケジュール提案の適用API
 * PUT /api/ai/reschedule-suggestions - 提案を適用してタスクをリスケジュール
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const { taskId, suggestedDate, suggestedTimeSlot, applyReason } = body;
    const testUserId = 'test-user-123';
    const user = { id: testUserId };
    
    if (!taskId || !suggestedDate) {
      return NextResponse.json(
        { error: 'taskIdとsuggestedDateは必須です' },
        { status: 400 }
      );
    }
    
    // Update the task with new scheduled date
    const updateData: any = {
      scheduled_date: new Date(suggestedDate).toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    // Add postpone reason if provided
    if (applyReason) {
      updateData.postpone_reason = applyReason;
      // Get current postpone count
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('postpone_count')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .single();
      
      updateData.postpone_count = (currentTask?.postpone_count || 0) + 1;
    }
    
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', user.id)
      .select()
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
    
    // Log the reschedule action
    await supabase
      .from('analytics_logs')
      .insert({
        user_id: user.id,
        event_type: 'task_rescheduled_from_suggestion',
        event_data: {
          task_id: taskId,
          old_scheduled_date: updatedTask.scheduled_date,
          new_scheduled_date: suggestedDate,
          suggested_time_slot: suggestedTimeSlot,
          apply_reason: applyReason,
        },
      });
    
    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: 'タスクをリスケジュールしました',
    });

  } catch (error) {
    console.error('Reschedule application error:', error);
    
    return NextResponse.json(
      { 
        error: 'リスケジュールの適用に失敗しました',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}