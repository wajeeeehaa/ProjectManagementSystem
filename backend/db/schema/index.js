import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
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
