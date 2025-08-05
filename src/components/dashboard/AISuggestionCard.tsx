'use client';

import { useState, useEffect } from 'react';

interface AISuggestion {
  id: string;
  type: 'task' | 'optimization' | 'reminder';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
  metadata?: {
    estimatedTime?: number;
    dueTime?: string;
    category?: string;
  };
}

interface AISuggestionCardProps {
  className?: string;
}

export function AISuggestionCard({ className = '' }: AISuggestionCardProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchAISuggestions();
  }, []);

  const fetchAISuggestions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ai/task-suggestions');
      
      if (response.ok) {
        const { suggestions: aiSuggestions } = await response.json();
        
        // AI提案を標準形式に変換
        const formattedSuggestions: AISuggestion[] = aiSuggestions.map((suggestion: any) => ({
          id: suggestion.id || Math.random().toString(36),
          type: suggestion.type || 'task',
          title: suggestion.title,
          description: suggestion.description || suggestion.reasoning || '',
          priority: suggestion.priority || 'medium',
          actionable: true,
          metadata: {
            estimatedTime: suggestion.estimated_minutes,
            dueTime: suggestion.suggested_time,
            category: suggestion.category
          }
        }));

        setSuggestions(formattedSuggestions);
      }
    } catch (error) {
      console.error('Failed to fetch AI suggestions:', error);
      // フォールバック：ダミーデータを表示
      setSuggestions([
        {
          id: 'dummy-1',
          type: 'optimization',
          title: '30分の空き時間を活用',
          description: '14:00-14:30の空き時間に「書類整理」タスクを実行することをお勧めします。',
          priority: 'medium',
          actionable: true,
          metadata: { estimatedTime: 30 }
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'task':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
      case 'optimization':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'reminder':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        );
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const handleAcceptSuggestion = async (suggestion: AISuggestion) => {
    try {
      // AI提案を受け入れる処理
      const response = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_id: suggestion.id,
          action: 'accepted',
          feedback: 'user_accepted'
        })
      });

      if (response.ok) {
        // 提案を削除
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        
        // タスクタイプの場合は実際にタスクを作成
        if (suggestion.type === 'task') {
          await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: suggestion.title,
              description: suggestion.description,
              priority: suggestion.priority,
              estimated_minutes: suggestion.metadata?.estimatedTime,
              category: suggestion.metadata?.category || 'AI提案',
              status: 'pending'
            })
          });
        }
      }
    } catch (error) {
      console.error('Failed to accept suggestion:', error);
    }
  };

  const handleDismissSuggestion = async (suggestion: AISuggestion) => {
    try {
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestion_id: suggestion.id,
          action: 'dismissed',
          feedback: 'user_dismissed'
        })
      });

      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error);
    }
  };

  const displayedSuggestions = showAll ? suggestions : suggestions.slice(0, 2);

  if (isLoading) {
    return (
      <div className={`bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow p-6 border border-green-200 ${className}`}>
        <div className="flex items-center mb-4">
          <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse mr-3"></div>
          <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gradient-to-br from-green-50 to-blue-50 rounded-lg shadow p-6 border border-green-200 ${className}`}>
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <div className="bg-green-100 rounded-full p-2 mr-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">AI提案</h3>
        </div>
        <button
          onClick={fetchAISuggestions}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          更新
        </button>
      </div>

      {/* 提案一覧 */}
      {suggestions.length === 0 ? (
        <div className="text-center py-6">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-gray-500 text-sm">現在、新しい提案はありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center">
                  <div className="text-green-600 mr-2">
                    {getSuggestionIcon(suggestion.type)}
                  </div>
                  <h4 className="font-medium text-gray-900">{suggestion.title}</h4>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(suggestion.priority)}`}>
                  {suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低'}
                </span>
              </div>
              
              <p className="text-sm text-gray-600 mb-3">{suggestion.description}</p>
              
              {/* メタデータ */}
              {suggestion.metadata && (
                <div className="flex items-center space-x-4 mb-3 text-xs text-gray-500">
                  {suggestion.metadata.estimatedTime && (
                    <span className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {suggestion.metadata.estimatedTime}分
                    </span>
                  )}
                  {suggestion.metadata.category && (
                    <span className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {suggestion.metadata.category}
                    </span>
                  )}
                </div>
              )}
              
              {/* アクションボタン */}
              <div className="flex space-x-2">
                <button
                  onClick={() => handleAcceptSuggestion(suggestion)}
                  className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition-colors"
                >
                  採用
                </button>
                <button
                  onClick={() => handleDismissSuggestion(suggestion)}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-md transition-colors"
                >
                  却下
                </button>
              </div>
            </div>
          ))}
          
          {/* もっと見るボタン */}
          {suggestions.length > 2 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="w-full py-2 text-sm text-green-600 hover:text-green-700 font-medium"
            >
              {showAll ? '折りたたむ' : `他${suggestions.length - 2}件を表示`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}