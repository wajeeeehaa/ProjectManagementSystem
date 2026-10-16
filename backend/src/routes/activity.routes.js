import { Router } from 'express';
import { list } from '../controllers/activity.controller.js';
import { authentication } from '../middlewares/authenticationMiddlewares.js';
import { validationMiddleware } from '../middlewares/validationMiddleware.js';
import { activityListQuerySchema } from '../validations/activity.validation.js';

const router = Router({ strict: true });

router.use(authentication);
router.get('/', validationMiddleware(activityListQuerySchema, (req) => req.query), list);

export default router;
