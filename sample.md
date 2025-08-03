<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIスケジュールアシスタント</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', sans-serif;
            background-color: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }
        
        /* ヘッダーとナビゲーション */
        .header {
            background-color: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header-content {
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .logo {
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status-bar {
            display: flex;
            gap: 20px;
            align-items: center;
            font-size: 14px;
            color: #666;
        }
        
        .status-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background-color: #10b981;
        }
        
        .nav {
            display: flex;
            gap: 0;
        }
        
        .nav-item {
            padding: 12px 24px;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: all 0.2s;
            font-weight: 500;
            color: #6b7280;
            background: none;
            border: none;
            font-size: 15px;
        }
        
        .nav-item:hover {
            color: #2563eb;
            background-color: #f9fafb;
        }
        
        .nav-item.active {
            color: #2563eb;
            border-bottom-color: #2563eb;
        }
        
        /* メインコンテンツ */
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 30px 20px;
        }
        
        .page {
            display: none;
        }
        
        .page.active {
            display: block;
        }
        
        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 30px;
        }
        
        .page-title {
            font-size: 28px;
            font-weight: bold;
        }
        
        /* ボタンスタイル */
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-primary {
            background-color: #2563eb;
            color: white;
        }
        
        .btn-primary:hover {
            background-color: #1d4ed8;
        }
        
        .btn-secondary {
            background-color: #f3f4f6;
            color: #374151;
        }
        
        .btn-secondary:hover {
            background-color: #e5e7eb;
        }
        
        .btn-success {
            background-color: #10b981;
            color: white;
        }
        
        .btn-success:hover {
            background-color: #059669;
        }
        
        .btn-danger {
            background-color: #ef4444;
            color: white;
        }
        
        /* カード共通スタイル */
        .card {
            background-color: #fff;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            margin-bottom: 20px;
        }
        
        /* ダッシュボード */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .metric-card {
            background-color: #fff;
            padding: 24px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .metric-value {
            font-size: 36px;
            font-weight: bold;
            color: #2563eb;
        }
        
        .metric-label {
            font-size: 14px;
            color: #6b7280;
            margin-top: 5px;
        }
        
        .dashboard-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
        }
        
        /* カレンダーウィジェット */
        .calendar-widget {
            position: sticky;
            top: 100px;
        }
        
        .mini-calendar-day {
            padding: 8px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s;
            border-radius: 6px;
        }
        
        .mini-calendar-day:hover {
            background-color: #f3f4f6;
        }
        
        .mini-calendar-day.today {
            background-color: #2563eb;
            color: white;
            font-weight: bold;
        }
        
        .mini-calendar-day.has-event {
            position: relative;
        }
        
        .mini-calendar-day.has-event::after {
            content: '';
            position: absolute;
            bottom: 2px;
            left: 50%;
            transform: translateX(-50%);
            width: 4px;
            height: 4px;
            background-color: #ef4444;
            border-radius: 50%;
        }
        
        .schedule-timeline {
            position: relative;
            padding-left: 20px;
        }
        
        .schedule-timeline::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 2px;
            background-color: #e5e7eb;
        }
        
        /* タスク関連 */
        .task-filters {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        
        .filter-btn {
            padding: 8px 16px;
            border: 1px solid #d1d5db;
            background-color: white;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .filter-btn.active {
            background-color: #2563eb;
            color: white;
            border-color: #2563eb;
        }
        
        .task-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .task-item {
            background-color: #f9fafb;
            padding: 16px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s;
            cursor: pointer;
        }
        
        .task-item:hover {
            background-color: #f3f4f6;
            transform: translateY(-1px);
        }
        
        .task-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .checkbox {
            width: 20px;
            height: 20px;
            border: 2px solid #d1d5db;
            border-radius: 4px;
            cursor: pointer;
            flex-shrink: 0;
        }
        
        .checkbox.checked {
            background-color: #2563eb;
            border-color: #2563eb;
            position: relative;
        }
        
        .checkbox.checked::after {
            content: '✓';
            color: white;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 14px;
        }
        
        .task-info {
            flex: 1;
        }
        
        .task-title {
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .task-meta {
            font-size: 12px;
            color: #6b7280;
        }
        
        .priority-badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .priority-high {
            background-color: #fee2e2;
            color: #dc2626;
        }
        
        .priority-medium {
            background-color: #fef3c7;
            color: #d97706;
        }
        
        .priority-low {
            background-color: #dbeafe;
            color: #2563eb;
        }
        
        /* カレンダー */
        .calendar-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        
        .calendar-nav {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        
        .calendar-grid {
            display: grid;
            grid-template-columns: 200px 1fr;
            gap: 20px;
        }
        
        .time-slots {
            display: flex;
            flex-direction: column;
        }
        
        .time-slot {
            height: 60px;
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
        }
        
        .events-column {
            position: relative;
            background-color: #fff;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .event-block {
            position: absolute;
            left: 10px;
            right: 10px;
            background-color: #dbeafe;
            border-left: 4px solid #2563eb;
            padding: 8px;
            border-radius: 4px;
            font-size: 14px;
        }
        
        .event-block.meeting {
            background-color: #fce7f3;
            border-left-color: #ec4899;
        }
        
        .event-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        
        .event-item {
            background-color: #eff6ff;
            padding: 16px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
        }
        
        .event-time {
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 4px;
        }
        
        .event-title {
            font-weight: 500;
            margin-bottom: 4px;
        }
        
        .event-location {
            font-size: 12px;
            color: #6b7280;
        }
        
        /* AI提案 */
        .ai-suggestions-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
        }
        
        .ai-suggestion-card {
            background-color: #f0fdf4;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #10b981;
        }
        
        .ai-label {
            font-size: 12px;
            color: #10b981;
            font-weight: 600;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .ai-content {
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 16px;
        }
        
        .ai-actions {
            display: flex;
            gap: 10px;
        }
        
        .ai-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
            margin-bottom: 30px;
        }
        
        /* 分析 */
        .analytics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        
        .chart-container {
            background-color: #fff;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            height: 300px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #9ca3af;
        }
        
        .productivity-insights {
            display: grid;
            gap: 15px;
        }
        
        .insight-item {
            padding: 16px;
            background-color: #f9fafb;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
        }
        
        .insight-title {
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .insight-description {
            font-size: 14px;
            color: #6b7280;
        }
        
        /* 設定 */
        .settings-section {
            margin-bottom: 40px;
        }
        
        .settings-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        
        .settings-grid {
            display: grid;
            gap: 20px;
        }
        
        .setting-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .setting-label {
            font-weight: 500;
        }
        
        .setting-description {
            font-size: 14px;
            color: #6b7280;
            margin-top: 4px;
        }
        
        .toggle {
            width: 48px;
            height: 24px;
            background-color: #d1d5db;
            border-radius: 12px;
            position: relative;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .toggle.active {
            background-color: #2563eb;
        }
        
        .toggle-ball {
            width: 20px;
            height: 20px;
            background-color: white;
            border-radius: 50%;
            position: absolute;
            top: 2px;
            left: 2px;
            transition: transform 0.2s;
        }
        
        .toggle.active .toggle-ball {
            transform: translateX(24px);
        }
        
        /* モーダル */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            align-items: center;
            justify-content: center;
        }
        
        .modal.active {
            display: flex;
        }
        
        .modal-content {
            background-color: white;
            padding: 30px;
            border-radius: 12px;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        }
        
        .modal-header {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        .form-label {
            display: block;
            font-size: 14px;
            font-weight: 500;
            margin-bottom: 8px;
        }
        
        .form-input {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
        }
        
        .form-textarea {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            min-height: 100px;
            resize: vertical;
        }
        
        .form-select {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 14px;
            background-color: white;
        }
        
        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            margin-top: 30px;
        }
        
        /* 通知 */
        .notification {
            position: fixed;
            top: 80px;
            right: 20px;
            background-color: #10b981;
            color: white;
            padding: 16px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
            z-index: 2000;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        /* レスポンシブ */
        @media (max-width: 1200px) {
            #dashboard .main-layout {
                grid-template-columns: 1fr;
            }
            
            .calendar-widget {
                position: relative;
                top: 0;
            }
        }
        
        @media (max-width: 768px) {
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
            }
            
            .dashboard-grid,
            .analytics-grid {
                grid-template-columns: 1fr;
            }
            
            .ai-suggestions-grid {
                grid-template-columns: 1fr;
            }
            
            .calendar-grid {
                grid-template-columns: 1fr;
            }
            
            .nav-item {
                padding: 12px 16px;
                font-size: 14px;
            }
            
            .status-bar {
                display: none;
            }
        }
    </style>
</head>
<body>
    <!-- ヘッダー -->
    <header class="header">
        <div class="header-content">
            <div class="header-top">
                <div class="logo">
                    <span>🤖</span>
                    <span>AIスケジュールアシスタント</span>
                </div>
                <div class="status-bar">
                    <div class="status-item">
                        <span class="status-dot"></span>
                        <span>Google Calendar 同期中</span>
                    </div>
                    <div class="status-item">
                        <span>最終同期: 2分前</span>
                    </div>
                </div>
            </div>
            <nav class="nav">
                <button class="nav-item active" onclick="showPage('dashboard')">ダッシュボード</button>
                <button class="nav-item" onclick="showPage('tasks')">タスク管理</button>
                <button class="nav-item" onclick="showPage('calendar')">カレンダー</button>
                <button class="nav-item" onclick="showPage('ai')">AI提案</button>
                <button class="nav-item" onclick="showPage('analytics')">分析</button>
                <button class="nav-item" onclick="showPage('settings')">設定</button>
            </nav>
        </div>
    </header>
    
    <div class="container">
        <!-- ダッシュボード -->
        <div id="dashboard" class="page active">
            <div class="page-header">
                <h1 class="page-title">今日のダッシュボード</h1>
                <button class="btn btn-primary" onclick="showTaskModal()">新しいタスクを追加</button>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">6</div>
                    <div class="metric-label">本日のタスク</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">3</div>
                    <div class="metric-label">完了済み</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">75%</div>
                    <div class="metric-label">完了率</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">4h</div>
                    <div class="metric-label">残り作業時間</div>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 400px; gap: 20px; margin-bottom: 20px;">
                <div>
                    <div class="card" style="margin-bottom: 20px;">
                        <h3 style="margin-bottom: 20px;">今日の重要タスク</h3>
                        <div class="task-list">
                            <div class="task-item">
                                <div class="task-left">
                                    <div class="checkbox" onclick="toggleTask(this)"></div>
                                    <div class="task-info">
                                        <div class="task-title">プロジェクトAの設計書レビュー</div>
                                        <div class="task-meta">推定: 45分 | 14:00開始予定</div>
                                    </div>
                                </div>
                                <span class="priority-badge priority-high">高優先度</span>
                            </div>
                            <div class="task-item">
                                <div class="task-left">
                                    <div class="checkbox" onclick="toggleTask(this)"></div>
                                    <div class="task-info">
                                        <div class="task-title">クライアントBへの進捗報告</div>
                                        <div class="task-meta">推定: 20分 | メール送信</div>
                                    </div>
                                </div>
                                <span class="priority-badge priority-medium">中優先度</span>
                            </div>
                            <div class="task-item">
                                <div class="task-left">
                                    <div class="checkbox" onclick="toggleTask(this)"></div>
                                    <div class="task-info">
                                        <div class="task-title">バグ修正: API接続エラー</div>
                                        <div class="task-meta">推定: 60分 | 開発タスク</div>
                                    </div>
                                </div>
                                <span class="priority-badge priority-high">高優先度</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="card">
                        <h3 style="margin-bottom: 20px;">AI提案</h3>
                        <div class="ai-suggestion-card">
                            <div class="ai-label">
                                <span>🤖</span>
                                <span>次の行動の提案</span>
                            </div>
                            <div class="ai-content">
                                14:00からの会議まで時間があります。以下のタスクをお勧めします：
                                <ul style="margin-top: 10px; margin-left: 20px;">
                                    <li>議題の確認と質問事項の整理（15分）</li>
                                    <li>前回の議事録の確認（10分）</li>
                                    <li>必要な資料の準備（20分）</li>
                                </ul>
                            </div>
                            <div class="ai-actions">
                                <button class="btn btn-success">タスクとして追加</button>
                                <button class="btn btn-secondary">別の提案を見る</button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="card" style="height: fit-content;">
                    <h3 style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <span>2025年8月</span>
                        <div style="display: flex; gap: 10px;">
                            <button style="background: none; border: none; cursor: pointer; padding: 5px;">←</button>
                            <button style="background: none; border: none; cursor: pointer; padding: 5px;">→</button>
                        </div>
                    </h3>
                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; font-size: 12px; margin-bottom: 10px;">
                        <div style="font-weight: bold; color: #ef4444;">日</div>
                        <div style="font-weight: bold;">月</div>
                        <div style="font-weight: bold;">火</div>
                        <div style="font-weight: bold;">水</div>
                        <div style="font-weight: bold;">木</div>
                        <div style="font-weight: bold;">金</div>
                        <div style="font-weight: bold; color: #2563eb;">土</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px;">
                        <div style="padding: 8px; text-align: center; color: #9ca3af;">28</div>
                        <div style="padding: 8px; text-align: center; color: #9ca3af;">29</div>
                        <div style="padding: 8px; text-align: center; color: #9ca3af;">30</div>
                        <div style="padding: 8px; text-align: center; color: #9ca3af;">31</div>
                        <div style="padding: 8px; text-align: center;">1</div>
                        <div style="padding: 8px; text-align: center;">2</div>
                        <div style="padding: 8px; text-align: center; background-color: #dbeafe; border-radius: 6px; font-weight: bold;">3</div>
                        <div style="padding: 8px; text-align: center;">4</div>
                        <div style="padding: 8px; text-align: center;">5</div>
                        <div style="padding: 8px; text-align: center;">6</div>
                        <div style="padding: 8px; text-align: center;">7</div>
                        <div style="padding: 8px; text-align: center;">8</div>
                        <div style="padding: 8px; text-align: center;">9</div>
                        <div style="padding: 8px; text-align: center;">10</div>
                        <div style="padding: 8px; text-align: center;">11</div>
                        <div style="padding: 8px; text-align: center;">12</div>
                        <div style="padding: 8px; text-align: center;">13</div>
                        <div style="padding: 8px; text-align: center;">14</div>
                        <div style="padding: 8px; text-align: center;">15</div>
                        <div style="padding: 8px; text-align: center;">16</div>
                        <div style="padding: 8px; text-align: center;">17</div>
                        <div style="padding: 8px; text-align: center;">18</div>
                        <div style="padding: 8px; text-align: center;">19</div>
                        <div style="padding: 8px; text-align: center;">20</div>
                        <div style="padding: 8px; text-align: center;">21</div>
                        <div style="padding: 8px; text-align: center;">22</div>
                        <div style="padding: 8px; text-align: center;">23</div>
                        <div style="padding: 8px; text-align: center;">24</div>
                        <div style="padding: 8px; text-align: center;">25</div>
                        <div style="padding: 8px; text-align: center;">26</div>
                        <div style="padding: 8px; text-align: center;">27</div>
                        <div style="padding: 8px; text-align: center;">28</div>
                        <div style="padding: 8px; text-align: center;">29</div>
                        <div style="padding: 8px; text-align: center;">30</div>
                        <div style="padding: 8px; text-align: center;">31</div>
                    </div>
                    
                    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                        <h4 style="font-size: 16px; margin-bottom: 15px;">今日のスケジュール</h4>
                        <div style="max-height: 250px; overflow-y: auto;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <div style="width: 4px; height: 40px; background-color: #2563eb; border-radius: 2px;"></div>
                                <div style="flex: 1;">
                                    <div style="font-size: 12px; color: #2563eb; font-weight: 600;">10:00 - 11:00</div>
                                    <div style="font-size: 14px;">デイリースタンドアップ</div>
                                    <div style="font-size: 12px; color: #6b7280;">Zoom会議室A</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <div style="width: 4px; height: 40px; background-color: #10b981; border-radius: 2px;"></div>
                                <div style="flex: 1;">
                                    <div style="font-size: 12px; color: #10b981; font-weight: 600;">11:00 - 14:00</div>
                                    <div style="font-size: 14px;">集中作業時間</div>
                                    <div style="font-size: 12px; color: #6b7280;">3つのタスク予定</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
                                <div style="width: 4px; height: 40px; background-color: #ec4899; border-radius: 2px;"></div>
                                <div style="flex: 1;">
                                    <div style="font-size: 12px; color: #ec4899; font-weight: 600;">14:00 - 15:00</div>
                                    <div style="font-size: 14px;">プロジェクトCキックオフ</div>
                                    <div style="font-size: 12px; color: #6b7280;">会議室3F-B</div>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <div style="width: 4px; height: 40px; background-color: #2563eb; border-radius: 2px;"></div>
                                <div style="flex: 1;">
                                    <div style="font-size: 12px; color: #2563eb; font-weight: 600;">16:00 - 16:30</div>
                                    <div style="font-size: 14px;">1on1 with 田中さん</div>
                                    <div style="font-size: 12px; color: #6b7280;">オンライン</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- タスク管理 -->
        <div id="tasks" class="page">
            <div class="page-header">
                <h1 class="page-title">タスク管理</h1>
                <button class="btn btn-primary" onclick="showTaskModal()">新しいタスクを追加</button>
            </div>
            
            <div class="task-filters">
                <button class="filter-btn active">すべて</button>
                <button class="filter-btn">未完了</button>
                <button class="filter-btn">完了済み</button>
                <button class="filter-btn">高優先度</button>
                <button class="filter-btn">今日の期限</button>
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 20px;">タスク一覧</h3>
                <div class="task-list">
                    <div class="task-item">
                        <div class="task-left">
                            <div class="checkbox" onclick="toggleTask(this)"></div>
                            <div class="task-info">
                                <div class="task-title">プロジェクトAの設計書レビュー</div>
                                <div class="task-meta">推定: 45分 | カテゴリー: レビュー | 期限: 今日</div>
                            </div>
                        </div>
                        <span class="priority-badge priority-high">高優先度</span>
                    </div>
                    <div class="task-item">
                        <div class="task-left">
                            <div class="checkbox" onclick="toggleTask(this)"></div>
                            <div class="task-info">
                                <div class="task-title">クライアントBへの進捗報告メール</div>
                                <div class="task-meta">推定: 20分 | カテゴリー: コミュニケーション | 期限: 今日</div>
                            </div>
                        </div>
                        <span class="priority-badge priority-medium">中優先度</span>
                    </div>
                    <div class="task-item">
                        <div class="task-left">
                            <div class="checkbox checked" onclick="toggleTask(this)"></div>
                            <div class="task-info">
                                <div class="task-title">バグ修正: ログイン画面のエラー</div>
                                <div class="task-meta">完了: 30分前 | 実際: 35分 | カテゴリー: 開発</div>
                            </div>
                        </div>
                        <span class="priority-badge priority-high">高優先度</span>
                    </div>
                    <div class="task-item">
                        <div class="task-left">
                            <div class="checkbox" onclick="toggleTask(this)"></div>
                            <div class="task-info">
                                <div class="task-title">新機能の実装計画書作成</div>
                                <div class="task-meta">推定: 90分 | カテゴリー: 計画 | 期限: 明日</div>
                            </div>
                        </div>
                        <span class="priority-badge priority-medium">中優先度</span>
                    </div>
                    <div class="task-item">
                        <div class="task-left">
                            <div class="checkbox" onclick="toggleTask(this)"></div>
                            <div class="task-info">
                                <div class="task-title">週次レポートの作成</div>
                                <div class="task-meta">推定: 30分 | カテゴリー: レポート | 期限: 金曜日</div>
                            </div>
                        </div>
                        <span class="priority-badge priority-low">低優先度</span>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 20px;">延期されているタスク</h3>
                <div class="task-list">
                    <div class="task-item" style="border-left: 4px solid #ef4444;">
                        <div class="task-left">
                            <div class="checkbox" onclick="toggleTask(this)"></div>
                            <div class="task-info">
                                <div class="task-title">技術ブログの執筆</div>
                                <div class="task-meta">推定: 120分 | 3回延期 | AIがサブタスク分割を提案しています</div>
                            </div>
                        </div>
                        <button class="btn btn-secondary">分割提案を見る</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- カレンダー -->
        <div id="calendar" class="page">
            <div class="page-header">
                <h1 class="page-title">カレンダー</h1>
                <button class="btn btn-primary" onclick="showEventModal()">新しいイベントを追加</button>
            </div>
            
            <div class="calendar-header">
                <div class="calendar-nav">
                    <button class="btn btn-secondary">前の日</button>
                    <h3>2025年8月3日（日）</h3>
                    <button class="btn btn-secondary">次の日</button>
                </div>
                <button class="btn btn-secondary">今日</button>
            </div>
            
            <div class="card">
                <div class="event-list">
                    <div class="event-item">
                        <div class="event-time">10:00 - 11:00</div>
                        <div class="event-title">デイリースタンドアップ</div>
                        <div class="event-location">Zoom会議室A</div>
                        <div style="margin-top: 10px;">
                            <span style="font-size: 12px; color: #10b981;">AIが準備タスクを提案しています</span>
                        </div>
                    </div>
                    <div class="event-item">
                        <div class="event-time">14:00 - 15:00</div>
                        <div class="event-title">プロジェクトCキックオフミーティング</div>
                        <div class="event-location">会議室3F-B</div>
                    </div>
                    <div class="event-item">
                        <div class="event-time">16:00 - 16:30</div>
                        <div class="event-title">1on1 with 田中さん</div>
                        <div class="event-location">オンライン</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 20px;">空き時間分析</h3>
                <div class="ai-content">
                    <p>本日の空き時間：</p>
                    <ul style="margin-top: 10px; margin-left: 20px;">
                        <li>11:00 - 14:00（3時間）- 集中作業に最適</li>
                        <li>15:00 - 16:00（1時間）- 軽いタスクや休憩</li>
                        <li>16:30 - 18:00（1.5時間）- 日次まとめや明日の準備</li>
                    </ul>
                </div>
            </div>
        </div>
        
        <!-- AI提案 -->
        <div id="ai" class="page">
            <div class="page-header">
                <h1 class="page-title">AI提案</h1>
                <button class="btn btn-primary">新しい提案を生成</button>
            </div>
            
            <div class="ai-stats">
                <div class="metric-card">
                    <div class="metric-value">85%</div>
                    <div class="metric-label">提案採用率</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">24</div>
                    <div class="metric-label">今週の提案数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">+15%</div>
                    <div class="metric-label">生産性向上</div>
                </div>
            </div>
            
            <div class="ai-suggestions-grid">
                <div class="ai-suggestion-card">
                    <div class="ai-label">
                        <span>🎯</span>
                        <span>優先タスクの提案</span>
                    </div>
                    <div class="ai-content">
                        現在の空き時間（11:00-14:00）を活用して、以下のタスクを完了することをお勧めします：
                        <ol style="margin-top: 10px; margin-left: 20px;">
                            <li>プロジェクトAの設計書レビュー（45分）</li>
                            <li>クライアントBへの進捗報告（20分）</li>
                            <li>新機能の実装計画書の下書き（60分）</li>
                        </ol>
                        <p style="margin-top: 10px;">理由: これらのタスクは期限が近く、完了することで午後の会議にも良い影響を与えます。</p>
                    </div>
                    <div class="ai-actions">
                        <button class="btn btn-success">提案を採用</button>
                        <button class="btn btn-secondary">フィードバック</button>
                    </div>
                </div>
                
                <div class="ai-suggestion-card">
                    <div class="ai-label">
                        <span>📋</span>
                        <span>会議準備の提案</span>
                    </div>
                    <div class="ai-content">
                        14:00からのプロジェクトCキックオフミーティングの準備として：
                        <ul style="margin-top: 10px; margin-left: 20px;">
                            <li>プロジェクト概要資料の確認（10分）</li>
                            <li>スケジュール案の準備（15分）</li>
                            <li>リスク事項のリストアップ（10分）</li>
                            <li>質問事項の整理（10分）</li>
                        </ul>
                    </div>
                    <div class="ai-actions">
                        <button class="btn btn-success">タスクとして追加</button>
                        <button class="btn btn-secondary">詳細を編集</button>
                    </div>
                </div>
                
                <div class="ai-suggestion-card">
                    <div class="ai-label">
                        <span>⚡</span>
                        <span>タスク分割の提案</span>
                    </div>
                    <div class="ai-content">
                        「技術ブログの執筆」タスクが3回延期されています。以下のように分割することを提案します：
                        <ol style="margin-top: 10px; margin-left: 20px;">
                            <li>トピックの選定とアウトライン作成（30分）</li>
                            <li>導入部分の執筆（30分）</li>
                            <li>本文の執筆（45分）</li>
                            <li>コード例の作成（30分）</li>
                            <li>推敲と公開準備（15分）</li>
                        </ol>
                    </div>
                    <div class="ai-actions">
                        <button class="btn btn-success">分割して追加</button>
                        <button class="btn btn-secondary">却下</button>
                    </div>
                </div>
                
                <div class="ai-suggestion-card" style="background-color: #fef3c7; border-left-color: #f59e0b;">
                    <div class="ai-label" style="color: #f59e0b;">
                        <span>💡</span>
                        <span>生産性改善の提案</span>
                    </div>
                    <div class="ai-content">
                        最近の作業パターンを分析した結果、以下の改善点が見つかりました：
                        <ul style="margin-top: 10px; margin-left: 20px;">
                            <li>午前中（9:00-12:00）の集中力が高いため、重要なタスクをこの時間に配置</li>
                            <li>会議後は15分の休憩を入れることで、次のタスクの効率が20%向上</li>
                            <li>金曜日の午後は週次振り返りの時間を確保することを推奨</li>
                        </ul>
                    </div>
                    <div class="ai-actions">
                        <button class="btn btn-success">設定に反映</button>
                        <button class="btn btn-secondary">詳細を見る</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 分析 -->
        <div id="analytics" class="page">
            <div class="page-header">
                <h1 class="page-title">分析</h1>
                <div>
                    <select class="form-select" style="width: 150px; display: inline-block;">
                        <option>今週</option>
                        <option>先週</option>
                        <option>今月</option>
                        <option>先月</option>
                    </select>
                </div>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">82%</div>
                    <div class="metric-label">平均完了率</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">4.2h</div>
                    <div class="metric-label">平均作業時間/日</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">-12%</div>
                    <div class="metric-label">見積もり誤差</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">3.8</div>
                    <div class="metric-label">延期回数/週</div>
                </div>
            </div>
            
            <div class="analytics-grid">
                <div class="card">
                    <h3 style="margin-bottom: 20px;">タスク完了率の推移</h3>
                    <div class="chart-container">
                        [完了率グラフがここに表示されます]
                    </div>
                </div>
                
                <div class="card">
                    <h3 style="margin-bottom: 20px;">カテゴリー別時間配分</h3>
                    <div class="chart-container">
                        [円グラフがここに表示されます]
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 20px;">生産性インサイト</h3>
                <div class="productivity-insights">
                    <div class="insight-item">
                        <div class="insight-title">🎯 最も生産的な時間帯</div>
                        <div class="insight-description">
                            あなたは9:00-11:00の時間帯で最も多くのタスクを完了しています。この時間帯に重要なタスクを配置することをお勧めします。
                        </div>
                    </div>
                    <div class="insight-item">
                        <div class="insight-title">⏱️ 見積もり精度の改善</div>
                        <div class="insight-description">
                            開発タスクの見積もりが平均20%少なく見積もられています。バッファを追加することを検討してください。
                        </div>
                    </div>
                    <div class="insight-item">
                        <div class="insight-title">📈 改善トレンド</div>
                        <div class="insight-description">
                            先週と比較して、タスク完了率が15%向上しています。特に午後の生産性が改善されています。
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 設定 -->
        <div id="settings" class="page">
            <div class="page-header">
                <h1 class="page-title">設定</h1>
            </div>
            
            <div class="card">
                <div class="settings-section">
                    <h2 class="settings-title">連携設定</h2>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <div>
                                <div class="setting-label">Google Calendar連携</div>
                                <div class="setting-description">カレンダーイベントの双方向同期</div>
                            </div>
                            <div class="toggle active" onclick="toggleSetting(this)">
                                <div class="toggle-ball"></div>
                            </div>
                        </div>
                        <div class="setting-item">
                            <div>
                                <div class="setting-label">Discord通知</div>
                                <div class="setting-description">重要なタスクやイベントの通知</div>
                            </div>
                            <button class="btn btn-secondary">設定</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="settings-section">
                    <h2 class="settings-title">通知設定</h2>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <div>
                                <div class="setting-label">ブラウザ通知</div>
                                <div class="setting-description">タスクリマインダーとイベント通知</div>
                            </div>
                            <div class="toggle active" onclick="toggleSetting(this)">
                                <div class="toggle-ball"></div>
                            </div>
                        </div>
                        <div class="setting-item">
                            <div>
                                <div class="setting-label">通知タイミング</div>
                                <div class="setting-description">イベント開始前の通知時間</div>
                            </div>
                            <select class="form-select" style="width: 120px;">
                                <option>5分前</option>
                                <option selected>15分前</option>
                                <option>30分前</option>
                                <option>1時間前</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <div>
                                <div class="setting-label">集中モード</div>
                                <div class="setting-description">この時間帯は通知を無効化</div>
                            </div>
                            <button class="btn btn-secondary">時間設定</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <div class="settings-section">
                    <h2 class="settings-title">AI設定</h2>
                    <div class="settings-grid">
                        <div class="setting-item">
                            <div>
                                <div class="setting-label">自動タスク提案</div>
                                <div class="setting-description">AIによる自動的なタスク提案</div>
                            </div>
                            <div class="toggle active" onclick="toggleSetting(this)">
                                <div class="toggle-ball"></div>
                            </div>
                        </div>
                        <div class="setting-item">
                            <div>
                                <div class="setting-label">提案頻度</div>
                                <div class="setting-description">AI提案の生成頻度</div>
                            </div>
                            <select class="form-select" style="width: 150px;">
                                <option>高（1日3回）</option>
                                <option selected>中（1日2回）</option>
                                <option>低（1日1回）</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <div>
                                <div class="setting-label">学習データ</div>
                                <div class="setting-description">AIの学習に使用するデータ</div>
                            </div>
                            <button class="btn btn-secondary">詳細設定</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- タスク追加モーダル -->
    <div id="taskModal" class="modal">
        <div class="modal-content">
            <h3 class="modal-header">新しいタスクを追加</h3>
            <form onsubmit="handleTaskSubmit(event)">
                <div class="form-group">
                    <label class="form-label">タスク名</label>
                    <input type="text" class="form-input" placeholder="例: 設計書の作成" required>
                </div>
                <div class="form-group">
                    <label class="form-label">説明（任意）</label>
                    <textarea class="form-textarea" placeholder="タスクの詳細を入力してください"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">推定時間（分）</label>
                    <input type="number" class="form-input" placeholder="30" min="5" step="5" required>
                </div>
                <div class="form-group">
                    <label class="form-label">優先度</label>
                    <select class="form-select">
                        <option value="high">高</option>
                        <option value="medium" selected>中</option>
                        <option value="low">低</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">カテゴリー</label>
                    <select class="form-select">
                        <option value="development">開発</option>
                        <option value="review">レビュー</option>
                        <option value="communication">コミュニケーション</option>
                        <option value="planning">計画</option>
                        <option value="other">その他</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">期限</label>
                    <input type="date" class="form-input">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeTaskModal()">キャンセル</button>
                    <button type="submit" class="btn btn-primary">タスクを追加</button>
                </div>
            </form>
        </div>
    </div>
    
    <!-- イベント追加モーダル -->
    <div id="eventModal" class="modal">
        <div class="modal-content">
            <h3 class="modal-header">新しいイベントを追加</h3>
            <form onsubmit="handleEventSubmit(event)">
                <div class="form-group">
                    <label class="form-label">イベント名</label>
                    <input type="text" class="form-input" placeholder="例: クライアントミーティング" required>
                </div>
                <div class="form-group">
                    <label class="form-label">開始時刻</label>
                    <input type="datetime-local" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">終了時刻</label>
                    <input type="datetime-local" class="form-input" required>
                </div>
                <div class="form-group">
                    <label class="form-label">場所</label>
                    <input type="text" class="form-input" placeholder="例: 会議室A / Zoom">
                </div>
                <div class="form-group">
                    <label class="form-label">説明（任意）</label>
                    <textarea class="form-textarea" placeholder="イベントの詳細を入力してください"></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="closeEventModal()">キャンセル</button>
                    <button type="submit" class="btn btn-primary">イベントを追加</button>
                </div>
            </form>
        </div>
    </div>
    
    <script>
        // ページ切り替え
        function showPage(pageId) {
            // すべてのページを非表示
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            
            // すべてのナビゲーションアイテムの選択状態を解除
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // 選択されたページを表示
            document.getElementById(pageId).classList.add('active');
            
            // 対応するナビゲーションアイテムを選択状態に
            event.target.classList.add('active');
        }
        
        // タスクのチェック状態を切り替える
        function toggleTask(checkbox) {
            checkbox.classList.toggle('checked');
            updateMetrics();
            
            if (checkbox.classList.contains('checked')) {
                showNotification('タスクを完了しました！素晴らしい進捗です。');
            }
        }
        
        // メトリクスの更新
        function updateMetrics() {
            const allTasks = document.querySelectorAll('.checkbox');
            const completedTasks = document.querySelectorAll('.checkbox.checked');
            const completionRate = Math.round((completedTasks.length / allTasks.length) * 100);
            
            // ダッシュボードのメトリクスを更新
            const metricsElements = document.querySelectorAll('.metric-value');
            if (metricsElements[2]) {
                metricsElements[2].textContent = completionRate + '%';
            }
        }
        
        // 設定のトグル
        function toggleSetting(toggle) {
            toggle.classList.toggle('active');
        }
        
        // モーダル表示
        function showTaskModal() {
            document.getElementById('taskModal').classList.add('active');
        }
        
        function closeTaskModal() {
            document.getElementById('taskModal').classList.remove('active');
        }
        
        function showEventModal() {
            document.getElementById('eventModal').classList.add('active');
        }
        
        function closeEventModal() {
            document.getElementById('eventModal').classList.remove('active');
        }
        
        // フォーム送信処理
        function handleTaskSubmit(event) {
            event.preventDefault();
            closeTaskModal();
            showNotification('新しいタスクを追加しました');
        }
        
        function handleEventSubmit(event) {
            event.preventDefault();
            closeEventModal();
            showNotification('新しいイベントを追加しました');
        }
        
        // 通知表示
        function showNotification(message) {
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
        
        // モーダル外クリックで閉じる
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.classList.remove('active');
                }
            });
        });
        
        // フィルターボタンの動作
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
        
        // キーボードショートカット
        document.addEventListener('keydown', function(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                showTaskModal();
            }
        });
        
        // 定期的な同期（模擬）
        setInterval(() => {
            console.log('Google Calendarと同期中...');
        }, 300000); // 5分ごと
        
        // ページ読み込み時の初期化
        document.addEventListener('DOMContentLoaded', function() {
            console.log('AIスケジュールアシスタント起動');
            updateMetrics();
        });
    </script>
</body>
</html>
