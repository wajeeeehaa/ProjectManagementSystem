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

export type AssigneeProgress = {
  userId: string;
  firstName: string;
  lastName: string;
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  progress: number;
};

export type ProjectDetail = Project & {
  statistics: {
    total: number;
    todo: number;
    inProgress: number;
    done: number;
    progress: number;
    byAssignee: AssigneeProgress[];
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
  progress: number;
  assigneeId: string;
  dueDate: string;
  createdBy: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  assignee: Person;
  assignees: Person[];
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

export const taskAssigneeIds = (task: Pick<Task, 'assigneeId' | 'assignees'>) => {
  const ids = task.assignees?.map((person) => person.id) ?? [];
  if (ids.length === 0) return [task.assigneeId];
  return [task.assigneeId, ...ids.filter((id) => id !== task.assigneeId)];
};

export const assigneeLabel = (task: Pick<Task, 'assigneeId' | 'assignee' | 'assignees'>) => {
  const people = task.assignees?.length ? task.assignees : [task.assignee];
  const ordered = [
    ...people.filter((person) => person.id === task.assigneeId),
    ...people.filter((person) => person.id !== task.assigneeId),
  ];
  return ordered.map((person) => `${person.firstName} ${person.lastName}`).join(', ');
};

export const canEditTask = (role: WorkspaceRole, task: Task, userId?: string) =>
  role === 'owner' || role === 'admin' || (role === 'member' && Boolean(userId) && taskAssigneeIds(task).includes(userId));
