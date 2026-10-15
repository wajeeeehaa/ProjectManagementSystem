import { Router } from 'express';
import projectRoutes from './project.routes.js';
import {
  add,
  create,
  get,
  list,
  members,
  remove,
  removeMember,
  transfer,
  update,
  updateMember,
} from '../controllers/workspace.controller.js';
import { authentication } from '../middlewares/authenticationMiddlewares.js';
import { csrfProtection } from '../middlewares/csrf.middleware.js';
import {
  loadWorkspaceMember,
  requireWorkspaceRoles,
} from '../middlewares/workspaceAuthorization.middleware.js';
import { validationMiddleware } from '../middlewares/validationMiddleware.js';
import {
  addMemberSchema,
  createWorkspaceSchema,
  memberParamsSchema,
  transferOwnershipSchema,
  updateMemberRoleSchema,
  updateWorkspaceSchema,
  workspaceIdParamsSchema,
} from '../validations/workspace.validation.js';

const router = Router({ strict: true });
const workspaceParams = validationMiddleware(workspaceIdParamsSchema, (req) => req.params);
const memberParams = validationMiddleware(memberParamsSchema, (req) => req.params);
const managers = requireWorkspaceRoles(['owner', 'admin']);
const owners = requireWorkspaceRoles(['owner']);

router.use(authentication);
router.post('/', csrfProtection, validationMiddleware(createWorkspaceSchema), create);
router.get('/', list);
router.use('/:workspaceId/projects', workspaceParams, projectRoutes);

router.get('/:workspaceId', workspaceParams, loadWorkspaceMember, get);
router.patch(
  '/:workspaceId',
  workspaceParams,
  loadWorkspaceMember,
  owners,
  csrfProtection,
  validationMiddleware(updateWorkspaceSchema),
  update,
);
router.delete('/:workspaceId', workspaceParams, loadWorkspaceMember, owners, csrfProtection, remove);

router.get('/:workspaceId/members', workspaceParams, loadWorkspaceMember, members);
router.post(
  '/:workspaceId/members',
  workspaceParams,
  loadWorkspaceMember,
  managers,
  csrfProtection,
  validationMiddleware(addMemberSchema),
  add,
);
router.patch(
  '/:workspaceId/members/:userId',
  memberParams,
  loadWorkspaceMember,
  managers,
  csrfProtection,
  validationMiddleware(updateMemberRoleSchema),
  updateMember,
);
router.delete(
  '/:workspaceId/members/:userId',
  memberParams,
  loadWorkspaceMember,
  managers,
  csrfProtection,
  removeMember,
);
router.post(
  '/:workspaceId/transfer-ownership',
  workspaceParams,
  loadWorkspaceMember,
  owners,
  csrfProtection,
  validationMiddleware(transferOwnershipSchema),
  transfer,
);

export default router;
