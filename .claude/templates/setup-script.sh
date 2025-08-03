#!/bin/bash
# AI駆動開発用hooksテンプレート設定スクリプト（既存ファイル調整版）
# 使用方法: ./setup-script.sh <プロジェクト表示名> <プロジェクトスラッグ名>
# 前提: .kiro/specs/<プロジェクトスラッグ名>/ に既存ファイルが存在する

# 引数チェック
if [ $# -lt 2 ]; then
    echo "使用方法: $0 <プロジェクト表示名> <プロジェクトスラッグ名>"
    echo "例: $0 'MyProject' 'my-project-system'"
    echo ""
    echo "前提条件: 以下のファイルが既に存在していること"
    echo "  - .kiro/specs/<プロジェクトスラッグ名>/requirements.md"
    echo "  - .kiro/specs/<プロジェクトスラッグ名>/design.md"
    echo "  - .kiro/specs/<プロジェクトスラッグ名>/tasks.md"
    exit 1
fi

PROJECT_NAME="$1"
PROJECT_SLUG="$2"
SPECS_DIR="./.kiro/specs/$PROJECT_SLUG"

# 出力ファイルパス
OUTPUT_FILE="./.claude/settings.toml"

echo "🔧 AI駆動開発用hooksテンプレートを設定しています..."
echo "プロジェクト表示名: $PROJECT_NAME"
echo "プロジェクトスラッグ: $PROJECT_SLUG"
echo "仕様書ディレクトリ: $SPECS_DIR"

# 既存ファイルの存在確認
echo "📋 既存ファイルの確認中..."
missing_files=""

if [ ! -f "$SPECS_DIR/requirements.md" ]; then
    missing_files="$missing_files\n  - $SPECS_DIR/requirements.md"
fi

if [ ! -f "$SPECS_DIR/design.md" ]; then
    missing_files="$missing_files\n  - $SPECS_DIR/design.md"
fi

if [ ! -f "$SPECS_DIR/tasks.md" ]; then
    missing_files="$missing_files\n  - $SPECS_DIR/tasks.md"
fi

if [ -n "$missing_files" ]; then
    echo "❌ 以下のファイルが見つかりません:"
    echo -e "$missing_files"
    echo ""
    echo "次のコマンドで必要なファイルを作成してから再実行してください:"
    echo "mkdir -p $SPECS_DIR"
    echo "touch $SPECS_DIR/requirements.md $SPECS_DIR/design.md $SPECS_DIR/tasks.md"
    exit 1
fi

echo "✅ 既存ファイル確認完了"

# 必要なディレクトリを作成
echo "📁 必要なディレクトリを作成中..."
mkdir -p "./progress"
mkdir -p "./learning"
mkdir -p "./.claude"

# テンプレートをコピーして変数を置換
cp "./.claude/templates/generic-hooks.toml" "$OUTPUT_FILE"

# 変数置換
sed -i "s|PROJECT_NAME|$PROJECT_NAME|g" "$OUTPUT_FILE"
sed -i "s|PROJECT_SLUG|$PROJECT_SLUG|g" "$OUTPUT_FILE"

echo "✅ hooks設定が完了しました: $OUTPUT_FILE"
echo "✅ ディレクトリ作成完了"

# AI駆動開発テンプレートの適用・強化
echo ""
echo "🤖 AI駆動開発テンプレートの適用中..."

# tasks.mdにAI駆動開発ワークフローの追加
echo "📋 tasks.mdにAI駆動開発ワークフローを追加中..."

# tasks.mdの既存内容をバックアップ
cp "$SPECS_DIR/tasks.md" "$SPECS_DIR/tasks.md.backup"

# AI駆動開発セクションを追加
cat >> "$SPECS_DIR/tasks.md" << 'EOF'

# ===== AI駆動開発ワークフロー =====
## Git操作統合ワークフロー

### 子タスク完了時の標準フロー
各子タスク完了時は以下の手順を実行：

1. **実装完了** → **テスト実行** → **コミット** → **プッシュ**
2. **タスクファイル更新** ([ ] → [x])
3. **次のブランチ作成** (必要に応じて)

### ブランチ戦略
```
main ← develop ← feature/[task-name]
```

## 子タスク実装テンプレート

### 機能実装タスクの標準構成
各機能は以下の子タスクに分割：

#### [機能名] 実装
- [ ] **設計確認**: requirements.md、design.mdとの整合性確認
- [ ] **環境準備**: ブランチ作成 `git checkout -b feature/[task-name]`
- [ ] **基本実装**: コア機能の実装
  - [ ] フロントエンド実装
  - [ ] バックエンド実装
  - [ ] データベース関連
- [ ] **テスト実装**: 自動テスト作成
  - [ ] ユニットテスト
  - [ ] 統合テスト
  - [ ] E2Eテスト（必要に応じて）
- [ ] **品質確認**: 
  - [ ] ESLint/Prettier実行
  - [ ] 型チェック実行
  - [ ] セキュリティチェック
- [ ] **ドキュメント更新**: READMEやAPI仕様書更新
- [ ] **Git操作**: 
  - [ ] `git add .`
  - [ ] `git commit -m "feat: [機能名] implementation"`
  - [ ] `git push origin feature/[task-name]`
- [ ] **人間検証**: コードレビュー・動作確認
- [ ] **マージ**: プルリクエスト作成・承認・マージ
- [ ] **クリーンアップ**: ブランチ削除、ローカル環境整理

### Claude Codeへの効果的な指示例
```
requirements.mdの[要件番号]に基づいて、[機能名]を実装してください。
design.mdの技術スタックに従い、以下を実装：
1. [具体的な実装内容1]
2. [具体的な実装内容2]
3. テストも同時に作成
4. TypeScript/型安全性を重視
実装完了後、git commit まで実行してください。
```

## 進捗管理とGit統合

### タスク状態管理
- [ ] **TODO**: 未着手
- [~] **IN_PROGRESS**: 実装中（ブランチ作成済み）
- [x] **DONE**: 完了（マージ済み）

### Git操作チェックリスト
各タスク完了時に必須：
- [ ] 適切なコミットメッセージ
- [ ] feature ブランチでの作業
- [ ] コンフリクト解決（必要に応じて）
- [ ] プルリクエスト作成
- [ ] コードレビュー実施
- [ ] マージ後のブランチ削除

### 緊急時の対応
- **作業中断時**: `git stash` でコミット前変更を保存
- **ロールバック時**: `git revert` で安全に巻き戻し
- **ホットフィックス**: `hotfix/` ブランチで緊急対応

EOF

echo "✅ tasks.mdにAI駆動開発ワークフローを追加完了"

# requirements.mdにAI駆動開発ガイドラインを追加（存在しない場合のみ）
if ! grep -q "AI駆動開発" "$SPECS_DIR/requirements.md"; then
    echo "📋 requirements.mdにAI駆動開発ガイドラインを追加中..."
    
    cat >> "$SPECS_DIR/requirements.md" << 'EOF'

# ===== AI駆動開発ガイドライン =====

## Claude Codeでの実装方針
### 効果的な指示方法
1. **具体的な要件参照**: 「要件[番号]に基づいて」
2. **段階的実装**: 大きな機能は小さなタスクに分割
3. **テスト駆動**: 「テストも同時に作成してください」
4. **品質基準明示**: 「TypeScript/型安全性を重視」
5. **Git操作統合**: 「実装完了後、コミットまで実行」

### AI実装品質基準
- **型安全性**: TypeScript/型ヒント必須
- **テストカバレッジ**: 80%以上維持
- **セキュリティ**: 脆弱性チェック必須
- **パフォーマンス**: 要件定義の性能基準達成
- **ドキュメント**: 実装と同期した最新状態

### 人間確認必須項目
- **本番デプロイ**: 必ず人間の承認
- **データベース変更**: スキーマ変更は人間確認
- **セキュリティ設定**: 認証・認可設定は人間検証
- **外部サービス連携**: API連携は人間で動作確認
EOF

    echo "✅ requirements.mdにAI駆動開発ガイドラインを追加完了"
fi

# design.mdにAI実装考慮事項を追加（存在しない場合のみ）
if ! grep -q "AI実装" "$SPECS_DIR/design.md"; then
    echo "🏗️ design.mdにAI実装考慮事項を追加中..."
    
    cat >> "$SPECS_DIR/design.md" << 'EOF'

# ===== AI実装考慮事項 =====

## Claude Code実装最適化
### 実装しやすい設計原則
1. **単一責任原則**: 各関数・クラスは単一の責任
2. **依存性注入**: テスタブルな構造
3. **インターフェース指向**: 抽象化による柔軟性
4. **設定外部化**: 環境変数での設定管理

### AI実装ガイドライン
- **明確な関数名**: AIが理解しやすい命名規則
- **小さな関数**: 単一機能に集中した実装
- **エラーハンドリング**: 例外処理の標準化
- **ログ出力**: デバッグしやすいログレベル設定

## 開発フロー（AI駆動）
### 1. 設計フェーズ
- 要件定義書の詳細分析
- API仕様書作成（OpenAPI/Swagger）
- データベーススキーマ設計

### 2. 実装フェーズ（Claude Code）
- コンポーネント/モジュール単位での実装
- 自動テスト作成
- ドキュメント更新

### 3. 検証フェーズ（人間）
- コードレビュー
- 統合テスト
- セキュリティチェック

### 4. デプロイフェーズ
- 自動デプロイパイプライン
- 本番監視設定
- ロールバック準備
EOF

    echo "✅ design.mdにAI実装考慮事項を追加完了"
fi

echo ""
echo "🎯 AI駆動開発環境セットアップ完了！"
echo ""
echo "✅ 適用された機能:"
echo "  - AI駆動開発用hooks設定"
echo "  - Git操作統合ワークフロー"
echo "  - 子タスク詳細化テンプレート"
echo "  - Claude Code効果的指示例"
echo ""
echo "📋 次のステップ:"
echo "1. Claude Codeを再起動してhooksを有効化"
echo "2. 既存のtasks.mdで子タスクを詳細化"
echo "3. Git操作統合ワークフローに従って開発開始"
echo ""
echo "💡 使用方法:"
echo "  各機能実装時は「AI駆動開発ワークフロー」セクションを参照"
echo "  Claude Codeへの指示は「効果的な指示例」を活用"
echo ""
echo "📄 バックアップファイル:"
echo "  - $SPECS_DIR/tasks.md.backup (元のファイル)"