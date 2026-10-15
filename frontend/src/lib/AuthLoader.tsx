'use client';

import { useEffect, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ApiError, apiRequest } from './api';
import { signedIn, signedOut, type AuthUser } from './authSlice';
import { getCsrfToken } from './csrf';
import { storeSessionExpiredMessage } from './session';
import type { AppDispatch, RootState } from './store';

export function AuthLoader({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const authReady = useSelector((state: RootState) => state.auth.authReady);

  useEffect(() => {
    let cancelled = false;
    const hadCsrf = Boolean(getCsrfToken());

    apiRequest<AuthUser>('/api/auth/me', { redirectOnUnauthorized: false })
      .then((user) => {
        if (!cancelled) dispatch(signedIn(user));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (hadCsrf && error instanceof ApiError && error.statusCode === 401) {
          storeSessionExpiredMessage();
        }
        dispatch(signedOut());
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  if (!authReady) {
    return (
      <div className="session-screen" role="status" aria-live="polite">
        <span className="session-spinner" aria-label="Loading your session" />
      </div>
    );
  }

  return children;
}
