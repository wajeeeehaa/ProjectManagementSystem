import { z } from 'zod';

const projectName = z.string().trim().min(1, 'Project name is required').max(160);
const description = z.string().trim().max(10_000).nullable().optional();

export const projectParamsSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace id'),
  projectId: z.string().uuid('Invalid project id'),
});

export const createProjectSchema = z.object({
  name: projectName,
  description,
});

export const updateProjectSchema = z
  .object({
    name: projectName.optional(),
    description,
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one project field to update');
