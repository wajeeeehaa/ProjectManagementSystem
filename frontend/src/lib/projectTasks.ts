import type { WorkspaceRole } from './workspaceRoles';

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator: Person;
};

export type ProjectDetail = Project & {
  statistics: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
  };
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type Task = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  createdBy: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  assignee: Person;
  creator: Person;
};

export type TaskList = {
  items: Task[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type TaskQuery = {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority' | 'title';
  sortDirection?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
};

export const statusLabel: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  DONE: 'Done',
};

export const priorityLabel: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
};

export const taskQueryString = (query: TaskQuery) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
};

export const projectPath = (workspaceId: string, projectId: string) =>
  `/workspaces/${workspaceId}/projects/${projectId}`;

export const canEditTask = (role: WorkspaceRole, task: Task, userId?: string) =>
  role === 'owner' || role === 'admin' || (role === 'member' && task.assigneeId === userId);
