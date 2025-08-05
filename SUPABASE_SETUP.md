# 🚀 Supabase実環境セットアップ手順

## 1. Supabaseプロジェクト作成

### ステップ1: ダッシュボードアクセス
1. [Supabase Dashboard](https://app.supabase.com) にアクセス
2. GitHubアカウントでログイン

### ステップ2: 新プロジェクト作成
1. 「New Project」をクリック
2. 組織選択（個人アカウント）
3. プロジェクト設定：
   - **Project name**: `ai-schedule-assistant`
   - **Database Password**: 強固なパスワードを生成・記録
   - **Region**: `Asia Northeast (Tokyo)` 
   - **Pricing Plan**: `Free tier`

### ステップ3: プロジェクト初期化待機
- 約2-3分でプロジェクトが作成されます
- ダッシュボードが表示されるまで待機

## 2. API設定情報取得

### ダッシュボードから以下を取得：
1. **Settings** → **API** へ移動
2. 以下の値をコピー：
   ```
   Project URL: https://[project-id].supabase.co
   Project API Key (anon/public): eyJ... (長いトークン)
   ```

## 3. 環境変数設定

### .env.localファイル作成
```bash
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ[your-anon-key]

# 他の環境変数（後で設定）
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DISCORD_WEBHOOK_URL=...
```

## 4. データベーススキーマ作成

### SQLエディタでテーブル作成
1. **SQL Editor** へ移動
2. 新しいクエリを作成
3. `lib/supabase/database.sql` の内容をコピー&ペースト
4. **Run** をクリックして実行
5. 成功メッセージを確認

### 作成されるテーブル確認
**Table Editor** で以下のテーブルが作成されていることを確認：
- ✅ `users`
- ✅ `events` 
- ✅ `tasks`
- ✅ `notifications`
- ✅ `analytics_logs`

## 5. 接続テスト

### 開発サーバーで接続確認
```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセスし、エラーがないことを確認

## 6. セキュリティ設定（現時点では無効）

**注意**: 現在はRLS（Row Level Security）を無効にしているため、開発環境でのみ使用してください。

### 本番環境での注意点：
- RLSポリシーの実装が必須（フェーズ11.2で実装予定）
- 環境変数の適切な管理
- APIキーの保護

---

## 🎯 完了確認チェックリスト

- [ ] Supabaseプロジェクト作成完了
- [ ] 環境変数(.env.local)設定完了
- [ ] データベーススキーマ実行完了
- [ ] テーブル作成確認完了
- [ ] 開発サーバー接続テスト完了

すべて完了したら **1.2タスクの[x]チェック** を入れてください！