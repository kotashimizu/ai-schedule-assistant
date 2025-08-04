'use client';

import React, { useState } from 'react';
import { AITaskSuggestion, TaskPriority } from '@/types/shared';

interface TaskSuggestionCardProps {
  suggestion: AITaskSuggestion & {
    recommended_time_slots?: {
      startTime: string;
      endTime: string;
      durationMinutes: number;
    }[];
    fit_score?: number;
  };
  onAdopt?: (suggestion: AITaskSuggestion) => void;
  onFeedback?: (suggestionId: string, feedback: {
    type: 'positive' | 'negative' | 'neutral';
    rating?: number;
    reason?: string;
  }) => void;
}

/**
 * AIタスク提案カードコンポーネント
 * AIによるタスク提案を表示し、ユーザーが採用・フィードバックできる
 */
export function TaskSuggestionCard({
  suggestion,
  onAdopt,
  onFeedback,
}: TaskSuggestionCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: TaskPriority) => {
    switch (priority) {
      case 'high':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'medium':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'low':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const handleAdopt = () => {
    onAdopt?.(suggestion);
  };

  const handleFeedback = (type: 'positive' | 'negative' | 'neutral', rating?: number, reason?: string) => {
    onFeedback?.('suggestion-' + Date.now(), { type, rating, reason });
    setFeedbackSubmitted(true);
    setShowFeedback(false);
  };

  return (
    <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 mb-4 shadow-sm">
      {/* AI提案バッジ */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-green-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">AI提案</span>
          </div>
          
          {suggestion.fit_score !== undefined && (
            <div className="flex items-center space-x-1 text-xs text-gray-600">
              <span>適合度:</span>
              <div className="flex items-center">
                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-yellow-400 to-green-500 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, suggestion.fit_score))}%` }}
                  />
                </div>
                <span className="ml-1">{suggestion.fit_score}%</span>
              </div>
            </div>
          )}
        </div>
        
        {/* 優先度バッジ */}
        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(suggestion.priority)}`}>
          {getPriorityIcon(suggestion.priority)}
          <span>{suggestion.priority}</span>
        </div>
      </div>

      {/* タスク内容 */}
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900 mb-2">{suggestion.title}</h3>
        <p className="text-sm text-gray-700 mb-2">{suggestion.description}</p>
        
        {/* 所要時間と理由 */}
        <div className="flex items-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>予想時間: {suggestion.estimated_time}分</span>
          </div>
          
          {suggestion.reasoning && (
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="italic">{suggestion.reasoning}</span>
            </div>
          )}
        </div>
      </div>

      {/* 推奨時間スロット */}
      {suggestion.recommended_time_slots && suggestion.recommended_time_slots.length > 0 && (
        <div className="mb-3 p-3 bg-white rounded-md border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">推奨時間帯:</h4>
          <div className="space-y-1">
            {suggestion.recommended_time_slots.slice(0, 2).map((slot, index) => (
              <div key={index} className="flex items-center justify-between text-xs text-gray-600">
                <span>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</span>
                <span className="text-green-600">({slot.durationMinutes}分空き)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* アクションボタン */}
      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <button
            onClick={handleAdopt}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
          >
            タスクに追加
          </button>
          
          <button
            onClick={() => setShowFeedback(!showFeedback)}
            disabled={feedbackSubmitted}
            className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
              feedbackSubmitted
                ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }`}
          >
            {feedbackSubmitted ? 'フィードバック済み' : 'フィードバック'}
          </button>
        </div>
        
        {/* 簡単フィードバックボタン */}
        {!feedbackSubmitted && (
          <div className="flex space-x-1">
            <button
              onClick={() => handleFeedback('positive', 5)}
              className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
              title="この提案は役に立つ"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
            </button>
            
            <button
              onClick={() => handleFeedback('negative', 2)}
              className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
              title="この提案は役に立たない"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.106-1.79l-.05-.025A4 4 0 0011.157 2H5.74a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* 詳細フィードバックフォーム */}
      {showFeedback && !feedbackSubmitted && (
        <div className="mt-4 p-3 bg-white rounded-md border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3">詳細フィードバック</h4>
          
          <div className="space-y-3">
            {/* 評価 */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">評価 (1-5)</label>
              <div className="flex space-x-1">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => handleFeedback('neutral', rating)}
                    className="p-1 text-yellow-400 hover:text-yellow-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
            
            {/* コメント */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">コメント (任意)</label>
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="この提案についてのコメントをお書きください..."
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowFeedback(false)}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleFeedback('neutral', 3, '詳細フィードバック')}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                送信
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
