'use client';

import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus } from '@/types/shared';
import { useTask } from '@/lib/hooks/useTask';
import { TaskList } from './TaskList';
import { TaskForm } from './TaskForm';
import { TaskFilters } from './TaskFilters';
import { TaskStatistics } from './TaskStatistics';

interface TaskManagerProps {
  initialView?: 'all' | 'today' | 'overdue' | 'completed';
  allowCreate?: boolean;
  compactMode?: boolean;
}

/**
 * タスク管理メインコンポーネント
 * タスクの表示、作成、編集、削除、フィルタリング機能を統合
 */
export function TaskManager({ 
  initialView = 'all',
  allowCreate = true,
  compactMode = false 
}: TaskManagerProps) {
  const {
    tasks,
    statistics,
    pagination,
    isLoading,
    error,
    currentFilters,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    bulkOperation,
    completeTask,
    rescheduleTask,
    getTodayTasks,
    getOverdueTasks,
    clearError,
    refresh,
  } = useTask();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState(initialView);

  // ビュー切り替え
  const handleViewChange = async (view: string) => {
    setCurrentView(view);
    setSelectedTasks([]);

    switch (view) {
      case 'today':
        await getTodayTasks();
        break;
      case 'overdue':
        await getOverdueTasks();
        break;
      case 'completed':
        await fetchTasks({ status: ['completed'] });
        break;
      case 'pending':
        await fetchTasks({ status: ['pending'] });
        break;
      case 'in_progress':
        await fetchTasks({ status: ['in_progress'] });
        break;
      case 'high_priority':
        await fetchTasks({ priority: ['high'] });
        break;
      default:
        await fetchTasks();
        break;
    }
  };

  // タスク作成
  const handleCreateTask = async (taskData: any) => {
    const newTask = await createTask(taskData);
    if (newTask) {
      setShowCreateForm(false);
      return true;
    }
    return false;
  };

  // タスク更新
  const handleUpdateTask = async (taskId: string, updateData: any) => {
    const updated = await updateTask(taskId, updateData);
    if (updated) {
      setEditingTask(null);
      return true;
    }
    return false;
  };

  // タスク完了
  const handleCompleteTask = async (taskId: string, actualMinutes?: number) => {
    await completeTask(taskId, actualMinutes);
  };

  // タスク削除
  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('このタスクを削除しますか？')) {
      await deleteTask(taskId);
    }
  };

  // 選択されたタスクの一括操作
  const handleBulkAction = async (action: string) => {
    if (selectedTasks.length === 0) {
      alert('タスクを選択してください');
      return;
    }

    let confirmed = true;
    let operation;

    switch (action) {
      case 'complete':
        operation = {
          action: 'update_status' as const,
          taskIds: selectedTasks,
          data: { status: 'completed' as TaskStatus }
        };
        break;
      case 'delete':
        confirmed = window.confirm(`${selectedTasks.length}個のタスクを削除しますか？`);
        if (confirmed) {
          operation = {
            action: 'delete' as const,
            taskIds: selectedTasks
          };
        }
        break;
      case 'reschedule_today':
        operation = {
          action: 'reschedule' as const,
          taskIds: selectedTasks,
          data: { scheduledDate: new Date().toISOString().split('T')[0] }
        };
        break;
      case 'reschedule_tomorrow':
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        operation = {
          action: 'reschedule' as const,
          taskIds: selectedTasks,
          data: { scheduledDate: tomorrow.toISOString().split('T')[0] }
        };
        break;
    }

    if (confirmed && operation) {
      const success = await bulkOperation(operation);
      if (success) {
        setSelectedTasks([]);
      }
    }
  };

  // タスク選択の切り替え
  const handleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  // すべて選択/解除
  const handleSelectAll = () => {
    if (selectedTasks.length === tasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(tasks.map(task => task.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* エラー表示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-700">{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* 統計情報 */}
      {!compactMode && (
        <TaskStatistics
          statistics={statistics}
          currentView={currentView}
          onViewChange={handleViewChange}
        />
      )}

      {/* ツールバー */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            タスク管理
            {tasks.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({tasks.length}件)
              </span>
            )}
          </h2>
          
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            title="更新"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <div className="flex items-center space-x-2">
          {/* 一括操作 */}
          {selectedTasks.length > 0 && (
            <div className="flex items-center space-x-2 mr-4">
              <span className="text-sm text-gray-600">
                {selectedTasks.length}件選択中
              </span>
              <button
                onClick={() => handleBulkAction('complete')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                完了
              </button>
              <button
                onClick={() => handleBulkAction('reschedule_today')}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                今日
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
              >
                削除
              </button>
            </div>
          )}

          {allowCreate && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              新しいタスク
            </button>
          )}
        </div>
      </div>

      {/* フィルター */}
      <TaskFilters
        currentFilters={currentFilters}
        onFiltersChange={fetchTasks}
        compactMode={compactMode}
      />

      {/* タスクリスト */}
      <TaskList
        tasks={tasks}
        isLoading={isLoading}
        selectedTasks={selectedTasks}
        onTaskSelect={handleTaskSelection}
        onSelectAll={handleSelectAll}
        onTaskComplete={handleCompleteTask}
        onTaskEdit={setEditingTask}
        onTaskDelete={handleDeleteTask}
        onTaskReschedule={rescheduleTask}
        compactMode={compactMode}
      />

      {/* ページネーション */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            {pagination.total}件中 {((pagination.page - 1) * pagination.limit) + 1}〜
            {Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchTasks(currentFilters, pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              前へ
            </button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => fetchTasks(currentFilters, pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              次へ
            </button>
          </div>
        </div>
      )}

      {/* タスク作成フォーム */}
      {showCreateForm && (
        <TaskForm
          onSubmit={handleCreateTask}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* タスク編集フォーム */}
      {editingTask && (
        <TaskForm
          task={editingTask}
          onSubmit={(data) => handleUpdateTask(editingTask.id, data)}
          onCancel={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}