# AI Schedule Assistant

🤖 AI駆動のスケジュール管理アシスタント - Google Calendarと連携し、AIがタスクを提案・最適化する次世代のスケジュール管理アプリケーション

## 🎯 プロジェクト概要

AI Schedule Assistantは、Google Calendarとの双方向同期、OpenAI GPT-4oによるインテリジェントなタスク提案、生産性分析機能を統合したWebアプリケーションです。

### 主要機能

- 📅 **Google Calendar統合** - リアルタイム双方向同期
- 🤖 **AI駆動タスク提案** - GPT-4oによる準備タスク自動生成
- 📊 **生産性分析** - データ駆動の改善提案
- 🔔 **スマート通知** - Discord/ブラウザ通知対応
- 💬 **AIメンター** - パーソナル生産性コーチング

## 🛠 技術スタック

### フロントエンド
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **React**

### バックエンド・データベース
- **Supabase** (PostgreSQL + 認証)
- **Row Level Security (RLS)**

### AI・外部API
- **OpenAI GPT-4o** (タスク提案・分析)
- **Google Calendar API** (スケジュール同期)
- **Discord Webhook** (通知)

### 開発・デプロイ
- **Vercel** (ホスティング)
- **GitHub Actions** (CI/CD)
- **ESLint + Prettier** (コード品質)

## 🚀 開発環境セットアップ

### 前提条件
- Node.js 18.17+
- npm または yarn
- Git

### インストール手順

```bash
# リポジトリクローン
git clone https://github.com/kotashimizu/ai-schedule-assistant.git
cd ai-schedule-assistant

# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env.local
# .env.localファイルを編集して必要な環境変数を設定

# 開発サーバー起動
npm run dev
```

### 必要な環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Google Calendar API
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Discord (オプション)
DISCORD_WEBHOOK_URL=your_discord_webhook_url
```

## 📋 開発プロセス

### ワークフロー
1. タスクファイル確認: `.kiro/specs/ai-schedule-assistant/tasks.md`
2. feature ブランチ作成
3. 実装・テスト
4. コミット・プッシュ
5. プルリクエスト作成

### コミット規則
- `feat:` 新機能追加
- `fix:` バグ修正
- `test:` テスト追加・修正
- `docs:` ドキュメント更新
- `refactor:` リファクタリング

## 🏗 アーキテクチャ

### プロジェクト構造
```
ai-schedule-assistant/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── dashboard/    # メインダッシュボード
│   │   ├── settings/     # 設定画面
│   │   └── api/         # API Routes
│   └── components/       # React コンポーネント
│       ├── ui/          # 再利用可能UIコンポーネント
│       ├── calendar/    # カレンダー関連
│       └── tasks/       # タスク管理関連
├── lib/                 # ユーティリティ・設定
│   ├── supabase/        # Supabase クライアント
│   ├── openai/          # OpenAI API
│   └── google/          # Google Calendar API
├── types/               # TypeScript 型定義
└── .kiro/specs/        # プロジェクト仕様書
```

### データベース設計
```sql
-- ユーザー管理
users (id, email, google_refresh_token, settings)

-- イベント管理
events (id, user_id, google_event_id, title, start_time, end_time)

-- タスク管理
tasks (id, user_id, title, description, priority, status, estimated_time)

-- 通知管理
notifications (id, user_id, type, message, sent_at)

-- 分析ログ
analytics_logs (id, user_id, action, data, created_at)
```

## 📊 パフォーマンス目標

- **UI応答時間**: 300ms以内
- **AI処理時間**: P95 2秒以内、P99 5秒以内
- **アップタイム**: 99.5%以上
- **API使用量**: 月間50万トークン制限

## 🔐 セキュリティ

- Google OAuth2 PKCE認証
- Supabase Row Level Security (RLS)
- APIトークン暗号化ストレージ
- CORS・CSRFプロテクション

## 📈 コスト管理

- OpenAI API: 月額25ドル制限
- 80%到達時のGPT-3.5自動切り替え
- Supabase使用量監視

## 🧪 テスト戦略

- **単体テスト**: Jest + React Testing Library
- **E2Eテスト**: Playwright
- **API テスト**: Supabase テストスイート
- **パフォーマンステスト**: Lighthouse CI

## 🚀 デプロイメント

### 本番環境
- **ホスティング**: Vercel
- **データベース**: Supabase Production
- **CI/CD**: GitHub Actions
- **監視**: Vercel Analytics + Supabase Insights

### ステージング環境
- **ブランチ**: `develop`
- **自動デプロイ**: Pull Request毎
- **テストデータ**: サンドボックス環境

## 🤝 コントリビューション

1. Issueを作成して機能要求・バグ報告
2. Forkしてfeatureブランチ作成
3. コード実装・テスト追加
4. Pull Request作成

## 📄 ライセンス

MIT License - 詳細は [LICENSE](LICENSE) ファイルを参照

## 🔗 関連リンク

- [プロジェクト仕様書](.kiro/specs/ai-schedule-assistant/)
- [API ドキュメント](docs/api.md)
- [デプロイガイド](docs/deployment.md)

---

**開発者**: AI駆動開発チーム  
**更新日**: 2025-08-03  
**バージョン**: 0.1.0-alpha