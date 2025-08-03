// 基本型定義
export * from './database';
export interface User {
  id: string;
  email: string;
  google_refresh_token?: string;
  settings?: UserSettings;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  discord_webhook_url?: string;
  notification_preferences: {
    browser: boolean;
    discord: boolean;
    email: boolean;
  };
  ai_preferences: {
    suggestion_frequency: 'high' | 'medium' | 'low';
    auto_reschedule: boolean;
  };
}

// イベント・カレンダー関連
export interface CalendarEvent {
  id: string;
  user_id: string;
  google_event_id?: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  created_at: string;
  updated_at: string;
}

// タスク管理関連
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  estimated_time?: number; // 分単位
  due_date?: string;
  related_event_id?: string;
  created_at: string;
  updated_at: string;
}

// 通知関連
export interface Notification {
  id: string;
  user_id: string;
  type: 'reminder' | 'suggestion' | 'alert';
  title: string;
  message: string;
  sent_at?: string;
  read_at?: string;
  created_at: string;
}

// AI分析・提案関連
export interface AIAnalytics {
  id: string;
  user_id: string;
  action: string;
  data: Record<string, any>;
  created_at: string;
}

export interface AITaskSuggestion {
  title: string;
  description: string;
  estimated_time: number;
  priority: Task['priority'];
  reasoning: string;
}

// API レスポンス型
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Google Calendar API 関連
export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  location?: string;
}

// フォーム関連
export interface TaskFormData {
  title: string;
  description?: string;
  priority: Task['priority'];
  estimated_time?: number;
  due_date?: string;
}

export interface EventFormData {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
}