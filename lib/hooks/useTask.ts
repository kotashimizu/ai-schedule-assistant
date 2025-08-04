import { useState, useEffect, useCallback } from 'react';
import { Task, TaskPriority, TaskStatus } from '@/types/shared';

interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  search?: string;
  category?: string;
  dueBefore?: string;
  dueAfter?: string;
  scheduledDate?: string;
}

interface CreateTaskData {
  title: string;
  description?: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  category?: string;
  dueDate?: string;
  scheduledDate?: string;
  eventId?: string;
}

interface UpdateTaskData {
  title?: string;
  description?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
  category?: string;
  dueDate?: string;
  scheduledDate?: string;
  eventId?: string;
}

interface TaskState {
  tasks: Task[];
  statistics: {
    total: number;
    by_status: Record<TaskStatus, number>;
    by_priority: Record<TaskPriority, number>;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  error: string | null;
}

interface BulkOperation {
  action: 'update_status' | 'delete' | 'reschedule';
  taskIds: string[];
  data?: {
    status?: TaskStatus;
    scheduledDate?: string;
    actualMinutes?: number;
  };
}

export function useTask() {
  const [state, setState] = useState<TaskState>({
    tasks: [],
    statistics: {
      total: 0,
      by_status: { pending: 0, in_progress: 0, completed: 0, cancelled: 0 },
      by_priority: { high: 0, medium: 0, low: 0 },
    },
    pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
    isLoading: false,
    error: null,
  });

  const [currentFilters, setCurrentFilters] = useState<TaskFilters>({});

  // タスク一覧取得
  const fetchTasks = useCallback(async (filters: TaskFilters = {}, page: number = 1) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams();
      
      if (filters.status?.length) {
        params.set('status', filters.status.join(','));
      }
      if (filters.priority?.length) {
        params.set('priority', filters.priority.join(','));
      }
      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.category) {
        params.set('category', filters.category);
      }
      if (filters.dueBefore) {
        params.set('dueBefore', filters.dueBefore);
      }
      if (filters.dueAfter) {
        params.set('dueAfter', filters.dueAfter);
      }
      if (filters.scheduledDate) {
        params.set('scheduledDate', filters.scheduledDate);
      }
      
      params.set('page', page.toString());
      params.set('limit', '50');

      const response = await fetch(`/api/tasks?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'タスクの取得に失敗しました');
      }

      const data = await response.json();
      
      setState(prev => ({
        ...prev,
        tasks: data.tasks,
        statistics: data.statistics,
        pagination: data.pagination,
        isLoading: false,
      }));

      setCurrentFilters(filters);

    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'タスクの取得に失敗しました',
      }));
    }
  }, []);

  // タスク作成
  const createTask = useCallback(async (taskData: CreateTaskData): Promise<Task | null> => {
    setState(prev => ({ ...prev, error: null }));

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'タスクの作成に失敗しました');
      }

      const data = await response.json();
      
      // リストを更新
      await fetchTasks(currentFilters, state.pagination.page);
      
      return data.task;

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'タスクの作成に失敗しました',
      }));
      return null;
    }
  }, [currentFilters, state.pagination.page, fetchTasks]);

  // タスク更新
  const updateTask = useCallback(async (taskId: string, updateData: UpdateTaskData): Promise<Task | null> => {
    setState(prev => ({ ...prev, error: null }));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'タスクの更新に失敗しました');
      }

      const data = await response.json();
      
      // ローカル状態を更新
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.map(task => 
          task.id === taskId ? data.task : task
        ),
      }));

      // 統計を再取得
      await fetchTasks(currentFilters, state.pagination.page);
      
      return data.task;

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'タスクの更新に失敗しました',
      }));
      return null;
    }
  }, [currentFilters, state.pagination.page, fetchTasks]);

  // タスク削除
  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    setState(prev => ({ ...prev, error: null }));

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'タスクの削除に失敗しました');
      }

      // ローカル状態から削除
      setState(prev => ({
        ...prev,
        tasks: prev.tasks.filter(task => task.id !== taskId),
      }));

      // 統計を再取得
      await fetchTasks(currentFilters, state.pagination.page);
      
      return true;

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'タスクの削除に失敗しました',
      }));
      return false;
    }
  }, [currentFilters, state.pagination.page, fetchTasks]);

  // 一括操作
  const bulkOperation = useCallback(async (operation: BulkOperation): Promise<boolean> => {
    setState(prev => ({ ...prev, error: null }));

    try {
      const response = await fetch('/api/tasks/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(operation),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '一括操作に失敗しました');
      }

      // リストを再取得
      await fetchTasks(currentFilters, state.pagination.page);
      
      return true;

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : '一括操作に失敗しました',
      }));
      return false;
    }
  }, [currentFilters, state.pagination.page, fetchTasks]);

  // タスク完了
  const completeTask = useCallback(async (taskId: string, actualMinutes?: number): Promise<boolean> => {
    return await updateTask(taskId, { 
      status: 'completed',
      actualMinutes 
    }) !== null;
  }, [updateTask]);

  // タスクリスケジュール
  const rescheduleTask = useCallback(async (taskId: string, newDate: string): Promise<boolean> => {
    return await updateTask(taskId, { 
      scheduledDate: newDate 
    }) !== null;
  }, [updateTask]);

  // 今日のタスク取得
  const getTodayTasks = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    await fetchTasks({ scheduledDate: today });
  }, [fetchTasks]);

  // 期限切れタスク取得
  const getOverdueTasks = useCallback(async () => {
    const now = new Date().toISOString();
    await fetchTasks({ 
      dueBefore: now,
      status: ['pending', 'in_progress'] 
    });
  }, [fetchTasks]);

  // 初回読み込み
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return {
    // 状態
    tasks: state.tasks,
    statistics: state.statistics,
    pagination: state.pagination,
    isLoading: state.isLoading,
    error: state.error,
    currentFilters,

    // 操作
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    bulkOperation,
    completeTask,
    rescheduleTask,
    getTodayTasks,
    getOverdueTasks,

    // ユーティリティ
    clearError: () => setState(prev => ({ ...prev, error: null })),
    refresh: () => fetchTasks(currentFilters, state.pagination.page),
  };
}