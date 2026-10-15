import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/database.js';
import { users, workspaceMembers, workspaces } from '../../db/schema/index.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';

const requireDb = () => {
  if (!db) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');
  return db;
};

const normalizeEmail = (email) => email.trim().toLowerCase();
const membershipWhere = (workspaceId, userId) =>
  and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId));

const selectWorkspace = {
  id: workspaces.id,
  name: workspaces.name,
  createdBy: workspaces.createdBy,
  createdAt: workspaces.createdAt,
  updatedAt: workspaces.updatedAt,
};

const selectMember = {
  userId: users.id,
  email: users.email,
  firstName: users.firstName,
  lastName: users.lastName,
  role: workspaceMembers.role,
  joinedAt: workspaceMembers.createdAt,
};

export const getWorkspaceMembership = async (workspaceId, userId) => {
  const [membership] = await requireDb()
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(membershipWhere(workspaceId, userId))
    .limit(1);
  return membership ?? null;
};

export const createWorkspace = async (userId, { name }) =>
  requireDb().transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: name.trim(), createdBy: userId })
      .returning(selectWorkspace);
    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: 'owner',
    });
    return { ...workspace, role: 'owner' };
  });

export const listWorkspaces = async (userId) =>
  requireDb()
    .select({ ...selectWorkspace, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.name));

export const getWorkspace = async (workspaceId) => {
  const [workspace] = await requireDb()
    .select(selectWorkspace)
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Workspace not found');
  return workspace;
};

export const updateWorkspace = async (workspaceId, { name }) => {
  const [workspace] = await requireDb()
    .update(workspaces)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
    .returning(selectWorkspace);
  if (!workspace) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Workspace not found');
  return workspace;
};

export const deleteWorkspace = async (workspaceId) => {
  const deleted = await requireDb().delete(workspaces).where(eq(workspaces.id, workspaceId)).returning({
    id: workspaces.id,
  });
  if (deleted.length === 0) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Workspace not found');
};

export const listMembers = async (workspaceId) =>
  requireDb()
    .select(selectMember)
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(users.firstName), asc(users.lastName));

export const addMember = async (workspaceId, { email, role }) => {
  const database = requireDb();
  const [user] = await database
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);
  if (!user) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Registered user not found');

  try {
    await database.insert(workspaceMembers).values({ workspaceId, userId: user.id, role });
  } catch (error) {
    if (error?.code === '23505') throw new HttpError(HTTP_STATUS.CONFLICT, 'User is already a workspace member');
    throw error;
  }
  return { userId: user.id, email: user.email, role };
};

const ensureMutableMember = async (executor, workspaceId, targetUserId) => {
  const [member] = await executor
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(membershipWhere(workspaceId, targetUserId))
    .limit(1);
  if (!member) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Workspace member not found');
  if (member.role === 'owner') throw new HttpError(HTTP_STATUS.FORBIDDEN, 'The workspace owner cannot be changed here');
  return member;
};

export const updateMemberRole = async (workspaceId, targetUserId, role) =>
  requireDb().transaction(async (tx) => {
    await ensureMutableMember(tx, workspaceId, targetUserId);
    const [member] = await tx
      .update(workspaceMembers)
      .set({ role, updatedAt: new Date() })
      .where(membershipWhere(workspaceId, targetUserId))
      .returning({ userId: workspaceMembers.userId, role: workspaceMembers.role });
    return member;
  });

export const removeMember = async (workspaceId, targetUserId) =>
  requireDb().transaction(async (tx) => {
    await ensureMutableMember(tx, workspaceId, targetUserId);
    await tx.delete(workspaceMembers).where(membershipWhere(workspaceId, targetUserId));
  });

export const transferOwnership = async (workspaceId, ownerId, targetUserId) =>
  requireDb().transaction(async (tx) => {
    if (ownerId === targetUserId) throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'User already owns this workspace');
    const [target] = await tx
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(membershipWhere(workspaceId, targetUserId))
      .limit(1);
    if (!target) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'Workspace member not found');

    await tx
      .update(workspaceMembers)
      .set({ role: 'admin', updatedAt: new Date() })
      .where(membershipWhere(workspaceId, ownerId));
    await tx
      .update(workspaceMembers)
      .set({ role: 'owner', updatedAt: new Date() })
      .where(membershipWhere(workspaceId, targetUserId));
  });
