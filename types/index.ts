// ===========================================
// Type Definitions Index - AI Schedule Assistant
// 統合型定義インデックス
// ===========================================

// Enhanced type-safe exports from shared types
export * from './shared';

// Database type definitions
export * from './database';

// Re-export common types for backward compatibility
export type {
  User,
  CalendarEvent,
  Task,
  Notification,
  AnalyticsLog as AIAnalytics, // Alias for backward compatibility
  AITaskSuggestion,
  APIResponse,
  APIError,
  GoogleCalendarEvent,
  TaskFormData,
  EventFormData,
  UserSettings,
  EnvironmentConfig,
  TaskPriority,
  TaskStatus,
  NotificationType,
  UUID,
  Timestamp,
  EmailAddress,
} from './shared';