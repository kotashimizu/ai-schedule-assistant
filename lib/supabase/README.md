# Supabase統合セットアップ

## 1. Supabaseプロジェクト作成

1. [Supabase Dashboard](https://app.supabase.com) にアクセス
2. 「New Project」をクリック
3. プロジェクト名: `ai-schedule-assistant`
4. データベースパスワードを設定
5. リージョン選択（推奨: Asia Northeast (Tokyo)）

## 2. データベースセットアップ

### SQLエディタでスキーマ作成
1. Supabase Dashboard → SQL Editor
2. `database.sql` ファイルの内容をコピー&ペースト
3. 「Run」をクリックしてテーブル作成

### 作成されるテーブル
- `users` - ユーザー情報
- `events` - カレンダーイベント  
- `tasks` - タスク管理
- `notifications` - 通知
- `analytics_logs` - 分析ログ

## 3. 環境変数設定

`.env.local` ファイルを作成:

```bash
# Supabase設定（Dashboard → Settings → API から取得）
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 4. 認証設定（後のフェーズで実装）

### Google OAuth設定
1. Dashboard → Authentication → Providers
2. Google Providerを有効化
3. Client IDとClient Secretを設定

## 5. Row Level Security (RLS)

現在は無効（フェーズ11.2で実装予定）
本番環境では必ず有効化する

## 6. 使用方法

```typescript
import { supabase, userService, eventService, taskService } from '@/lib/supabase';

// ユーザー作成
const { data: user } = await userService.create({
  email: 'user@example.com'
});

// 今日のイベント取得
const { data: events } = await eventService.getTodaysEvents(userId);

// タスク作成
const { data: task } = await taskService.create({
  user_id: userId,
  title: 'サンプルタスク',
  priority: 'high'
});
```

## 7. 開発時の注意点

- 現在はRLSが無効なので、開発環境でのみ使用
- 本番環境ではRLSポリシーの実装が必須
- APIキーは環境変数で管理
- データベース操作はサービス関数を経由して実行