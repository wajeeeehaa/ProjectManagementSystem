import { asyncHandler } from '../utils/asyncHandler.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { HttpError } from '../utils/httpError.js';
import { getWorkspaceMembership } from '../services/workspace.service.js';

export const loadWorkspaceMember = asyncHandler(async (req, res, next) => {
  void res;
  if (!req.userId) throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  const membership = await getWorkspaceMembership(req.params.workspaceId, req.userId);
  if (!membership) throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Forbidden');
  req.workspaceRole = membership.role;
  return next();
});

export const requireWorkspaceRoles = (roles) =>
  asyncHandler(async (req, res, next) => {
    void res;
    if (!req.workspaceRole || !roles.includes(req.workspaceRole)) {
      throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Forbidden');
    }
    return next();
  });
