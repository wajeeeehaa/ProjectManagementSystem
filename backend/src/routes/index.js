import { Router } from 'express';
import { privateCors, publicCors } from '../middlewares/cors.middleware.js';
import healthRoutes from './health.routes.js';

const router = Router();

const publicRouter = Router();
publicRouter.use('/health', publicCors, healthRoutes);

const privateRouter = Router();
privateRouter.use(privateCors);

router.use(publicRouter);
router.use(privateRouter);

export default router;
