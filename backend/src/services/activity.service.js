import { and, asc, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '../../db/database.js';
import { activities, projects, users, workspaceMembers, workspaces } from '../../db/schema/index.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';

const requireDb = () => {
  if (!db) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');
  return db;
};

const activityQuery = (executor) =>
  executor
    .select({
      id: activities.id,
      eventType: activities.eventType,
      createdAt: activities.createdAt,
      resourceId: activities.resourceId,
      taskTitle: activities.taskTitle,
      details: activities.details,
      actorId: users.id,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      projectId: projects.id,
      projectName: projects.name,
    })
    .from(activities)
    .innerJoin(users, eq(users.id, activities.actorId))
    .innerJoin(workspaces, eq(workspaces.id, activities.workspaceId))
    .innerJoin(projects, eq(projects.id, activities.projectId));

const toActivity = (row) => ({
  id: row.id,
  eventType: row.eventType,
  createdAt: row.createdAt,
  actor: {
    id: row.actorId,
    firstName: row.actorFirstName,
    lastName: row.actorLastName,
  },
  workspace: {
    id: row.workspaceId,
    name: row.workspaceName,
  },
  project: {
    id: row.projectId,
    name: row.projectName,
  },
  task: {
    id: row.resourceId,
    title: row.taskTitle,
  },
  details: row.details,
});

export const loadPeople = async (executor, ids) => {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  return executor
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(inArray(users.id, unique))
    .orderBy(asc(users.firstName), asc(users.lastName), asc(users.id));
};

export const recordActivity = async (executor, input) => {
  const values = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    taskId: input.taskId,
    actorId: input.actorId,
    eventType: input.eventType,
    resourceType: 'task',
    resourceId: input.resourceId,
    taskTitle: input.taskTitle,
    details: input.details,
  };
  if (input.createdAt) values.createdAt = input.createdAt;
  const [created] = await executor
    .insert(activities)
    .values(values)
    .returning({ id: activities.id });
  const [row] = await activityQuery(executor).where(eq(activities.id, created.id)).limit(1);
  if (!row) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');
  return toActivity(row);
};

const cursorPredicate = (cursor) => {
  const createdAt = new Date(cursor.createdAt);
  return or(
    lt(activities.createdAt, createdAt),
    and(eq(activities.createdAt, createdAt), lt(activities.id, cursor.id)),
  );
};

export const listActivity = async (userId, query) => {
  const database = requireDb();
  const conditions = [
    sql`${activities.workspaceId} in (
      select ${workspaceMembers.workspaceId}
      from ${workspaceMembers}
      where ${workspaceMembers.userId} = ${userId}
    )`,
  ];
  if (query.cursor) conditions.push(cursorPredicate(query.cursor));

  const rows = await activityQuery(database)
    .where(and(...conditions))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(query.limit + 1);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page.at(-1);
  return {
    items: page.map(toActivity),
    nextCursor: hasMore && last ? `${new Date(last.createdAt).toISOString()}_${last.id}` : null,
  };
};
