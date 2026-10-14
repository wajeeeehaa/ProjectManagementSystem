import { Router } from 'express';
import {
  changePassword,
  login,
  logout,
  me,
  refreshToken,
  refreshTokenMobile,
  register,
  resendActivationLink,
  resetUserPassword,
  sendResetLink,
  verify,
} from '../controllers/auth.controller.js';
import { authentication } from '../middlewares/authenticationMiddlewares.js';
import { privateCors } from '../middlewares/cors.middleware.js';
import { csrfProtection, refreshCsrf } from '../middlewares/csrf.middleware.js';
import { emailRateKey, rateLimit, tokenRateKey } from '../middlewares/rateLimit.middleware.js';
import { validationMiddleware } from '../middlewares/validationMiddleware.js';
import {
  emailParamsSchema,
  loginSchema,
  mobileRefreshSchema,
  registerSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  verifyParamsSchema,
} from '../validations/auth.validation.js';

const router = Router({ strict: true });

router.use(privateCors);

router.post(
  '/register',
  rateLimit({ name: 'register', key: emailRateKey }),
  validationMiddleware(registerSchema),
  register,
);

router.post(
  '/verify/:token',
  rateLimit({ name: 'verify', key: tokenRateKey }),
  validationMiddleware(verifyParamsSchema, (req) => req.params),
  verify,
);

router.get(
  '/new-activation-link/:email',
  rateLimit({ name: 'resend-activation', key: emailRateKey }),
  validationMiddleware(emailParamsSchema, (req) => req.params),
  resendActivationLink,
);

router.post('/login', rateLimit({ name: 'login', key: emailRateKey }), validationMiddleware(loginSchema), login);

router.post('/refresh-token', refreshCsrf, refreshToken);

router.post(
  '/refresh-token-mobile',
  validationMiddleware(mobileRefreshSchema),
  refreshTokenMobile,
);

router.post('/logout', authentication, csrfProtection, logout);

router.patch(
  '/update-password',
  authentication,
  csrfProtection,
  validationMiddleware(updatePasswordSchema),
  changePassword,
);

router.get(
  '/reset-password-link/:email',
  rateLimit({ name: 'reset-link', key: emailRateKey }),
  validationMiddleware(emailParamsSchema, (req) => req.params),
  sendResetLink,
);

router.post('/reset-password', validationMiddleware(resetPasswordSchema), resetUserPassword);

router.get('/me', authentication, me);

export default router;
