import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { successResponse } from '../utils/customResponses.js';
import {
  addMember,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  listMembers,
  listWorkspaces,
  removeMember as removeWorkspaceMember,
  transferOwnership,
  updateMemberRole,
  updateWorkspace,
} from '../services/workspace.service.js';

export const create = asyncHandler(async (req, res) => {
  const workspace = await createWorkspace(req.userId, res.locals.validatedInput);
  return successResponse(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Workspace created',
    data: workspace,
  });
});

export const list = asyncHandler(async (req, res) =>
  successResponse(res, { data: await listWorkspaces(req.userId) }));

export const get = asyncHandler(async (req, res) =>
  successResponse(res, {
    data: { ...(await getWorkspace(req.params.workspaceId)), role: req.workspaceRole },
  }));

export const update = asyncHandler(async (req, res) =>
  successResponse(res, {
    message: 'Workspace updated',
    data: await updateWorkspace(req.params.workspaceId, res.locals.validatedInput),
  }));

export const remove = asyncHandler(async (req, res) => {
  await deleteWorkspace(req.params.workspaceId);
  return successResponse(res, { message: 'Workspace deleted' });
});

export const members = asyncHandler(async (req, res) =>
  successResponse(res, { data: await listMembers(req.params.workspaceId) }));

export const add = asyncHandler(async (req, res) =>
  successResponse(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Member added',
    data: await addMember(req.params.workspaceId, res.locals.validatedInput),
  }));

export const updateMember = asyncHandler(async (req, res) =>
  successResponse(res, {
    message: 'Member role updated',
    data: await updateMemberRole(
      req.params.workspaceId,
      req.params.userId,
      res.locals.validatedInput.role,
    ),
  }));

export const removeMember = asyncHandler(async (req, res) => {
  await removeWorkspaceMember(req.params.workspaceId, req.params.userId);
  return successResponse(res, { message: 'Member removed' });
});

export const transfer = asyncHandler(async (req, res) => {
  await transferOwnership(req.params.workspaceId, req.userId, res.locals.validatedInput.userId);
  return successResponse(res, { message: 'Ownership transferred' });
});
