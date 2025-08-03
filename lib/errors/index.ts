// ===========================================
// Error Handling System - AI Schedule Assistant
// 統一エラーハンドリングシステム
// ===========================================

import { APIError } from '@/types/shared';

/**
 * アプリケーション基底エラークラス
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  public readonly timestamp: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.details = details;

    // スタックトレースの調整
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * APIエラー形式に変換
   */
  toAPIError(): APIError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }

  /**
   * JSON形式に変換（ログ用）
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * データベースエラー
 */
export class DatabaseError extends AppError {
  readonly code = 'DATABASE_ERROR';
  readonly statusCode = 500;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details);
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(message: string, public readonly fieldErrors?: Record<string, string[]>) {
    super(message, { fieldErrors });
  }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends AppError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly statusCode = 401;

  constructor(message: string = 'Authentication required') {
    super(message);
  }
}

/**
 * 認可エラー
 */
export class AuthorizationError extends AppError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly statusCode = 403;

  constructor(message: string = 'Insufficient permissions') {
    super(message);
  }
}

/**
 * リソース未発見エラー
 */
export class NotFoundError extends AppError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, { resource, identifier });
  }
}

/**
 * レート制限エラー
 */
export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;

  constructor(retryAfter?: number) {
    super('Rate limit exceeded', retryAfter ? { retryAfter } : undefined);
  }
}

/**
 * 外部API エラー
 */
export class ExternalAPIError extends AppError {
  readonly code = 'EXTERNAL_API_ERROR';
  readonly statusCode = 502;

  constructor(service: string, message: string, details?: Record<string, unknown>) {
    super(`${service} API error: ${message}`, { service, ...details });
  }
}

/**
 * 設定エラー
 */
export class ConfigurationError extends AppError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(setting: string, message?: string) {
    super(message || `Invalid configuration for: ${setting}`, { setting });
  }
}

/**
 * Supabaseエラーを適切なアプリケーションエラーに変換
 */
export function transformSupabaseError(error: unknown): AppError {
  // Type guard for error objects
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const errorObj = error as { code?: string; message?: string };
    if (errorObj.code === 'PGRST116') {
      return new NotFoundError('Resource');
    }
    if (errorObj.code && errorObj.code.startsWith('23')) {
      // PostgreSQL constraint violations - all map to ValidationError
      return new ValidationError(errorObj.message || 'Database constraint violation');
    }
  }

  // Auth errors - safe property access
  const errorMessage = typeof error === 'object' && error !== null && 'message' in error 
    ? (error as { message?: string }).message 
    : undefined;

  if (errorMessage?.includes('JWT')) {
    return new AuthenticationError('Invalid or expired token');
  }

  if (errorMessage?.includes('permission')) {
    return new AuthorizationError(errorMessage);
  }

  // Default to database error
  const message = errorMessage || 'Database operation failed';
  return new DatabaseError(message, { originalError: error });
}

/**
 * エラーハンドラー関数
 */
export function handleError(error: unknown): AppError {
  // 既にAppErrorの場合はそのまま返す
  if (error instanceof AppError) {
    return error;
  }

  // Supabaseエラーの場合は変換
  if (typeof error === 'object' && error !== null) {
    return transformSupabaseError(error);
  }

  // その他のエラー
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  return new DatabaseError(message, {
    originalError: error,
  });
}

/**
 * 非同期関数のエラーラップ
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<{ data?: R; error?: AppError }> {
  return async (...args: T) => {
    try {
      const data = await fn(...args);
      return { data };
    } catch (error) {
      return { error: handleError(error) };
    }
  };
}

/**
 * 開発環境でのエラーログ
 */
export function logError(error: AppError, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.error(`🚨 ${context ? `[${context}] ` : ''}${error.name}:`, error.toJSON());
  }
}