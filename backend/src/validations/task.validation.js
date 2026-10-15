import { z } from 'zod';

export const taskStatuses = ['TODO', 'IN_PROGRESS', 'DONE'];
export const taskPriorities = ['LOW', 'MEDIUM', 'HIGH'];
export const taskSortFields = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'];

const title = z.string().trim().min(1, 'Task title is required').max(240);
const description = z.string().trim().max(10_000).nullable().optional();
const dueDate = z.coerce.date().refine((value) => !Number.isNaN(value.valueOf()), 'Enter a valid due date');
const version = z.coerce.number().int().positive('Task version must be positive');

export const taskParamsSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace id'),
  projectId: z.string().uuid('Invalid project id'),
  taskId: z.string().uuid('Invalid task id'),
});

export const createTaskSchema = z.object({
  title,
  description,
  status: z.enum(taskStatuses).default('TODO'),
  priority: z.enum(taskPriorities).default('MEDIUM'),
  assigneeId: z.string().uuid('Invalid assignee id'),
  dueDate,
});

export const updateTaskSchema = z
  .object({
    title: title.optional(),
    description,
    status: z.enum(taskStatuses).optional(),
    priority: z.enum(taskPriorities).optional(),
    assigneeId: z.string().uuid('Invalid assignee id').optional(),
    dueDate: dueDate.optional(),
    version,
  })
  .refine(
    (value) => Object.keys(value).some((key) => key !== 'version'),
    'Provide at least one task field to update',
  );

export const taskListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(taskStatuses).optional(),
  priority: z.enum(taskPriorities).optional(),
  assigneeId: z.string().uuid('Invalid assignee id').optional(),
  sortBy: z.enum(taskSortFields).default('createdAt'),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
