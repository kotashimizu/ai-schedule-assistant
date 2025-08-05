// ===========================================
// Shared Types - AI Schedule Assistant
// 共通型定義（データベース型から独立したビジネスロジック型）
// ===========================================

// 基本識別子型
export type UUID = string;
export type Timestamp = string;
export type EmailAddress = string;

// ユーザー設定型（強く型付け）
export interface UserSettings {
  discord_webhook_url?: string | null;
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

// Enum型の定義（型安全性向上）
export const TaskPriority = {
  HIGH: 'high',
  MEDIUM: 'medium', 
  LOW: 'low'
} as const;
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];

export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const NotificationType = {
  REMINDER: 'reminder',
  SUGGESTION: 'suggestion',
  ALERT: 'alert'
} as const;
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

// ビジネスロジック型（データベース型から独立）
export interface User {
  id: UUID;
  email: EmailAddress;
  google_refresh_token?: string | null;
  settings?: UserSettings | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface CalendarEvent {
  id: UUID;
  user_id: UUID;
  google_event_id?: string | null;
  title: string;
  description?: string | null;
  start_time: Timestamp;
  end_time: Timestamp;
  location?: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Task {
  id: UUID;
  user_id: UUID;
  title: string;
  description?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_time?: number | null; // minutes
  due_date?: Timestamp | null;
  related_event_id?: UUID | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface Notification {
  id: UUID;
  user_id: UUID;
  type: NotificationType;
  title: string;
  message: string;
  sent_at?: Timestamp | null;
  read_at?: Timestamp | null;
  created_at: Timestamp;
}

export interface AnalyticsLog {
  id: UUID;
  user_id: UUID;
  action: string;
  data: Record<string, unknown>; // unknown > any for safety
  created_at: Timestamp;
}

// AI関連型
export interface AITaskSuggestion {
  title: string;
  description: string;
  estimated_time: number;
  priority: TaskPriority;
  reasoning: string;
}

// API関連型
export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: APIError;
  message?: string;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Google Calendar API型
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

// フォーム型（入力検証用）
export interface TaskFormData {
  title: string;
  description?: string;
  priority: TaskPriority;
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

// 環境設定型
export interface EnvironmentConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  openai?: {
    apiKey: string;
  };
  google?: {
    clientId: string;
    clientSecret: string;
  };
  discord?: {
    webhookUrl: string;
  };
}