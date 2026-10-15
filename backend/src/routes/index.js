import { Router } from 'express';
import { privateCors, publicCors } from '../middlewares/cors.middleware.js';
import authRoutes from './auth.routes.js';
import healthRoutes from './health.routes.js';
import workspaceRoutes from './workspace.routes.js';

const router = Router({ strict: true });

router.use('/health', publicCors, healthRoutes);
router.use('/auth', authRoutes);

const privateRouter = Router({ strict: true });
privateRouter.use(privateCors);
privateRouter.use('/workspaces', workspaceRoutes);

router.use(privateRouter);

export default router;
