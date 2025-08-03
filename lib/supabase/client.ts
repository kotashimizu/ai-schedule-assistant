// ===========================================
// Supabase Client - Enhanced Version Re-export
// 改良版Supabaseクライアントの再エクスポート
// ===========================================

/**
 * Enhanced Supabase client with type safety, error handling, and validation.
 * This file maintains backward compatibility while using the enhanced client.
 * 
 * @deprecated Use @/lib/supabase/client-enhanced directly for new code
 */
export { supabase, default } from './client-enhanced';

// Re-export types for convenience
export type { Database } from '@/types/database';
export type { SupabaseClient } from '@supabase/supabase-js';