'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth/context';
import { TaskFilters } from './TaskFilters';
import { TaskList } from './TaskList';
import { TaskForm } from './TaskForm';
import { TaskStatistics } from './TaskStatistics';

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

interface TaskManagerProps {
  className?: string;
}

export function TaskManager({ className = '' }: TaskManagerProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pending' | 'completed' | 'high' | 'today'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // モーダル状態
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // タスク取得
  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const response = await fetch('/api/tasks');
      
      if (!response.ok) {
        throw new Error('タスクの取得に失敗しました');
      }

      const data = await response.json();
      setTasks(data.tasks || []);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setError(error instanceof Error ? error.message : 'タスクの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // 初回読み込み
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // フィルタリング
  useEffect(() => {
    let filtered = [...tasks];

    switch (activeFilter) {
      case 'pending':
        filtered = tasks.filter(task => task.status === 'pending' || task.status === 'in_progress');
        break;
      case 'completed':
        filtered = tasks.filter(task => task.status === 'completed');
        break;
      case 'high':
        filtered = tasks.filter(task => task.priority === 'high' && task.status !== 'completed');
        break;
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filtered = tasks.filter(task => {
          if (!task.due_date || task.status === 'completed') return false;
          const dueDate = new Date(task.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        });
        break;
      default:
        filtered = tasks;
    }

    // 完了タスクは下に、未完了タスクは優先度と期限でソート
    filtered.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      
      if (a.status !== 'completed' && b.status !== 'completed') {
        // 優先度でソート
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // 期限でソート
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
      }

      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    setFilteredTasks(filtered);
  }, [tasks, activeFilter]);

  // タスク数をカウント
  const taskCounts = {
    all: tasks.length,
    pending: tasks.filter(task => task.status === 'pending' || task.status === 'in_progress').length,
    completed: tasks.filter(task => task.status === 'completed').length,
    high: tasks.filter(task => task.priority === 'high' && task.status !== 'completed').length,
    today: tasks.filter(task => {
      if (!task.due_date || task.status === 'completed') return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate.getTime() === today.getTime();
    }).length,
  };

  // タスク保存
  const handleSaveTask = async (taskData: Partial<Task>) => {
    try {
      const url = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks';
      const method = editingTask ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error('タスクの保存に失敗しました');
      }

      await fetchTasks(); // タスクリストを再取得
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to save task:', error);
      throw error;
    }
  };

  // タスク完了切り替え
  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: completed ? 'completed' : 'pending'
        }),
      });

      if (!response.ok) {
        throw new Error('タスクの更新に失敗しました');
      }

      await fetchTasks(); // タスクリストを再取得
    } catch (error) {
      console.error('Failed to toggle task:', error);
      throw error;
    }
  };

  // タスク削除
  const handleTaskDelete = async (taskId: string) => {
    if (!confirm('このタスクを削除しますか？')) return;

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('タスクの削除に失敗しました');
      }

      await fetchTasks(); // タスクリストを再取得
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('タスクの削除に失敗しました');
    }
  };

  // タスク編集
  const handleTaskEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  // 新規タスク作成
  const handleNewTask = () => {
    setEditingTask(null);
    setIsFormOpen(true);
  };

  // サブタスク分割提案
  const handleSuggestSplit = async (task: Task) => {
    try {
      const response = await fetch('/api/ai/task-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: task.id,
          task_title: task.title,
          task_description: task.description,
        }),
      });

      if (response.ok) {
        const { suggestions } = await response.json();
        alert(`AI提案:\n\n${suggestions.map((s: any, i: number) => `${i + 1}. ${s.title} (${s.estimated_minutes}分)`).join('\n')}`);
      }
    } catch (error) {
      console.error('Failed to get split suggestions:', error);
    }
  };

  // フォームを閉じる
  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTask(null);
  };

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-red-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-red-600 font-medium">{error}</p>
          <button
            onClick={fetchTasks}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ヘッダーとアクションボタン */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">タスク管理</h2>
        <button
          onClick={handleNewTask}
          className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新しいタスク
        </button>
      </div>

      {/* 統計情報 */}
      <TaskStatistics tasks={tasks} />

      {/* フィルター */}
      <TaskFilters
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        taskCounts={taskCounts}
      />

      {/* タスクリスト */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="w-5 h-5 bg-gray-200 rounded"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6">
          <TaskList
            tasks={filteredTasks}
            onTaskToggle={handleTaskToggle}
            onTaskEdit={handleTaskEdit}
            onTaskDelete={handleTaskDelete}
            onSuggestSplit={handleSuggestSplit}
          />
        </div>
      )}

      {/* タスクフォームモーダル */}
      <TaskForm
        task={editingTask}
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveTask}
      />
    </div>
  );
}