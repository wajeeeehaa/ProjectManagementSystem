'use client';

import { useEffect, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { restoreFinished } from './authSlice';
import type { AppDispatch, RootState } from './store';

export function AuthLoader({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const authReady = useSelector((state: RootState) => state.auth.authReady);

  useEffect(() => {
    dispatch(restoreFinished());
  }, [dispatch]);

  if (!authReady) {
    return null;
  }

  return children;
}
