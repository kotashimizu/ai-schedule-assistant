-- AI Schedule Assistant - セキュリティ設定ロールバック
-- 勝手に実装したRLS設定を完全に取り消し

-- 1. 開発用一時ポリシーを削除
DROP POLICY IF EXISTS "Development: Temporary anonymous read users" ON users;
DROP POLICY IF EXISTS "Development: Temporary anonymous read events" ON events;
DROP POLICY IF EXISTS "Development: Temporary anonymous read tasks" ON tasks;
DROP POLICY IF EXISTS "Development: Temporary anonymous read notifications" ON notifications;
DROP POLICY IF EXISTS "Development: Temporary anonymous read analytics" ON analytics_logs;

-- 2. 認証ポリシーを削除
DROP POLICY IF EXISTS "Users can view own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can manage own events" ON events;
DROP POLICY IF EXISTS "Users can view own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can manage own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view own analytics" ON analytics_logs;
DROP POLICY IF EXISTS "Users can insert own analytics" ON analytics_logs;

-- 3. セキュリティ監査関数を削除
DROP FUNCTION IF EXISTS log_security_event(TEXT, JSONB);

-- 4. RLS無効化（元の状態に戻す）
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE events DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_logs DISABLE ROW LEVEL SECURITY;

-- 5. 確認用コメント
-- これで元の状態（RLS無効、制限なしアクセス）に戻りました