import { supabase } from './client';
import type { Database } from '@/types/database';

type Tables = Database['public']['Tables'];
type Task = Tables['tasks']['Row'];

// ユーザー操作
export const userService = {
  // ユーザー作成
  async create(userData: Tables['users']['Insert']) {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    return { data, error };
  },

  // ユーザー取得
  async getById(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  // ユーザー更新
  async update(id: string, updates: Tables['users']['Update']) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },
};

// イベント操作
export const eventService = {
  // イベント一覧取得（日付範囲指定）
  async getByDateRange(userId: string, startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startDate)
      .lte('end_time', endDate)
      .order('start_time', { ascending: true });
    return { data, error };
  },

  // 今日のイベント取得
  async getTodaysEvents(userId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    
    return this.getByDateRange(userId, startOfDay, endOfDay);
  },

  // イベント作成
  async create(eventData: Tables['events']['Insert']) {
    const { data, error } = await supabase
      .from('events')
      .insert(eventData)
      .select()
      .single();
    return { data, error };
  },

  // イベント更新
  async update(id: string, updates: Tables['events']['Update']) {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // イベント削除
  async delete(id: string) {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);
    return { error };
  },
};

// タスク操作
export const taskService = {
  // ユーザーのタスク一覧取得
  async getByUser(userId: string, filters?: {
    status?: Task['status'];
    priority?: Task['priority'];
    limit?: number;
  }) {
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
    return { data, error };
  },

  // 今日期限のタスク取得
  async getTodaysTasks(userId: string) {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .gte('due_date', startOfDay)
      .lte('due_date', endOfDay)
      .order('priority', { ascending: false });
    return { data, error };
  },

  // タスク作成
  async create(taskData: Tables['tasks']['Insert']) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(taskData)
      .select()
      .single();
    return { data, error };
  },

  // タスク更新
  async update(id: string, updates: Tables['tasks']['Update']) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  // タスク削除
  async delete(id: string) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    return { error };
  },

  // タスク完了率取得
  async getCompletionRate(userId: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .from('tasks')
      .select('status')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());

    if (error || !data) return { completionRate: 0, error };

    const total = data.length;
    const completed = data.filter(task => task.status === 'completed').length;
    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    return { completionRate, error: null };
  },
};

// 通知操作
export const notificationService = {
  // 未読通知取得
  async getUnread(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .is('read_at', null)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  // 通知作成
  async create(notificationData: Tables['notifications']['Insert']) {
    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();
    return { data, error };
  },

  // 通知を既読にする
  async markAsRead(id: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },
};

// 分析ログ操作
export const analyticsService = {
  // ログ記録
  async log(userId: string, action: string, data?: Record<string, unknown>) {
    const { error } = await supabase
      .from('analytics_logs')
      .insert({
        user_id: userId,
        action,
        data: data || {},
      });
    return { error };
  },

  // ユーザーの活動ログ取得
  async getUserActivity(userId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('analytics_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });
    return { data, error };
  },
};