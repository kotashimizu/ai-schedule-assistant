'use client';

import { useState } from 'react';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  estimated_minutes?: number;
  due_date?: string;
  category?: string;
  created_at: string;
  updated_at: string;
  postponed_count?: number;
}

interface TaskListProps {
  tasks: Task[];
  onTaskToggle: (taskId: string, completed: boolean) => void;
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onSuggestSplit: (task: Task) => void;
  className?: string;
}

export function TaskList({ 
  tasks, 
  onTaskToggle, 
  onTaskEdit, 
  onTaskDelete,
  onSuggestSplit,
  className = '' 
}: TaskListProps) {
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());

  const handleTaskToggle = async (task: Task) => {
    const newCompleted = task.status !== 'completed';
    setLoadingTasks(prev => new Set(prev).add(task.id));
    
    try {
      await onTaskToggle(task.id, newCompleted);
    } finally {
      setLoadingTasks(prev => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return '不明';
    }
  };

  const formatDueDate = (dueDateString?: string) => {
    if (!dueDateString) return null;
    
    try {
      const dueDate = new Date(dueDateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return { text: '今日', className: 'text-red-600 font-medium' };
      if (diffDays === 1) return { text: '明日', className: 'text-orange-600' };
      if (diffDays < 0) return { text: `${Math.abs(diffDays)}日前`, className: 'text-red-600 font-medium' };
      if (diffDays <= 7) return { text: `${diffDays}日後`, className: 'text-yellow-600' };
      
      return { text: dueDate.toLocaleDateString('ja-JP'), className: 'text-gray-600' };
    } catch {
      return null;
    }
  };

  const isPostponedTask = (task: Task) => {
    return (task.postponed_count ?? 0) >= 3;
  };

  if (tasks.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p className="text-gray-500 text-lg">タスクがありません</p>
        <p className="text-gray-400 text-sm mt-1">新しいタスクを作成してみましょう</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {tasks.map((task) => {
        const isCompleted = task.status === 'completed';
        const isLoading = loadingTasks.has(task.id);
        const dueInfo = formatDueDate(task.due_date);
        const isPostponed = isPostponedTask(task);

        return (
          <div
            key={task.id}
            className={`bg-white rounded-lg border p-4 transition-all hover:shadow-md ${
              isPostponed ? 'border-l-4 border-l-red-500' : 'border-gray-200'
            } ${isCompleted ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start space-x-3">
              {/* チェックボックス */}
              <button
                onClick={() => handleTaskToggle(task)}
                disabled={isLoading}
                className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  isCompleted
                    ? 'bg-green-600 border-green-600'
                    : 'border-gray-300 hover:border-green-500'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                ) : isCompleted ? (
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : null}
              </button>

              {/* タスク内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className={`font-medium text-gray-900 ${isCompleted ? 'line-through' : ''}`}>
                    {task.title}
                  </h3>
                  
                  {/* 優先度バッジ */}
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(task.priority)}`}>
                    {getPriorityLabel(task.priority)}
                  </span>
                </div>

                {task.description && (
                  <p className={`mt-1 text-sm text-gray-600 ${isCompleted ? 'line-through' : ''}`}>
                    {task.description}
                  </p>
                )}

                {/* メタ情報 */}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                  {task.estimated_minutes && (
                    <span className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {task.estimated_minutes}分
                    </span>
                  )}
                  
                  {dueInfo && (
                    <span className={`flex items-center ${dueInfo.className}`}>
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {dueInfo.text}
                    </span>
                  )}
                  
                  {task.category && (
                    <span className="flex items-center">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {task.category}
                    </span>
                  )}

                  {isPostponed && (
                    <span className="flex items-center text-red-600 font-medium">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      {task.postponed_count}回延期
                    </span>
                  )}
                </div>

                {/* 延期タスクの分割提案ボタン */}
                {isPostponed && !isCompleted && (
                  <div className="mt-3">
                    <button
                      onClick={() => onSuggestSplit(task)}
                      className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 text-xs font-medium rounded-md border border-red-200 hover:bg-red-100 transition-colors"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      サブタスクに分割提案
                    </button>
                  </div>
                )}
              </div>

              {/* アクションボタン */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onTaskEdit(task)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="編集"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                
                <button
                  onClick={() => onTaskDelete(task.id)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  title="削除"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}