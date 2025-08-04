/**
 * カレンダー同期エラーハンドリングシステム
 * ユーザーフレンドリーなエラーメッセージと復旧機能を提供
 */

export interface CalendarError {
  code: string;
  message: string;
  userMessage: string;
  recoverable: boolean;
  retryAfter?: number; // seconds
  details?: any;
}

export class CalendarErrorHandler {
  private static readonly ERROR_TYPES = {
    // ネットワークエラー
    NETWORK_ERROR: {
      code: 'NETWORK_ERROR',
      message: 'Network connection failed',
      userMessage: 'インターネット接続に問題があります。オフラインモードでキャッシュされたデータを表示します。',
      recoverable: true,
      retryAfter: 30,
    },
    
    // 認証エラー
    AUTH_ERROR: {
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
      userMessage: 'Google Calendarへのアクセス権限が必要です。再度ログインしてください。',
      recoverable: true,
    },
    
    // トークン期限切れ
    TOKEN_EXPIRED: {
      code: 'TOKEN_EXPIRED',
      message: 'Access token expired',
      userMessage: 'アクセス権限が期限切れです。自動で更新しています...',
      recoverable: true,
      retryAfter: 5,
    },
    
    // API制限
    RATE_LIMIT: {
      code: 'RATE_LIMIT',
      message: 'API rate limit exceeded',
      userMessage: 'Google Calendar APIの利用制限に達しました。しばらくお待ちください。',
      recoverable: true,
      retryAfter: 60,
    },
    
    // カレンダーなし
    NO_CALENDAR: {
      code: 'NO_CALENDAR',
      message: 'No accessible calendar found',
      userMessage: 'Google Calendarのアクセス権限が設定されていません。カレンダー連携を設定してください。',
      recoverable: true,
    },
    
    // サーバーエラー
    SERVER_ERROR: {
      code: 'SERVER_ERROR',
      message: 'Server internal error',
      userMessage: 'サーバーでエラーが発生しました。しばらくしてから再度お試しください。',
      recoverable: true,
      retryAfter: 120,
    },
    
    // データベースエラー
    DATABASE_ERROR: {
      code: 'DATABASE_ERROR',
      message: 'Database operation failed',
      userMessage: 'データの保存に失敗しました。ブラウザのストレージを確認してください。',
      recoverable: true,
      retryAfter: 10,
    },
    
    // 不明エラー
    UNKNOWN_ERROR: {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      userMessage: '予期しないエラーが発生しました。サポートにお問い合わせください。',
      recoverable: false,
    },
  };

  /**
   * エラーを解析して適切なCalendarErrorオブジェクトを返す
   */
  static handleError(error: any): CalendarError {
    // Fetch APIエラー
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        ...this.ERROR_TYPES.NETWORK_ERROR,
        details: { originalError: error.message },
      };
    }

    // HTTPステータスコードで判定
    if (error.status) {
      switch (error.status) {
        case 401:
          return {
            ...this.ERROR_TYPES.AUTH_ERROR,
            details: { status: error.status, response: error.message },
          };
        
        case 403:
          if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
            return {
              ...this.ERROR_TYPES.RATE_LIMIT,
              details: { status: error.status, response: error.message },
            };
          }
          return {
            ...this.ERROR_TYPES.NO_CALENDAR,
            details: { status: error.status, response: error.message },
          };
        
        case 404:
          return {
            ...this.ERROR_TYPES.NO_CALENDAR,
            details: { status: error.status, response: error.message },
          };
        
        case 429:
          return {
            ...this.ERROR_TYPES.RATE_LIMIT,
            details: { status: error.status, response: error.message },
          };
        
        case 500:
        case 502:
        case 503:
        case 504:
          return {
            ...this.ERROR_TYPES.SERVER_ERROR,
            details: { status: error.status, response: error.message },
          };
      }
    }

    // Google APIエラーメッセージで判定
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('invalid_token') || errorMessage.includes('token_expired')) {
      return {
        ...this.ERROR_TYPES.TOKEN_EXPIRED,
        details: { originalError: error.message },
      };
    }
    
    if (errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
      return {
        ...this.ERROR_TYPES.AUTH_ERROR,
        details: { originalError: error.message },
      };
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
      return {
        ...this.ERROR_TYPES.RATE_LIMIT,
        details: { originalError: error.message },
      };
    }
    
    if (errorMessage.includes('calendar') && errorMessage.includes('not found')) {
      return {
        ...this.ERROR_TYPES.NO_CALENDAR,
        details: { originalError: error.message },
      };
    }

    // オフライン検知
    if (!navigator.onLine) {
      return {
        ...this.ERROR_TYPES.NETWORK_ERROR,
        details: { offline: true, originalError: error.message },
      };
    }

    // IndexedDBエラー
    if (error.name === 'QuotaExceededError' || errorMessage.includes('quota')) {
      return {
        ...this.ERROR_TYPES.DATABASE_ERROR,
        userMessage: 'ブラウザのストレージ容量が不足しています。不要なデータを削除してください。',
        details: { originalError: error.message },
      };
    }

    // デフォルト: 不明エラー
    return {
      ...this.ERROR_TYPES.UNKNOWN_ERROR,
      details: { originalError: error.message || error.toString() },
    };
  }

  /**
   * エラーログを記録
   */
  static logError(error: CalendarError, context?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      context: context || 'calendar_sync',
      error: {
        code: error.code,
        message: error.message,
        recoverable: error.recoverable,
        details: error.details,
      },
    };

    console.error('📅 Calendar Error:', logEntry);

    // ローカルストレージにエラーログを保存
    try {
      const errorLogs = JSON.parse(localStorage.getItem('calendar_error_logs') || '[]');
      errorLogs.push(logEntry);
      
      // 最大100件まで保持
      if (errorLogs.length > 100) {
        errorLogs.splice(0, errorLogs.length - 100);
      }
      
      localStorage.setItem('calendar_error_logs', JSON.stringify(errorLogs));
    } catch (storageError) {
      console.warn('エラーログの保存に失敗:', storageError);
    }
  }

  /**
   * リトライ戦略を決定
   */
  static getRetryStrategy(error: CalendarError, retryCount: number): {
    shouldRetry: boolean;
    delayMs: number;
    maxRetries: number;
  } {
    const maxRetries = error.recoverable ? 3 : 0;
    
    if (!error.recoverable || retryCount >= maxRetries) {
      return { shouldRetry: false, delayMs: 0, maxRetries };
    }

    // 指数関数的バックオフ + ジッター
    const baseDelay = (error.retryAfter || 5) * 1000;
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 1000;
    const delayMs = Math.min(exponentialDelay + jitter, 60000); // 最大30秒

    return {
      shouldRetry: true,
      delayMs,
      maxRetries,
    };
  }

  /**
   * ユーザー向けの回復手順を提供
   */
  static getRecoverySteps(error: CalendarError): string[] {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return [
          'インターネット接続を確認してください',
          'ブラウザを再読み込みしてください',
          'オフラインモードでキャッシュされたデータを使用します',
        ];
      
      case 'AUTH_ERROR':
      case 'TOKEN_EXPIRED':
        return [
          '「カレンダー連携」ボタンをクリック',
          'Googleアカウントで再ログイン',
          'カレンダーアクセス権限を許可',
        ];
      
      case 'RATE_LIMIT':
        return [
          'しばらくお待ちください（約1分）',
          'ブラウザを再読み込みしてください',
          '問題が続く場合はサポートにお問い合わせください',
        ];
      
      case 'NO_CALENDAR':
        return [
          'Google Calendarのアクセス権限を確認',
          'カレンダー連携を再設定',
          'Google Calendarでカレンダーが作成されているか確認',
        ];
      
      case 'DATABASE_ERROR':
        return [
          'ブラウザのストレージを確認',
          '不要なファイルやキャッシュを削除',
          'ブラウザを再起動',
        ];
      
      case 'SERVER_ERROR':
        return [
          'しばらくお待ちください（約2分）',
          'ブラウザを再読み込みしてください',
          '問題が続く場合はサポートにお問い合わせください',
        ];
      
      default:
        return [
          'ブラウザを再読み込みしてください',
          '問題が続く場合はサポートにお問い合わせください',
        ];
    }
  }

  /**
   * エラーログを取得
   */
  static getErrorLogs(): any[] {
    try {
      return JSON.parse(localStorage.getItem('calendar_error_logs') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * エラーログをクリア
   */
  static clearErrorLogs(): void {
    localStorage.removeItem('calendar_error_logs');
  }
}
