-- AI Schedule Assistant - 開発用サンプルデータ

-- サンプルユーザー作成
INSERT INTO users (id, email, settings) VALUES 
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'test@example.com',
  '{
    "discord_webhook_url": null,
    "notification_preferences": {
      "browser": true,
      "discord": false,
      "email": true
    },
    "ai_preferences": {
      "suggestion_frequency": "medium",
      "auto_reschedule": true
    }
  }'::jsonb
);

-- サンプルイベント作成
INSERT INTO events (user_id, title, description, start_time, end_time, location) VALUES 
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'チームミーティング',
  'プロジェクトの進捗確認と次週の計画',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '3 hours',
  'オンライン会議室A'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'クライアント打ち合わせ',
  '新機能の要件定義について',
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '1 day 2 hours',
  '東京オフィス'
);

-- サンプルタスク作成
INSERT INTO tasks (user_id, title, description, priority, status, estimated_time, due_date) VALUES 
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'プレゼン資料作成',
  'クライアント向けの提案資料を作成する',
  'high',
  'pending',
  120,
  NOW() + INTERVAL '1 day'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'コードレビュー',
  'プルリクエストのレビューを実施',
  'medium',
  'in_progress',
  60,
  NOW() + INTERVAL '4 hours'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'メール返信',
  '未読メールへの返信',
  'low',
  'completed',
  30,
  NOW() - INTERVAL '1 hour'
);

-- サンプル通知作成
INSERT INTO notifications (user_id, type, title, message, sent_at) VALUES 
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'reminder',
  'タスクの締切が近づいています',
  'プレゼン資料作成の締切まで24時間を切りました',
  NOW() - INTERVAL '1 hour'
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'suggestion',
  'AIからの提案',
  'ミーティングの前に資料の準備時間を確保することをお勧めします',
  NOW() - INTERVAL '30 minutes'
);

-- サンプル分析ログ作成
INSERT INTO analytics_logs (user_id, action, data) VALUES 
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'task_completed',
  '{"task_id": "sample", "completion_time_minutes": 45, "estimated_time_minutes": 30}'::jsonb
),
(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'ai_suggestion_accepted',
  '{"suggestion_type": "break_reminder", "user_response": "accepted"}'::jsonb
);