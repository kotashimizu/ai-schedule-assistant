# AI駆動開発用 Claude Code Hooks テンプレート

Claude Codeによる**完全AI駆動開発**をサポートする統合テンプレートです。要件定義→設計→実装→検証のサイクルを自動化し、人間とAIの最適な役割分担を実現します。

## 🤖 AI駆動開発の哲学
- **人間**: 戦略・要件定義・品質確認・創造的判断
- **AI (Claude Code)**: 設計・実装・テスト・ドキュメント・パターン認識
- **Hooks**: 開発プロセスの一貫性保証・品質ゲートキーパー

## 📁 ファイル構成

```
.claude/templates/
├── generic-hooks.toml     # 汎用hooksテンプレート
├── setup-script.sh       # 自動設定スクリプト
└── README.md             # このファイル
```

## 🚀 使用方法

### 1. 自動設定（推奨）
```bash
cd /path/to/new-project
cp -r /path/to/shiftcare_360/.claude/templates ./.claude/
./.claude/templates/setup-script.sh "MyProject" "my-project-system"
```

### 2. 手動設定
```bash
# テンプレートをコピー
cp ./.claude/templates/generic-hooks.toml ./.claude/settings.toml

# 以下の変数を手動で置換:
# PROJECT_NAME → プロジェクト表示名
# PROJECT_SLUG → プロジェクトスラッグ名
```

## 📋 前提条件

固定ディレクトリ構造（.kiro/specs形式）を使用します：

### 必須ファイル
- **要件定義書**: プロジェクトの要件を記載
- **設計書**: 技術スタック、システム設計を記載
- **タスクファイル**: チェックボックス形式のタスクリスト

### 固定ディレクトリ構造
```
project/
├── .kiro/
│   └── specs/
│       └── [project-slug]/   # プロジェクト固有のスラッグ名
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── progress/                 # 自動作成: 進捗記録
├── learning/                 # 自動作成: 学習ログ
└── .claude/
    └── settings.toml         # hooks設定
```

### 例
プロジェクトスラッグが「my-project-system」の場合：
```
.kiro/specs/my-project-system/requirements.md
.kiro/specs/my-project-system/design.md
.kiro/specs/my-project-system/tasks.md
```

## ⚙️ 機能一覧

### 📋 開発支援機能
- **要件定義確認**: ファイル編集前に要件を表示
- **設計書参照**: 技術スタック・設計方針を確認
- **タスク進捗管理**: 未完了・完了済みタスクを表示

### 📊 品質管理機能
- **コミット前チェック**: 品質要件の確認リスト
- **技術判断支援**: ベストプラクティス遵守確認
- **エラー防止**: 重大な妥協を防ぐチェック

### 📚 記録・学習機能
- **進捗ログ**: 作業履歴の自動記録
- **学習ログ**: 実装で得た知見の記録
- **ワークフロー支援**: 次ステップの案内

## 🎯 カスタマイズのポイント

### プロジェクト固有の調整
1. **ファイルパス**: プロジェクトのディレクトリ構造に合わせる
2. **チェック項目**: プロジェクトの品質要件に応じて調整
3. **表示メッセージ**: プロジェクト名やドメインに合わせる

### よくあるカスタマイズ例
```toml
# ファイルパスの調整例
file_paths = ["lib/**/*", "test/**/*"]  # Ruby/Rails用
file_paths = ["pkg/**/*", "cmd/**/*"]   # Go用
file_paths = ["src/**/*", "tests/**/*"] # Python用

# チェック項目の調整例
echo "- [ ] API仕様書との整合性は確認したか？"
echo "- [ ] データベース設計は適切か？"
echo "- [ ] パフォーマンス要件は満たしているか？"
```

## 🔄 非エンジニア向け使用手順

### ステップ1: プロジェクトフォルダの準備
```bash
# 新しいプロジェクトフォルダを作成
mkdir my-new-project
cd my-new-project
```

### ステップ2: テンプレートのコピー
```bash
# ShiftCare360からテンプレートをコピー
cp -r /path/to/shiftcare_360/.claude/templates ./.claude/
```

### ステップ3: 自動セットアップ実行
```bash
# プロジェクト名とスラッグ名を指定して実行
./.claude/templates/setup-script.sh "My New Project" "my-new-project"
```

### ステップ4: Claude Codeの再起動
- Claude Codeアプリを完全に終了
- 再度起動して新しいプロジェクトフォルダを開く

### 作成されるファイル
実行後、以下のファイルが自動作成されます：
- `.kiro/specs/my-new-project/requirements.md` - 要件定義書テンプレート
- `.kiro/specs/my-new-project/design.md` - 設計書テンプレート
- `.kiro/specs/my-new-project/tasks.md` - タスクファイルテンプレート
- `.claude/settings.toml` - hooks設定

## 🔧 トラブルシューティング

### よくある問題
1. **ファイルが見つからない**: パス設定を確認
2. **hooksが動作しない**: Claude Codeを再起動
3. **権限エラー**: setup-script.shに実行権限を付与

### デバッグ方法
```bash
# hooks設定の確認
cat .claude/settings.toml

# ファイル存在チェック
ls -la docs/requirements.md docs/design.md docs/tasks.md

# ディレクトリ権限確認
ls -la .claude/
```

## 💡 使用上の注意

- **既存設定の上書き**: setup-script.shは既存の.claude/settings.tomlを上書きします
- **プロジェクト依存**: テンプレートは特定のファイル構造を前提としています
- **Claude Code再起動**: hooks設定変更後は再起動が必要です

## 📖 関連ドキュメント

- [Claude Code公式ドキュメント](https://docs.anthropic.com/en/docs/claude-code)
- [Hooks設定ガイド](https://docs.anthropic.com/en/docs/claude-code/settings)

---

**作成元**: ShiftCare360プロジェクト  
**バージョン**: v1.0  
**最終更新**: 2025-08-03