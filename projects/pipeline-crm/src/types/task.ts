import type { Timestamp } from 'firebase/firestore';

export type TaskStatus = 'pending' | 'in_progress' | 'done';
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3' | 'none';
export type TaskProject = 'A' | 'B' | 'Personal';

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  P0: 'P0 - Critical',
  P1: 'P1 - High',
  P2: 'P2 - Medium',
  P3: 'P3 - Low',
  none: 'None',
};

export const TASK_PROJECT_LABELS: Record<TaskProject, string> = {
  A: 'Company A',
  B: 'Company B',
  Personal: 'Personal',
};

export const TEAM_MEMBERS = [
  'Alex',
  'John',
  'Kiomi',
  'Jesse',
  'Pawel',
  'Arjan',
  'Stephan',
  'Maxim',
] as const;

export type TeamMember = typeof TEAM_MEMBERS[number];

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  assignee: TeamMember | string;
  project?: TaskProject | string;
  priority?: TaskPriority;
  dueDate?: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export interface TaskFormData {
  text: string;
  status: TaskStatus;
  assignee: string;
  project?: string;
  priority?: TaskPriority;
  dueDate?: string;
  notes?: string;
}

export interface TaskFilters {
  assignee?: string;
  status?: TaskStatus;
  project?: string;
}
