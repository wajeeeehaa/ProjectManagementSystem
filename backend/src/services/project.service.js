import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/database.js';
import { projects, tasks, users } from '../../db/schema/index.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';

const requireDb = () => {
  if (!db) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');
  return db;
};

const projectFields = {
  id: projects.id,
  workspaceId: projects.workspaceId,
  name: projects.name,
  description: projects.description,
  createdBy: projects.createdBy,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  creator: {
    id: users.id,
    firstName: users.firstName,
    lastName: users.lastName,
    email: users.email,
  },
};

const projectWhere = (workspaceId, projectId) =>
  and(eq(projects.workspaceId, workspaceId), eq(projects.id, projectId));

export const createProject = async (workspaceId, userId, input) => {
  const [project] = await requireDb()
    .insert(projects)
    .values({
      workspaceId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      createdBy: userId,
    })
    .returning();
  return project;
};

export const listProjects = async (workspaceId) =>
  requireDb()
    .select(projectFields)
    .from(projects)
    .innerJoin(users, eq(users.id, projects.createdBy))
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.updatedAt), asc(projects.name));

export const getProject = async (workspaceId, projectId) => {
  const [project] = await requireDb()
    .select(projectFields)
    .from(projects)
    .innerJoin(users, eq(users.id, projects.createdBy))
    .where(projectWhere(workspaceId, projectId))
    .limit(1);
  if (!project) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Project not found');
  return project;
};

export const getProjectStatistics = async (workspaceId, projectId) => {
  const [statistics] = await requireDb()
    .select({
      total: sql`count(*)::int`,
      todo: sql`count(*) filter (where ${tasks.status} = 'TODO')::int`,
      inProgress: sql`count(*) filter (where ${tasks.status} = 'IN_PROGRESS')::int`,
      done: sql`count(*) filter (where ${tasks.status} = 'DONE')::int`,
    })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), eq(tasks.projectId, projectId)));
  return statistics ?? { total: 0, todo: 0, inProgress: 0, done: 0 };
};

export const getProjectDetail = async (workspaceId, projectId) => {
  const [project, statistics] = await Promise.all([
    getProject(workspaceId, projectId),
    getProjectStatistics(workspaceId, projectId),
  ]);
  return { ...project, statistics };
};

export const ensureProject = async (executor, workspaceId, projectId) => {
  const [project] = await executor
    .select({ id: projects.id })
    .from(projects)
    .where(projectWhere(workspaceId, projectId))
    .limit(1);
  if (!project) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Project not found');
  return project;
};

export const updateProject = async (workspaceId, projectId, input) => {
  const changes = { updatedAt: new Date() };
  if (input.name !== undefined) changes.name = input.name.trim();
  if (input.description !== undefined) changes.description = input.description?.trim() || null;

  const [project] = await requireDb()
    .update(projects)
    .set(changes)
    .where(projectWhere(workspaceId, projectId))
    .returning();
  if (!project) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Project not found');
  return project;
};

export const deleteProject = async (workspaceId, projectId) => {
  const deleted = await requireDb().delete(projects).where(projectWhere(workspaceId, projectId)).returning({
    id: projects.id,
  });
  if (deleted.length === 0) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Project not found');
};
