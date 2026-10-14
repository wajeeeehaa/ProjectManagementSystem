import { asyncHandler } from '../utils/asyncHandler.js';
import { getRefreshCredential } from '../utils/authToken.helper.js';
import { applyCookies, clearAuthCookies } from '../utils/cookies.js';
import { HTTP_STATUS } from '../utils/constants.js';
import { successResponse } from '../utils/customResponses.js';
import { HttpError } from '../utils/httpError.js';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  requestPasswordReset,
  resendActivation,
  resetPassword,
  updatePassword,
  verifyEmail,
} from '../services/auth.service.js';
import { logoutCurrentSession, rotateRefreshSession } from '../services/session.service.js';

const tokenResponse = (result) => ({
  user: result.user,
  accessToken: result.accessToken,
  refreshToken: result.refreshToken,
});

const passwordChangeMessage = (emailSent) =>
  emailSent ? 'Password updated' : 'Password updated, but the confirmation email could not be sent.';

export const register = asyncHandler(async (req, res) => {
  const data = await registerUser(res.locals.validatedInput);
  return successResponse(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Account created. Check your email for the activation link.',
    data,
  });
});

export const verify = asyncHandler(async (req, res) => {
  await verifyEmail(res.locals.validatedInput.token);
  return successResponse(res, { message: 'Email verified' });
});

export const resendActivationLink = asyncHandler(async (req, res) => {
  await resendActivation(res.locals.validatedInput.email);
  return successResponse(res, { message: 'Activation link sent' });
});

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(res.locals.validatedInput);
  applyCookies(res, result.cookies);
  return successResponse(res, { message: 'Logged in', data: tokenResponse(result) });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const credential = getRefreshCredential(req);
  if (!credential) throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  const result = await rotateRefreshSession(credential.token, {
    requireCsrf: credential.source === 'cookie',
    csrfToken: req.csrfToken,
  });
  applyCookies(res, result.cookies);
  return successResponse(res, { message: 'Token refreshed', data: tokenResponse(result) });
});

export const refreshTokenMobile = asyncHandler(async (req, res) => {
  const result = await rotateRefreshSession(res.locals.validatedInput.refreshToken, {
    requireCsrf: false,
  });
  applyCookies(res, result.cookies);
  return successResponse(res, { message: 'Token refreshed', data: tokenResponse(result) });
});

export const logout = asyncHandler(async (req, res) => {
  await logoutCurrentSession({
    accessToken: req.auth.accessToken,
    familyId: req.auth.familyId,
  });
  applyCookies(res, clearAuthCookies());
  return successResponse(res, { message: 'Logged out' });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = res.locals.validatedInput;
  const result = await updatePassword({
    userId: req.userId,
    accessToken: req.auth.accessToken,
    oldPassword,
    newPassword,
  });
  applyCookies(res, result.cookies);
  return successResponse(res, { message: passwordChangeMessage(result.emailSent) });
});

export const sendResetLink = asyncHandler(async (req, res) => {
  await requestPasswordReset(res.locals.validatedInput.email);
  return successResponse(res, { message: 'Reset link sent' });
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const result = await resetPassword(res.locals.validatedInput);
  applyCookies(res, result.cookies);
  return successResponse(res, { message: passwordChangeMessage(result.emailSent) });
});

export const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.userId);
  return successResponse(res, { data: user });
});
