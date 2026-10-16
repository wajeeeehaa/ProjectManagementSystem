import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db/database.js';
import { taskAssignees, tasks, users, workspaceMembers } from '../../db/schema/index.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { loadPeople, recordActivity } from './activity.service.js';
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
  progress: tasks.progress,
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

const assigneeIdList = (input) => {
  const ids = input.assigneeIds?.length ? input.assigneeIds : input.assigneeId ? [input.assigneeId] : [];
  return [...new Set(ids)];
};

const attachAssignees = async (executor, items) => {
  if (items.length === 0) return items;
  const rows = await executor
    .select({
      taskId: taskAssignees.taskId,
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(inArray(taskAssignees.taskId, items.map((item) => item.id)))
    .orderBy(asc(users.firstName), asc(users.lastName));
  const grouped = new Map();
  for (const row of rows) {
    const person = { id: row.id, firstName: row.firstName, lastName: row.lastName, email: row.email };
    const list = grouped.get(row.taskId) ?? [];
    list.push(person);
    grouped.set(row.taskId, list);
  }
  return items.map((item) => {
    const people = grouped.get(item.id) ?? [item.assignee];
    const assignees = [
      ...people.filter((person) => person.id === item.assigneeId),
      ...people.filter((person) => person.id !== item.assigneeId),
    ];
    return { ...item, assignee: assignees[0] ?? item.assignee, assignees };
  });
};

const replaceAssignees = async (executor, workspaceId, taskId, assigneeIds) => {
  for (const assigneeId of assigneeIds) {
    await ensureAssignableMember(executor, workspaceId, assigneeId);
  }
  await executor.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));
  await executor.insert(taskAssignees).values(assigneeIds.map((userId) => ({ taskId, userId })));
};

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

const sameIdSet = (left, right) => {
  if (left.length !== right.length) return false;
  const values = new Set(left);
  return right.every((id) => values.has(id));
};

const peopleInSet = (people, ids) => people.filter((person) => ids.includes(person.id));

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
    const assigneeIds = assigneeIdList(input);
    const [task] = await tx
      .insert(tasks)
      .values({
        workspaceId,
        projectId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: input.status,
        priority: input.priority,
        progress: input.progress,
        assigneeId: assigneeIds[0],
        dueDate: input.dueDate,
        createdBy: userId,
      })
      .returning({ id: tasks.id });
    await replaceAssignees(tx, workspaceId, task.id, assigneeIds);
    const activity = await recordActivity(tx, {
      workspaceId,
      projectId,
      taskId: task.id,
      actorId: userId,
      eventType: 'TASK_CREATED',
      resourceId: task.id,
      taskTitle: input.title.trim(),
      details: {
        status: input.status,
        priority: input.priority,
        assignees: await loadPeople(tx, assigneeIds),
      },
    });
    return { id: task.id, activities: [activity] };
  });

export const getTask = async (workspaceId, projectId, taskId) => {
  const database = requireDb();
  const [task] = await taskQuery(database).where(taskWhere(workspaceId, projectId, taskId)).limit(1);
  if (!task) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Task not found');
  const [withAssignees] = await attachAssignees(database, [task]);
  return withAssignees;
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
  if (query.assigneeId) {
    conditions.push(or(
      eq(tasks.assigneeId, query.assigneeId),
      sql`exists (select 1 from "task_assignees" where "task_assignees"."task_id" = ${tasks.id} and "task_assignees"."user_id" = ${query.assigneeId})`,
    ));
  }

  const where = and(...conditions);
  const orderColumn = orderColumns[query.sortBy];
  const order = query.sortDirection === 'asc' ? asc(orderColumn) : desc(orderColumn);
  const offset = (query.page - 1) * query.pageSize;
  const database = requireDb();
  const [items, countResult] = await Promise.all([
    taskQuery(database).where(where).orderBy(order, asc(tasks.id)).limit(query.pageSize).offset(offset),
    database.select({ total: sql`count(*)::int` }).from(tasks).where(where),
  ]);
  const tasksWithAssignees = await attachAssignees(database, items);
  const total = countResult[0]?.total ?? 0;
  return {
    items: tasksWithAssignees,
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
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        assigneeId: tasks.assigneeId,
        version: tasks.version,
      })
      .from(tasks)
      .where(taskWhere(workspaceId, projectId, taskId))
      .limit(1);
    if (!existing) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Task not found');

    const links = await tx
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId));
    const assignedIds = new Set(links.map((link) => link.userId));
    assignedIds.add(existing.assigneeId);
    const requestedFields = Object.keys(input).filter((key) => key !== 'version');
    const memberFields = new Set(['status', 'progress']);
    const memberCanUpdate =
      workspaceRole === 'member' &&
      assignedIds.has(userId) &&
      requestedFields.length > 0 &&
      requestedFields.every((key) => memberFields.has(key));
    if (workspaceRole === 'member' && !memberCanUpdate) {
      throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Members can only update the status and progress of their assigned tasks');
    }

    const nextAssigneeIds = input.assigneeIds !== undefined || input.assigneeId !== undefined
      ? assigneeIdList(input)
      : null;

    const changes = {
      updatedAt: new Date(),
      version: sql`${tasks.version} + 1`,
    };
    if (nextAssigneeIds) changes.assigneeId = nextAssigneeIds[0];
    for (const key of ['title', 'description', 'status', 'priority', 'progress', 'dueDate']) {
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
    const assigneesChanged = Boolean(nextAssigneeIds) && !sameIdSet([...assignedIds], nextAssigneeIds);
    if (assigneesChanged) await replaceAssignees(tx, workspaceId, taskId, nextAssigneeIds);

    const taskTitle = input.title !== undefined ? input.title.trim() : existing.title;
    const recorded = [];
    let sequence = 0;
    const startedAt = Date.now();
    const base = {
      workspaceId,
      projectId,
      taskId,
      actorId: userId,
      resourceId: taskId,
      taskTitle,
    };
    const nextActivity = (eventType, details) => recordActivity(tx, {
      ...base,
      eventType,
      details,
      createdAt: new Date(startedAt + sequence++),
    });
    if (input.status !== undefined && input.status !== existing.status) {
      recorded.push(await nextActivity('TASK_STATUS_CHANGED', { from: existing.status, to: input.status }));
    }
    if (input.priority !== undefined && input.priority !== existing.priority) {
      recorded.push(await nextActivity('TASK_PRIORITY_CHANGED', { from: existing.priority, to: input.priority }));
    }
    if (assigneesChanged) {
      const people = await loadPeople(tx, [...assignedIds, ...nextAssigneeIds]);
      recorded.push(await nextActivity('TASK_ASSIGNED', {
        from: peopleInSet(people, [...assignedIds]),
        to: peopleInSet(people, nextAssigneeIds),
      }));
    }
    return { id: updated[0].id, activities: recorded };
  });

export const deleteTask = async (workspaceId, projectId, taskId, userId) =>
  requireDb().transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        priority: tasks.priority,
        assigneeId: tasks.assigneeId,
      })
      .from(tasks)
      .where(taskWhere(workspaceId, projectId, taskId))
      .limit(1);
    if (!existing) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Task not found');

    const links = await tx
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId));
    const assigneeIds = [...new Set([existing.assigneeId, ...links.map((link) => link.userId)])];
    const activity = await recordActivity(tx, {
      workspaceId,
      projectId,
      taskId,
      actorId: userId,
      eventType: 'TASK_DELETED',
      resourceId: taskId,
      taskTitle: existing.title,
      details: {
        status: existing.status,
        priority: existing.priority,
        assignees: await loadPeople(tx, assigneeIds),
      },
    });
    const deleted = await tx
      .delete(tasks)
      .where(taskWhere(workspaceId, projectId, taskId))
      .returning({ id: tasks.id });
    if (deleted.length === 0) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Task not found');
    return { activities: [activity] };
  });
