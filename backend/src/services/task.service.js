import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/database.js';
import { tasks, users, workspaceMembers } from '../../db/schema/index.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { ensureProject } from './project.service.js';

const assignees = alias(users, 'task_assignee');
const creators = alias(users, 'task_creator');

const requireDb = () => {
  if (!db) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');
  return db;
};

const taskFields = {
  id: tasks.id,
  workspaceId: tasks.workspaceId,
  projectId: tasks.projectId,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  assigneeId: tasks.assigneeId,
  dueDate: tasks.dueDate,
  createdBy: tasks.createdBy,
  version: tasks.version,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  assignee: {
    id: assignees.id,
    firstName: assignees.firstName,
    lastName: assignees.lastName,
    email: assignees.email,
  },
  creator: {
    id: creators.id,
    firstName: creators.firstName,
    lastName: creators.lastName,
    email: creators.email,
  },
};

const taskWhere = (workspaceId, projectId, taskId) =>
  and(
    eq(tasks.workspaceId, workspaceId),
    eq(tasks.projectId, projectId),
    eq(tasks.id, taskId),
  );

const taskQuery = (executor) =>
  executor
    .select(taskFields)
    .from(tasks)
    .innerJoin(assignees, eq(assignees.id, tasks.assigneeId))
    .innerJoin(creators, eq(creators.id, tasks.createdBy));

const ensureAssignableMember = async (executor, workspaceId, assigneeId) => {
  const [membership] = await executor
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, assigneeId),
      ),
    )
    .limit(1);
  if (!membership || membership.role !== 'member') {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Tasks can only be assigned to workspace Members');
  }
};

const orderColumns = {
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  dueDate: tasks.dueDate,
  priority: tasks.priority,
  title: tasks.title,
};

export const createTask = async (workspaceId, projectId, userId, input) =>
  requireDb().transaction(async (tx) => {
    await ensureProject(tx, workspaceId, projectId);
    await ensureAssignableMember(tx, workspaceId, input.assigneeId);
    const [task] = await tx
      .insert(tasks)
      .values({
        workspaceId,
        projectId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate,
        createdBy: userId,
      })
      .returning({ id: tasks.id });
    return task;
  });

export const getTask = async (workspaceId, projectId, taskId) => {
  const [task] = await taskQuery(requireDb()).where(taskWhere(workspaceId, projectId, taskId)).limit(1);
  if (!task) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Task not found');
  return task;
};

export const listTasks = async (workspaceId, projectId, query) => {
  await ensureProject(requireDb(), workspaceId, projectId);
  const conditions = [eq(tasks.workspaceId, workspaceId), eq(tasks.projectId, projectId)];
  if (query.search) {
    const pattern = `%${query.search}%`;
    conditions.push(or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)));
  }
  if (query.status) conditions.push(eq(tasks.status, query.status));
  if (query.priority) conditions.push(eq(tasks.priority, query.priority));
  if (query.assigneeId) conditions.push(eq(tasks.assigneeId, query.assigneeId));

  const where = and(...conditions);
  const orderColumn = orderColumns[query.sortBy];
  const order = query.sortDirection === 'asc' ? asc(orderColumn) : desc(orderColumn);
  const offset = (query.page - 1) * query.pageSize;
  const database = requireDb();
  const [items, countResult] = await Promise.all([
    taskQuery(database).where(where).orderBy(order, asc(tasks.id)).limit(query.pageSize).offset(offset),
    database.select({ total: sql`count(*)::int` }).from(tasks).where(where),
  ]);
  const total = countResult[0]?.total ?? 0;
  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
  };
};

export const updateTask = async (workspaceId, projectId, taskId, userId, workspaceRole, input) =>
  requireDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: tasks.id,
        assigneeId: tasks.assigneeId,
        version: tasks.version,
      })
      .from(tasks)
      .where(taskWhere(workspaceId, projectId, taskId))
      .limit(1);
    if (!existing) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Task not found');

    const requestedFields = Object.keys(input).filter((key) => key !== 'version');
    const memberStatusOnly =
      workspaceRole === 'member' &&
      existing.assigneeId === userId &&
      requestedFields.length === 1 &&
      requestedFields[0] === 'status';
    if (workspaceRole === 'member' && !memberStatusOnly) {
      throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Members can only update the status of their assigned tasks');
    }

    if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
      await ensureAssignableMember(tx, workspaceId, input.assigneeId);
    }

    const changes = {
      updatedAt: new Date(),
      version: sql`${tasks.version} + 1`,
    };
    for (const key of ['title', 'description', 'status', 'priority', 'assigneeId', 'dueDate']) {
      if (input[key] !== undefined) changes[key] = key === 'description' ? input[key]?.trim() || null : input[key];
    }

    const updated = await tx
      .update(tasks)
      .set(changes)
      .where(and(taskWhere(workspaceId, projectId, taskId), eq(tasks.version, input.version)))
      .returning({ id: tasks.id });
    if (updated.length === 0) {
      throw new HttpError(
        HTTP_STATUS.CONFLICT,
        'This task was updated by someone else. Refresh the task and try again.',
      );
    }
    return updated[0];
  });

export const deleteTask = async (workspaceId, projectId, taskId) => {
  const deleted = await requireDb()
    .delete(tasks)
    .where(taskWhere(workspaceId, projectId, taskId))
    .returning({ id: tasks.id });
  if (deleted.length === 0) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Task not found');
};
