import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('roles_title_unique').on(table.title),
    check('roles_title_not_blank', sql`char_length(btrim(${table.title})) > 0`),
  ],
);

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('permissions_title_unique').on(table.title),
    check('permissions_title_not_blank', sql`char_length(btrim(${table.title})) > 0`),
  ],
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
    index('role_permissions_permission_id_idx').on(table.permissionId),
  ],
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    isVerified: boolean('is_verified').notNull().default(false),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    activationOtpHash: text('activation_otp_hash'),
    activationOtpExpiresAt: timestamp('activation_otp_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_email_unique').on(table.email),
    index('users_role_id_idx').on(table.roleId),
    check('users_email_lowercase', sql`${table.email} = lower(${table.email})`),
    check('users_first_name_not_blank', sql`char_length(btrim(${table.firstName})) > 0`),
    check('users_last_name_not_blank', sql`char_length(btrim(${table.lastName})) > 0`),
  ],
);

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('workspaces_created_by_idx').on(table.createdBy),
    check('workspaces_name_not_blank', sql`char_length(btrim(${table.name})) > 0`),
  ],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_members_user_id_idx').on(table.userId),
    index('workspace_members_workspace_id_role_idx').on(table.workspaceId, table.role),
    uniqueIndex('workspace_members_one_owner_per_workspace')
      .on(table.workspaceId)
      .where(sql`${table.role} = 'owner'`),
    check(
      'workspace_members_role_valid',
      sql`${table.role} IN ('owner', 'admin', 'member')`,
    ),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('projects_workspace_id_id_unique').on(table.workspaceId, table.id),
    index('projects_workspace_id_created_at_idx').on(table.workspaceId, table.createdAt),
    check('projects_name_not_blank', sql`char_length(btrim(${table.name})) > 0`),
  ],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('TODO'),
    priority: text('priority').notNull().default('MEDIUM'),
    progress: integer('progress').notNull().default(0),
    assigneeId: uuid('assignee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.projectId],
      foreignColumns: [projects.workspaceId, projects.id],
      name: 'tasks_project_workspace_fk',
    }).onDelete('cascade'),
    index('tasks_project_id_created_at_idx').on(table.projectId, table.createdAt),
    index('tasks_project_id_status_idx').on(table.projectId, table.status),
    index('tasks_project_id_priority_idx').on(table.projectId, table.priority),
    index('tasks_workspace_id_assignee_id_idx').on(table.workspaceId, table.assigneeId),
    index('tasks_project_id_due_date_idx').on(table.projectId, table.dueDate),
    check('tasks_title_not_blank', sql`char_length(btrim(${table.title})) > 0`),
    check('tasks_status_valid', sql`${table.status} IN ('TODO', 'IN_PROGRESS', 'DONE')`),
    check('tasks_priority_valid', sql`${table.priority} IN ('LOW', 'MEDIUM', 'HIGH')`),
    check('tasks_version_positive', sql`${table.version} > 0`),
    check('tasks_progress_range', sql`${table.progress} >= 0 AND ${table.progress} <= 100`),
  ],
);

export const taskAssignees = pgTable(
  'task_assignees',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index('task_assignees_user_id_idx').on(table.userId),
  ],
);

export const refreshSessions = pgTable(
  'refresh_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jtiHash: text('jti_hash').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    replacedAt: timestamp('replaced_at', { withTimezone: true }),
    csrfHash: text('csrf_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('refresh_sessions_jti_hash_unique').on(table.jtiHash),
    index('refresh_sessions_family_id_idx').on(table.familyId),
    index('refresh_sessions_user_id_idx').on(table.userId),
    index('refresh_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const blacklistTokens = pgTable(
  'blacklist_tokens',
  {
    tokenHash: text('token_hash').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('blacklist_tokens_expires_at_idx').on(table.expiresAt)],
);
