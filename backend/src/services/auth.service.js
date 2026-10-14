import { and, eq } from 'drizzle-orm';
import { db } from '../../db/database.js';
import { roles, users } from '../../db/schema/index.js';
import {
  ACTIVATION_TTL_SECONDS,
  DEFAULT_ROLE_TITLE,
  HTTP_STATUS,
  JWT_SECRET,
} from '../utils/constants.js';
import { digestEqual, hmacSha256, randomOtp } from '../utils/crypto.helper.js';
import { HttpError } from '../utils/httpError.js';
import { signActivationToken, verifyActivationToken, signResetToken, verifyResetToken } from '../utils/jwt.helper.js';
import { clearAuthCookies } from '../utils/cookies.js';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../utils/password.helper.js';
import { sendActivationEmail, sendPasswordChangedEmail, sendResetEmail } from './email.service.js';
import {
  blacklistAccessToken,
  createLoginSession,
  findUserByEmail,
  findUserById,
  revokeAllUserSessions,
} from './session.service.js';
import { toPublicUser } from './user.mapper.js';
import jwt from 'jsonwebtoken';

const requireDb = () => {
  if (!db) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');
  return db;
};

const normalizeEmail = (email) => email.trim().toLowerCase();

const isUniqueViolation = (error) => error?.code === '23505';

const ensureUserRole = async (executor) => {
  await executor.insert(roles).values({ title: DEFAULT_ROLE_TITLE }).onConflictDoNothing({ target: roles.title });
  const [role] = await executor
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.title, DEFAULT_ROLE_TITLE))
    .limit(1);
  if (!role) throw new HttpError(HTTP_STATUS.SERVER_ERROR, 'Something went wrong');
  return role;
};

const createActivation = (email) => {
  const otp = randomOtp();
  const token = signActivationToken({ email, otp });
  const decoded = jwt.decode(token);
  const expiresAt =
    decoded && typeof decoded === 'object' && typeof decoded.exp === 'number'
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + ACTIVATION_TTL_SECONDS * 1000);
  return {
    token,
    otpHash: hmacSha256(otp, JWT_SECRET),
    expiresAt,
  };
};

export const registerUser = async (input) => {
  const database = requireDb();
  const email = normalizeEmail(input.email);
  const existing = await findUserByEmail(database, email);
  if (existing) throw new HttpError(HTTP_STATUS.CONFLICT, 'Email is already registered');

  const passwordHash = await hashPassword(input.password);
  const activation = createActivation(email);
  let created;
  try {
    created = await database.transaction(async (tx) => {
      const role = await ensureUserRole(tx);
      const [user] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          isVerified: false,
          roleId: role.id,
          activationOtpHash: activation.otpHash,
          activationOtpExpiresAt: activation.expiresAt,
        })
        .returning({ id: users.id, email: users.email });
      return user;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(HTTP_STATUS.CONFLICT, 'Email is already registered');
    }
    throw error;
  }

  try {
    await sendActivationEmail(email, activation.token);
  } catch (error) {
    console.error('[email] activation failed');
    void error;
    await database.delete(users).where(eq(users.id, created.id));
    throw new HttpError(HTTP_STATUS.BAD_GATEWAY, 'Could not send the activation email');
  }

  return { email: created.email };
};

export const verifyEmail = async (token) => {
  const payload = verifyActivationToken(token);
  const database = requireDb();
  const user = await findUserByEmail(database, normalizeEmail(payload.email));
  if (!user) throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Invalid activation link');
  if (user.isVerified) throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Account is already verified');
  if (
    !user.activationOtpHash ||
    !user.activationOtpExpiresAt ||
    new Date(user.activationOtpExpiresAt).getTime() <= Date.now()
  ) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Activation link has expired');
  }
  if (!digestEqual(hmacSha256(payload.otp, JWT_SECRET), user.activationOtpHash)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Invalid activation link');
  }

  const updated = await database
    .update(users)
    .set({
      isVerified: true,
      activationOtpHash: null,
      activationOtpExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, user.id), eq(users.isVerified, false)))
    .returning({ id: users.id });

  if (updated.length === 0) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Account is already verified');
  }
};

export const resendActivation = async (emailInput) => {
  const email = normalizeEmail(emailInput);
  const database = requireDb();
  const user = await findUserByEmail(database, email);
  if (!user) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'User not found');
  if (user.isVerified) throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Account is already verified');

  const previous = {
    activationOtpHash: user.activationOtpHash,
    activationOtpExpiresAt: user.activationOtpExpiresAt,
  };
  const activation = createActivation(email);
  await database
    .update(users)
    .set({
      activationOtpHash: activation.otpHash,
      activationOtpExpiresAt: activation.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  try {
    await sendActivationEmail(email, activation.token);
  } catch (error) {
    console.error('[email] activation resend failed');
    void error;
    await database
      .update(users)
      .set({
        activationOtpHash: previous.activationOtpHash,
        activationOtpExpiresAt: previous.activationOtpExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    throw new HttpError(HTTP_STATUS.BAD_GATEWAY, 'Could not send the activation email');
  }
};

export const loginUser = async (input) => {
  const database = requireDb();
  const user = await findUserByEmail(database, normalizeEmail(input.email));
  const matches = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !matches) {
    throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password');
  }
  if (!user.isVerified) {
    throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Verify your email before logging in');
  }

  const session = await createLoginSession(user.id);
  return {
    user: toPublicUser(user),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    cookies: session.cookies,
  };
};

export const requestPasswordReset = async (emailInput) => {
  const email = normalizeEmail(emailInput);
  const user = await findUserByEmail(requireDb(), email);
  if (!user) throw new HttpError(HTTP_STATUS.NOT_FOUND, 'User not found');
  if (!user.isVerified) throw new HttpError(HTTP_STATUS.FORBIDDEN, 'Account is not verified');

  try {
    await sendResetEmail(email, signResetToken({ email }));
  } catch (error) {
    console.error('[email] reset link failed');
    void error;
    throw new HttpError(HTTP_STATUS.BAD_GATEWAY, 'Could not send the reset email');
  }
};

export const resetPassword = async ({ token, newPassword }) => {
  const payload = verifyResetToken(token);
  const database = requireDb();
  const user = await findUserByEmail(database, normalizeEmail(payload.email));
  if (!user || !user.isVerified) throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Invalid reset link');
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'New password must be different');
  }

  const passwordHash = await hashPassword(newPassword);
  await database.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    await revokeAllUserSessions(tx, user.id);
  });

  return {
    emailSent: await sendPasswordChangedEmail(user.email),
    cookies: clearAuthCookies(),
  };
};

export const updatePassword = async ({ userId, accessToken, oldPassword, newPassword }) => {
  const database = requireDb();
  const user = await findUserById(database, userId);
  if (!user || !user.isVerified) throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  if (!(await verifyPassword(oldPassword, user.passwordHash))) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'Old password is incorrect');
  }
  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw new HttpError(HTTP_STATUS.BAD_REQUEST, 'New password must be different');
  }

  const passwordHash = await hashPassword(newPassword);
  await database.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    await revokeAllUserSessions(tx, userId);
    await blacklistAccessToken(tx, accessToken);
  });

  return {
    emailSent: await sendPasswordChangedEmail(user.email),
    cookies: clearAuthCookies(),
  };
};

export const getCurrentUser = async (userId) => {
  const user = await findUserById(requireDb(), userId);
  if (!user || !user.isVerified) throw new HttpError(HTTP_STATUS.UNAUTHORIZED, 'Unauthorized');
  return toPublicUser(user);
};
