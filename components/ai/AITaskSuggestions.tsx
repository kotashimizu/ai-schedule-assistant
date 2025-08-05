'use client';

import React, { useState, useEffect } from 'react';
import { AITaskSuggestion } from '@/types/shared';
import { TaskSuggestionCard } from './TaskSuggestionCard';

interface AITaskSuggestionsProps {
  events?: {
    id: string;
    title: string;
    description?: string;
    startTime: string;
    location?: string;
  }[];
  onTaskAdopt?: (task: AITaskSuggestion) => void;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

interface SuggestionState {
  isLoading: boolean;
  suggestions: (AITaskSuggestion & {
    recommended_time_slots?: TimeSlot[];
    fit_score?: number;
  })[];
  error: string | null;
  lastGenerated: Date | null;
}

/**
 * AIタスク提案統合コンポーネント
 * 準備タスクとインテリジェント提案を統合管理
 */
export function AITaskSuggestions({ events = [], onTaskAdopt }: AITaskSuggestionsProps) {
  const [state, setState] = useState<SuggestionState>({
    isLoading: false,
    suggestions: [],
    error: null,
    lastGenerated: null,
  });
  
  const [activeTab, setActiveTab] = useState<'preparation' | 'intelligent'>('preparation');
  const [autoGenerate, setAutoGenerate] = useState(true);

  // イベント変更時に自動で準備タスクを生成
  useEffect(() => {
    if (autoGenerate && events.length > 0 && activeTab === 'preparation') {
      const upcomingEvents = events.filter(event => {
        const eventTime = new Date(event.startTime);
        const now = new Date();
        const hoursUntil = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursUntil > 0 && hoursUntil < 48; // 48時間以内のイベント
      });

      if (upcomingEvents.length > 0) {
        generatePreparationTasks(upcomingEvents[0]); // 最も近いイベントのみ
      }
    }
  }, [events, autoGenerate, activeTab]);

  // 準備タスク生成
  const generatePreparationTasks = async (event: {
    id: string;
    title: string;
    description?: string;
    startTime: string;
    location?: string;
  }) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/ai/preparation-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: event.id,
          eventTitle: event.title,
          eventDescription: event.description,
          eventStartTime: event.startTime,
          eventLocation: event.location,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '準備タスク生成に失敗しました');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        suggestions: data.suggestions || [],
        lastGenerated: new Date(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'エラーが発生しました',
      }));
    }
  };

  // インテリジェントタスク提案生成
  const generateIntelligentSuggestions = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // まず空き時間を分析
      const freeTimeResponse = await fetch('/api/ai/task-suggestions/analyze-free-time?date=' + new Date().toISOString().split('T')[0]);
      
      if (!freeTimeResponse.ok) {
        throw new Error('空き時間の分析に失敗しました');
      }

      const freeTimeData = await freeTimeResponse.json();
      
      if (!freeTimeData.free_time_slots || freeTimeData.free_time_slots.length === 0) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          suggestions: [],
          error: '今日は空き時間がありません',
        }));
        return;
      }

      // タスク提案を生成
      const suggestionResponse = await fetch('/api/ai/task-suggestions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: new Date().toISOString().split('T')[0],
          freeTimeSlots: freeTimeData.free_time_slots,
          includeExistingTasks: true,
        }),
      });

      if (!suggestionResponse.ok) {
        const errorData = await suggestionResponse.json();
        throw new Error(errorData.error || 'タスク提案生成に失敗しました');
      }

      const suggestionData = await suggestionResponse.json();
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        suggestions: suggestionData.suggestions || [],
        lastGenerated: new Date(),
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'エラーが発生しました',
      }));
    }
  };

  // タスク採用ハンドラー
  const handleTaskAdopt = (suggestion: AITaskSuggestion) => {
    onTaskAdopt?.(suggestion);
    
    // 採用フィードバックを送信
    handleFeedback('adopted-' + Date.now(), {
      type: 'positive',
      rating: 5,
      reason: 'タスクとして採用しました',
    });
  };

  // フィードバックハンドラー
  const handleFeedback = async (suggestionId: string, feedback: {
    type: 'positive' | 'negative' | 'neutral';
    rating?: number;
    reason?: string;
  }) => {
    try {
      await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestionId,
          feedback: feedback.type,
          rating: feedback.rating,
          adopted: feedback.type === 'positive' && feedback.reason?.includes('採用'),
          reason: feedback.reason,
        }),
      });
    } catch (error) {
      console.error('フィードバック送信エラー:', error);
    }
  };

  const handleManualGeneration = () => {
    if (activeTab === 'preparation') {
      const upcomingEvent = events.find(event => {
        const eventTime = new Date(event.startTime);
        return eventTime > new Date();
      });
      
      if (upcomingEvent) {
        generatePreparationTasks(upcomingEvent);
      }
    } else {
      generateIntelligentSuggestions();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">AIタスク提案</h2>
          </div>
          
          {state.lastGenerated && (
            <span className="text-xs text-gray-500">
              最後の更新: {state.lastGenerated.toLocaleTimeString('ja-JP')}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 自動生成トグル */}
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700">自動生成</span>
          </label>
          
          <button
            onClick={handleManualGeneration}
            disabled={state.isLoading}
            className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state.isLoading ? '生成中...' : '提案生成'}
          </button>
        </div>
      </div>

      {/* タブ */}
      <div className="flex space-x-1 mb-4 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => setActiveTab('preparation')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'preparation'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          準備タスク
        </button>
        <button
          onClick={() => setActiveTab('intelligent')}
          className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'intelligent'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          インテリジェント提案
        </button>
      </div>

      {/* コンテンツ */}
      <div className="space-y-4">
        {/* エラー表示 */}
        {state.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-700">{state.error}</span>
            </div>
          </div>
        )}

        {/* ローディング */}
        {state.isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-gray-600">
              {activeTab === 'preparation' ? '準備タスクを生成中...' : 'タスク提案を分析中...'}
            </span>
          </div>
        )}

        {/* 提案一覧 */}
        {!state.isLoading && state.suggestions.length === 0 && !state.error && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-gray-600">
              {activeTab === 'preparation' 
                ? '準備が必要なイベントがありません' 
                : '現在提案できるタスクがありません'
              }
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {activeTab === 'preparation' 
                ? 'イベントが追加されると自動で準備タスクを提案します' 
                : '「提案生成」ボタンで空き時間に最適なタスクを提案します'
              }
            </p>
          </div>
        )}

        {/* 提案カード一覧 */}
        {state.suggestions.map((suggestion, index) => (
          <TaskSuggestionCard
            key={index}
            suggestion={suggestion}
            onAdopt={handleTaskAdopt}
            onFeedback={handleFeedback}
          />
        ))}
      </div>
    </div>
  );
}
