import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { successResponse } from '../utils/customResponses.js';
import {
  createProject,
  deleteProject,
  getProjectDetail,
  listProjects,
  updateProject,
} from '../services/project.service.js';

export const create = asyncHandler(async (req, res) =>
  successResponse(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Project created',
    data: await createProject(req.params.workspaceId, req.userId, res.locals.validatedInput),
  }));

export const list = asyncHandler(async (req, res) =>
  successResponse(res, {
    data: await listProjects(req.params.workspaceId, {
      userId: req.userId,
      role: req.workspaceRole,
      assigned: req.query.assigned === 'true',
    }),
  }));

export const get = asyncHandler(async (req, res) =>
  successResponse(res, { data: await getProjectDetail(req.params.workspaceId, req.params.projectId) }));

export const update = asyncHandler(async (req, res) =>
  successResponse(res, {
    message: 'Project updated',
    data: await updateProject(req.params.workspaceId, req.params.projectId, res.locals.validatedInput),
  }));

export const remove = asyncHandler(async (req, res) => {
  await deleteProject(req.params.workspaceId, req.params.projectId);
  return successResponse(res, { message: 'Project deleted' });
});
