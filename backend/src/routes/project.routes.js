import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import * as taskController from '../controllers/task.controller.js';
import { csrfProtection } from '../middlewares/csrf.middleware.js';
import {
  loadWorkspaceMember,
  requireWorkspaceRoles,
} from '../middlewares/workspaceAuthorization.middleware.js';
import { validationMiddleware } from '../middlewares/validationMiddleware.js';
import {
  createProjectSchema,
  projectParamsSchema,
  updateProjectSchema,
} from '../validations/project.validation.js';
import {
  createTaskSchema,
  taskListQuerySchema,
  taskParamsSchema,
  updateTaskSchema,
} from '../validations/task.validation.js';

const router = Router({ mergeParams: true, strict: true });
const managers = requireWorkspaceRoles(['owner', 'admin']);
const projectParams = validationMiddleware(projectParamsSchema, (req) => req.params);
const taskParams = validationMiddleware(taskParamsSchema, (req) => req.params);

router.use(loadWorkspaceMember);

router.post('/', managers, csrfProtection, validationMiddleware(createProjectSchema), projectController.create);
router.get('/', projectController.list);

router.get('/:projectId', projectParams, projectController.get);
router.patch(
  '/:projectId',
  projectParams,
  managers,
  csrfProtection,
  validationMiddleware(updateProjectSchema),
  projectController.update,
);
router.delete('/:projectId', projectParams, managers, csrfProtection, projectController.remove);

router.post(
  '/:projectId/tasks',
  projectParams,
  managers,
  csrfProtection,
  validationMiddleware(createTaskSchema),
  taskController.create,
);
router.get(
  '/:projectId/tasks',
  projectParams,
  validationMiddleware(taskListQuerySchema, (req) => req.query),
  taskController.list,
);
router.get('/:projectId/tasks/:taskId', taskParams, taskController.get);
router.patch(
  '/:projectId/tasks/:taskId',
  taskParams,
  csrfProtection,
  validationMiddleware(updateTaskSchema),
  taskController.update,
);
router.delete(
  '/:projectId/tasks/:taskId',
  taskParams,
  managers,
  csrfProtection,
  taskController.remove,
);

export default router;
