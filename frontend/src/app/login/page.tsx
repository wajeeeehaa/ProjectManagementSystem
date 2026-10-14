'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { AuthGuard } from '../../components/AuthGuard';
import { AuthShell, Field, FormMessage } from '../../components/AuthShell';
import { ApiError, apiRequest } from '../../lib/api';
import { signedIn, type AuthUser } from '../../lib/authSlice';
import { consumeAuthNotice, consumeSessionExpiredMessage } from '../../lib/session';
import type { AppDispatch } from '../../lib/store';

function LoginForm() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setNotice(consumeSessionExpiredMessage() ?? consumeAuthNotice());
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (password.trim().length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setPending(true);
    try {
      const data = await apiRequest<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        retry: false,
      });
      dispatch(signedIn(data.user));
      router.replace('/dashboard');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the server');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Log in">
      {notice ? <FormMessage tone="notice">{notice}</FormMessage> : null}
      <form onSubmit={onSubmit} aria-busy={pending} noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} errorId={error ? 'login-error' : undefined} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" value={password} onChange={setPassword} errorId={error ? 'login-error' : undefined} />
        {error ? <FormMessage id="login-error" tone="error">{error}</FormMessage> : null}
        <button type="submit" disabled={pending}>{pending ? 'Logging in…' : 'Log in'}</button>
      </form>
      <nav className="auth-links" aria-label="Account help">
        <Link href="/register">Create an account</Link>
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/resend-activation">Resend activation link</Link>
      </nav>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <AuthGuard mode="public">
      <LoginForm />
    </AuthGuard>
  );
}
