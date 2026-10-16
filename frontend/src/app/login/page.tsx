'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { AuthGuard } from '../../components/AuthGuard';
import { ApiError, apiRequest } from '../../lib/api';
import { WORKSPACE_RESUME_PATH } from '../../lib/authRedirect';
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
  const [status, setStatus] = useState('Verifying email and password…');

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

    setStatus('Verifying email and password…');
    setPending(true);
    try {
      const data = await apiRequest<{ user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        retry: false,
      });
      setStatus('Opening your workspace…');
      dispatch(signedIn(data.user));
      router.replace(WORKSPACE_RESUME_PATH);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the server');
      setPending(false);
    }
  }

  return (
    <main className="sign-in-page">
      <section className="sign-in-card">
        <header className="sign-in-header">
          <h1>Sign in</h1>
          <p>Access your business dashboard</p>
        </header>
        <form className="sign-in-form" onSubmit={onSubmit} aria-busy={pending} noValidate>
          {notice ? <p className="sign-in-notice" role="status">{notice}</p> : null}
          <div className="sign-in-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              disabled={pending}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="sign-in-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              disabled={pending}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error ? <p id="login-error" className="sign-in-error" role="alert">{error}</p> : null}
          <button className="sign-in-button" type="submit" disabled={pending}>
            {pending ? (
              <>
                <span className="sign-in-spinner" aria-hidden="true" />
                <span className="sign-in-status">{status}</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
        <p className="auth-switch">Don&apos;t have an account? <Link href="/register">Register Now</Link></p>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <AuthGuard mode="public">
      <LoginForm />
    </AuthGuard>
  );
}
