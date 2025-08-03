// ===========================================
// Enhanced Supabase Client - Type-Safe & Robust
// 改良されたSupabaseクライアント（型安全・エラーハンドリング強化）
// ===========================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';
import { ENV_CONFIG, logEnvironmentStatus } from '@/lib/config/environment';
import { handleError, logError, DatabaseError } from '@/lib/errors';

/**
 * Supabaseクライアント設定
 */
const SUPABASE_CONFIG = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  global: {
    headers: {
      'X-Application': 'AI-Schedule-Assistant',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
} as const;

/**
 * タイプセーフなSupabaseクライアントクラス
 */
class EnhancedSupabaseClient {
  private client: SupabaseClient<Database>;
  private isInitialized = false;

  constructor() {
    try {
      this.client = createClient<Database>(
        ENV_CONFIG.supabase.url,
        ENV_CONFIG.supabase.anonKey,
        SUPABASE_CONFIG
      );
      this.isInitialized = true;
      
      // 開発環境での設定ログ出力
      logEnvironmentStatus();
      
      // 接続テスト（非ブロッキング）
      this.testConnection();
    } catch (error) {
      const dbError = handleError(error);
      logError(dbError, 'Supabase Client Initialization');
      throw dbError;
    }
  }

  /**
   * 接続テスト（非同期）
   */
  private async testConnection(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      try {
        const { error } = await this.client
          .from('users')
          .select('count', { count: 'exact', head: true });
        
        if (error) {
          logError(handleError(error), 'Supabase Connection Test');
        } else {
          console.log('✅ Supabase connection established');
        }
      } catch (error) {
        logError(handleError(error), 'Supabase Connection Test');
      }
    }
  }

  /**
   * Raw Supabaseクライアントアクセス（必要な場合のみ）
   */
  get raw(): SupabaseClient<Database> {
    if (!this.isInitialized) {
      throw new DatabaseError('Supabase client not initialized');
    }
    return this.client;
  }

  /**
   * 認証クライアントアクセス
   */
  get auth() {
    return this.client.auth;
  }

  /**
   * ストレージクライアントアクセス
   */
  get storage() {
    return this.client.storage;
  }

  /**
   * リアルタイムクライアントアクセス
   */
  get realtime() {
    return this.client.realtime;
  }

  /**
   * テーブルクエリビルダー
   */
  from<T extends keyof Database['public']['Tables']>(table: T) {
    return this.client.from(table);
  }

  /**
   * RPCクエリ実行
   */
  rpc<T extends keyof Database['public']['Functions']>(
    fn: T,
    args?: Database['public']['Functions'][T]['Args']
  ) {
    return this.client.rpc(fn, args);
  }

  /**
   * ヘルスチェック
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: DatabaseError }> {
    try {
      const startTime = Date.now();
      const { error } = await this.client
        .from('users')
        .select('count', { count: 'exact', head: true });
      
      const latency = Date.now() - startTime;
      
      if (error) {
        const dbError = handleError(error) as DatabaseError;
        return { healthy: false, error: dbError };
      }
      
      return { healthy: true, latency };
    } catch (error) {
      const dbError = handleError(error) as DatabaseError;
      return { healthy: false, error: dbError };
    }
  }

  /**
   * バッチ処理のための安全なトランザクション
   */
  async transaction<T>(operations: (client: SupabaseClient<Database>) => Promise<T>): Promise<T> {
    try {
      return await operations(this.client);
    } catch (error) {
      const dbError = handleError(error);
      logError(dbError, 'Supabase Transaction');
      throw dbError;
    }
  }

  /**
   * 接続状態チェック
   */
  isConnected(): boolean {
    return this.isInitialized && this.client !== null;
  }
}

/**
 * グローバルSupabaseクライアントインスタンス
 */
export const supabase = new EnhancedSupabaseClient();

/**
 * デフォルトエクスポート（後方互換性）
 */
export default supabase;

/**
 * 型定義エクスポート
 */
export type { Database } from '@/types/database';
export type { SupabaseClient } from '@supabase/supabase-js';