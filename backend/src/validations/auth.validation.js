import { z } from 'zod';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../utils/password.helper.js';

const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address')
  .transform((value) => value.toLowerCase());

const strongPasswordSchema = z.string().trim().refine(isStrongPassword, {
  message: PASSWORD_RULE_MESSAGE,
});

export const registerSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().trim().min(8, 'Password must be at least 8 characters'),
});

export const verifyParamsSchema = z.object({
  token: z.string().trim().min(1, 'Activation token is required'),
});

export const emailParamsSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z.object({
  oldPassword: z.string().trim().min(8, 'Password must be at least 8 characters'),
  newPassword: strongPasswordSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  newPassword: strongPasswordSchema,
});

export const mobileRefreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required'),
});
