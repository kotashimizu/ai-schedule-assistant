// ===========================================
// Database Services - Type-Safe & Validated
// データベースサービス（型安全・検証強化版）
// ===========================================

import { supabase } from '@/lib/supabase/client-enhanced';
import { withErrorHandling, NotFoundError, ValidationError } from '@/lib/errors';
import { 
  User, 
  CalendarEvent, 
  Task, 
  Notification, 
  AnalyticsLog, 
  UUID, 
  TaskPriority, 
  TaskStatus, 
  NotificationType 
} from '@/types/shared';
import type { Database } from '@/types/database';

// データベース型から共通型への変換ヘルパー
type DbUser = Database['public']['Tables']['users']['Row'];
type DbEvent = Database['public']['Tables']['events']['Row'];
type DbTask = Database['public']['Tables']['tasks']['Row'];
type DbNotification = Database['public']['Tables']['notifications']['Row'];
type DbAnalyticsLog = Database['public']['Tables']['analytics_logs']['Row'];

/**
 * データベース行からビジネスオブジェクトへの変換
 */
const transformers = {
  user: (row: DbUser): User => ({
    id: row.id,
    email: row.email,
    google_refresh_token: row.google_refresh_token,
    settings: row.settings ? (row.settings as User['settings']) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }),

  event: (row: DbEvent): CalendarEvent => ({
    id: row.id,
    user_id: row.user_id,
    google_event_id: row.google_event_id,
    title: row.title,
    description: row.description,
    start_time: row.start_time,
    end_time: row.end_time,
    location: row.location,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }),

  task: (row: DbTask): Task => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    description: row.description,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    estimated_time: row.estimated_time,
    due_date: row.due_date,
    related_event_id: row.related_event_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }),

  notification: (row: DbNotification): Notification => ({
    id: row.id,
    user_id: row.user_id,
    type: row.type as NotificationType,
    title: row.title,
    message: row.message,
    sent_at: row.sent_at,
    read_at: row.read_at,
    created_at: row.created_at,
  }),

  analyticsLog: (row: DbAnalyticsLog): AnalyticsLog => ({
    id: row.id,
    user_id: row.user_id,
    action: row.action,
    data: row.data || {},
    created_at: row.created_at,
  }),
};

/**
 * 入力値検証ヘルパー
 */
const validators = {
  uuid: (value: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  },

  email: (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },

  dateString: (value: string): boolean => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  },
};

/**
 * ユーザー操作サービス
 */
export const userService = {
  /**
   * ユーザー作成
   */
  create: withErrorHandling(async (userData: {
    email: string;
    google_refresh_token?: string | null;
    settings?: User['settings'] | null;
  }): Promise<User> => {
    // バリデーション
    if (!validators.email(userData.email)) {
      throw new ValidationError('Invalid email format');
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        email: userData.email,
        google_refresh_token: userData.google_refresh_token,
        settings: userData.settings as Record<string, unknown> | null,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('User creation failed');

    return transformers.user(data);
  }),

  /**
   * ID によるユーザー取得
   */
  getById: withErrorHandling(async (id: UUID): Promise<User> => {
    if (!validators.uuid(id)) {
      throw new ValidationError('Invalid user ID format');
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('User', id);

    return transformers.user(data);
  }),

  /**
   * メールアドレスによるユーザー取得
   */
  getByEmail: withErrorHandling(async (email: string): Promise<User> => {
    if (!validators.email(email)) {
      throw new ValidationError('Invalid email format');
    }

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('User', email);

    return transformers.user(data);
  }),

  /**
   * ユーザー更新
   */
  update: withErrorHandling(async (
    id: UUID, 
    updates: Partial<Pick<User, 'google_refresh_token' | 'settings'>>
  ): Promise<User> => {
    if (!validators.uuid(id)) {
      throw new ValidationError('Invalid user ID format');
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        google_refresh_token: updates.google_refresh_token,
        settings: updates.settings as Record<string, unknown> | null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('User', id);

    return transformers.user(data);
  }),
};

/**
 * イベント操作サービス
 */
export const eventService = {
  /**
   * 日付範囲でイベント取得
   */
  getByDateRange: withErrorHandling(async (
    userId: UUID, 
    startDate: string, 
    endDate: string
  ): Promise<CalendarEvent[]> => {
    if (!validators.uuid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }
    if (!validators.dateString(startDate) || !validators.dateString(endDate)) {
      throw new ValidationError('Invalid date format');
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startDate)
      .lte('end_time', endDate)
      .order('start_time', { ascending: true });

    if (error) throw error;

    return (data || []).map(transformers.event);
  }),

  /**
   * 今日のイベント取得
   */
  getTodaysEvents: withErrorHandling(async (userId: UUID): Promise<CalendarEvent[]> => {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    
    const result = await eventService.getByDateRange(userId, startOfDay, endOfDay);
    if (result.error) throw result.error;
    return result.data || [];
  }),

  /**
   * イベント作成
   */
  create: withErrorHandling(async (eventData: {
    user_id: UUID;
    google_event_id?: string | null;
    title: string;
    description?: string | null;
    start_time: string;
    end_time: string;
    location?: string | null;
  }): Promise<CalendarEvent> => {
    // バリデーション
    if (!validators.uuid(eventData.user_id)) {
      throw new ValidationError('Invalid user ID format');
    }
    if (!validators.dateString(eventData.start_time) || !validators.dateString(eventData.end_time)) {
      throw new ValidationError('Invalid date format');
    }
    if (new Date(eventData.start_time) >= new Date(eventData.end_time)) {
      throw new ValidationError('Start time must be before end time');
    }

    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('Event creation failed');

    return transformers.event(data);
  }),

  /**
   * イベント更新
   */
  update: withErrorHandling(async (
    id: UUID, 
    updates: Partial<Pick<CalendarEvent, 'title' | 'description' | 'start_time' | 'end_time' | 'location'>>
  ): Promise<CalendarEvent> => {
    if (!validators.uuid(id)) {
      throw new ValidationError('Invalid event ID format');
    }

    // 日付検証
    if (updates.start_time && !validators.dateString(updates.start_time)) {
      throw new ValidationError('Invalid start time format');
    }
    if (updates.end_time && !validators.dateString(updates.end_time)) {
      throw new ValidationError('Invalid end time format');
    }

    const { data, error } = await supabase
      .from('events')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('Event', id);

    return transformers.event(data);
  }),

  /**
   * イベント削除
   */
  delete: withErrorHandling(async (id: UUID): Promise<void> => {
    if (!validators.uuid(id)) {
      throw new ValidationError('Invalid event ID format');
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }),
};

/**
 * タスク操作サービス
 */
export const taskService = {
  /**
   * ユーザーのタスク一覧取得
   */
  getByUser: withErrorHandling(async (
    userId: UUID, 
    filters?: {
      status?: TaskStatus;
      priority?: TaskPriority;
      limit?: number;
    }
  ): Promise<Task[]> => {
    if (!validators.uuid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map(transformers.task);
  }),

  /**
   * タスク作成
   */
  create: withErrorHandling(async (taskData: {
    user_id: UUID;
    title: string;
    description?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    estimated_time?: number | null;
    due_date?: string | null;
    related_event_id?: UUID | null;
  }): Promise<Task> => {
    // バリデーション
    if (!validators.uuid(taskData.user_id)) {
      throw new ValidationError('Invalid user ID format');
    }
    if (!taskData.title || taskData.title.trim().length === 0) {
      throw new ValidationError('Task title is required');
    }
    if (taskData.due_date && !validators.dateString(taskData.due_date)) {
      throw new ValidationError('Invalid due date format');
    }
    if (taskData.related_event_id && !validators.uuid(taskData.related_event_id)) {
      throw new ValidationError('Invalid related event ID format');
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: taskData.user_id,
        title: taskData.title.trim(),
        description: taskData.description,
        priority: taskData.priority || 'medium',
        status: taskData.status || 'pending',
        estimated_time: taskData.estimated_time,
        due_date: taskData.due_date,
        related_event_id: taskData.related_event_id,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('Task creation failed');

    return transformers.task(data);
  }),

  /**
   * タスク完了率取得
   */
  getCompletionRate: withErrorHandling(async (userId: UUID, days: number = 7): Promise<number> => {
    if (!validators.uuid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('tasks')
      .select('status')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) throw error;
    if (!data || data.length === 0) return 0;

    const total = data.length;
    const completed = data.filter(task => task.status === 'completed').length;
    
    return Math.round((completed / total) * 100);
  }),
};

/**
 * 通知操作サービス
 */
export const notificationService = {
  /**
   * ユーザーの通知一覧取得
   */
  getByUser: withErrorHandling(async (
    userId: UUID, 
    filters?: { unread?: boolean; type?: NotificationType; limit?: number }
  ): Promise<Notification[]> => {
    if (!validators.uuid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (filters?.unread) {
      query = query.is('read_at', null);
    }
    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(transformers.notification);
  }),

  /**
   * 通知作成
   */
  create: withErrorHandling(async (notificationData: {
    user_id: UUID;
    type: NotificationType;
    title: string;
    message: string;
  }): Promise<Notification> => {
    if (!validators.uuid(notificationData.user_id)) {
      throw new ValidationError('Invalid user ID format');
    }
    if (!notificationData.title.trim()) {
      throw new ValidationError('Notification title is required');
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('Notification creation failed');

    return transformers.notification(data);
  }),

  /**
   * 通知を既読にマーク
   */
  markAsRead: withErrorHandling(async (id: UUID): Promise<void> => {
    if (!validators.uuid(id)) {
      throw new ValidationError('Invalid notification ID format');
    }

    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }),
};

/**
 * 分析ログサービス
 */
export const analyticsService = {
  /**
   * アクションログ記録
   */
  logAction: withErrorHandling(async (logData: {
    user_id: UUID;
    action: string;
    data?: Record<string, unknown>;
  }): Promise<AnalyticsLog> => {
    if (!validators.uuid(logData.user_id)) {
      throw new ValidationError('Invalid user ID format');
    }
    if (!logData.action.trim()) {
      throw new ValidationError('Action is required');
    }

    const { data, error } = await supabase
      .from('analytics_logs')
      .insert({
        user_id: logData.user_id,
        action: logData.action,
        data: logData.data || {},
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundError('Analytics log creation failed');

    return transformers.analyticsLog(data);
  }),

  /**
   * ユーザーの活動統計取得
   */
  getUserStats: withErrorHandling(async (
    userId: UUID, 
    days: number = 30
  ): Promise<Record<string, number>> => {
    if (!validators.uuid(userId)) {
      throw new ValidationError('Invalid user ID format');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('analytics_logs')
      .select('action')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    // アクション別の集計
    const stats: Record<string, number> = {};
    (data || []).forEach(log => {
      stats[log.action] = (stats[log.action] || 0) + 1;
    });

    return stats;
  }),
};

/**
 * すべてのサービスをエクスポート
 */
export const databaseServices = {
  users: userService,
  events: eventService,
  tasks: taskService,
  notifications: notificationService,
  analytics: analyticsService,
} as const;