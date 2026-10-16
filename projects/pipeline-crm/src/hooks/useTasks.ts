import { useState, useEffect } from 'react';
import { getTasksRealtime, createTask, updateTask, deleteTask } from '@/lib/firestore';
import { useAuth } from './useAuth';
import type { Task, TaskFormData, TaskFilters } from '@/types/task';

export const useTasks = (filters?: TaskFilters) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = getTasksRealtime((tasksData) => {
      setTasks(tasksData);
      setLoading(false);
    }, filters);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [filters?.assignee, filters?.status, filters?.project]);

  const addTask = async (taskData: TaskFormData) => {
    if (!user?.email) {
      throw new Error('User not authenticated');
    }
    try {
      await createTask(taskData, user.email);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create task';
      setError(errorMessage);
      throw err;
    }
  };

  const editTask = async (id: string, data: Partial<TaskFormData>) => {
    try {
      await updateTask(id, data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update task';
      setError(errorMessage);
      throw err;
    }
  };

  const removeTask = async (id: string) => {
    try {
      await deleteTask(id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete task';
      setError(errorMessage);
      throw err;
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'done' ? 'pending' : 'done';
    await editTask(id, { status: newStatus as 'pending' | 'done' });
  };

  return {
    tasks,
    loading,
    error,
    addTask,
    editTask,
    removeTask,
    toggleStatus,
  };
};
