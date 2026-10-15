import { z } from 'zod';

const workspaceName = z.string().trim().min(1, 'Workspace name is required').max(120);
const email = z.string().trim().email('Enter a valid email address').transform((value) => value.toLowerCase());
const memberRole = z.enum(['admin', 'member'], { message: 'Role must be admin or member' });

export const workspaceIdParamsSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace id'),
});

export const memberParamsSchema = workspaceIdParamsSchema.extend({
  userId: z.string().uuid('Invalid user id'),
});

export const createWorkspaceSchema = z.object({ name: workspaceName });
export const updateWorkspaceSchema = z.object({ name: workspaceName });
export const addMemberSchema = z.object({ email, role: memberRole.default('member') });
export const updateMemberRoleSchema = z.object({ role: memberRole });
export const transferOwnershipSchema = z.object({ userId: z.string().uuid('Invalid user id') });
