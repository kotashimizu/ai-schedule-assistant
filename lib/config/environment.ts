// ===========================================
// Environment Configuration - Type-Safe & Validated
// 環境変数の型安全な管理と検証
// ===========================================

import { EnvironmentConfig } from '@/types/shared';

/**
 * 環境変数検証エラー
 */
export class EnvironmentValidationError extends Error {
  constructor(message: string, public readonly missingVars: string[]) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

/**
 * 必須環境変数の検証
 */
function validateRequiredEnvVar(key: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new EnvironmentValidationError(
      `Missing required environment variable: ${key}`,
      [key]
    );
  }
  return value.trim();
}

/**
 * オプション環境変数の検証
 */
function validateOptionalEnvVar(value: string | undefined): string | undefined {
  return value && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * 環境変数設定の取得と検証
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const missingVars: string[] = [];
  const errors: string[] = [];

  try {
    // Supabase設定（必須）
    const supabaseUrl = validateRequiredEnvVar(
      'NEXT_PUBLIC_SUPABASE_URL', 
      process.env.NEXT_PUBLIC_SUPABASE_URL
    );
    const supabaseAnonKey = validateRequiredEnvVar(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // URL形式の検証
    try {
      new URL(supabaseUrl);
    } catch {
      errors.push('NEXT_PUBLIC_SUPABASE_URL must be a valid URL');
    }

    const config: EnvironmentConfig = {
      supabase: {
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        serviceRoleKey: validateOptionalEnvVar(process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
      // オプション設定
      openai: process.env.OPENAI_API_KEY ? {
        apiKey: validateRequiredEnvVar('OPENAI_API_KEY', process.env.OPENAI_API_KEY),
      } : undefined,
      google: (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) ? {
        clientId: validateRequiredEnvVar('GOOGLE_CLIENT_ID', process.env.GOOGLE_CLIENT_ID),
        clientSecret: validateRequiredEnvVar('GOOGLE_CLIENT_SECRET', process.env.GOOGLE_CLIENT_SECRET),
      } : undefined,
      discord: process.env.DISCORD_WEBHOOK_URL ? {
        webhookUrl: validateRequiredEnvVar('DISCORD_WEBHOOK_URL', process.env.DISCORD_WEBHOOK_URL),
      } : undefined,
    };

    return config;
  } catch (error) {
    if (error instanceof EnvironmentValidationError) {
      missingVars.push(...error.missingVars);
    }
  }

  // エラーがある場合は詳細なメッセージと共に例外を投げる
  if (missingVars.length > 0 || errors.length > 0) {
    const errorMessage = [
      'Environment configuration validation failed:',
      ...(missingVars.length > 0 ? [`Missing variables: ${missingVars.join(', ')}`] : []),
      ...errors,
      '',
      'Please check your .env.local file and ensure all required variables are set.',
    ].join('\n');

    throw new EnvironmentValidationError(errorMessage, missingVars);
  }

  // TypeScriptコンパイラを満足させるため（実際にはここに到達しない）
  throw new EnvironmentValidationError('Unexpected error in environment validation', []);
}

/**
 * 設定済み環境変数（グローバル）
 * 起動時に一度だけ検証される
 */
export const ENV_CONFIG = getEnvironmentConfig();

/**
 * 開発環境かどうかの判定
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * 本番環境かどうかの判定
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * テスト環境かどうかの判定
 */
export const isTest = process.env.NODE_ENV === 'test';

/**
 * 環境設定のログ出力（開発環境のみ、機密情報は除く）
 */
export function logEnvironmentStatus(): void {
  if (!isDevelopment) return;

  console.log('🔧 Environment Configuration Status:');
  console.log(`   • Node Environment: ${process.env.NODE_ENV}`);
  console.log(`   • Supabase URL: ${ENV_CONFIG.supabase.url}`);
  console.log(`   • OpenAI: ${ENV_CONFIG.openai ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   • Google Calendar: ${ENV_CONFIG.google ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   • Discord: ${ENV_CONFIG.discord ? '✅ Configured' : '❌ Not configured'}`);
}