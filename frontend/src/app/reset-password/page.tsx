'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGuard } from '../../components/AuthGuard';
import { AuthShell, Field, FormMessage } from '../../components/AuthShell';
import { ApiError, apiRequest } from '../../lib/api';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../lib/passwordPolicy';
import { storeAuthNotice } from '../../lib/session';

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get('token')?.trim() ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(token ? null : 'This reset link is missing a token');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (!token) {
      setError('This reset link is missing a token');
      return;
    }
    if (!isStrongPassword(password.trim())) {
      setError(PASSWORD_RULE_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setPending(true);
    try {
      const message = await apiRequest<null>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
        retry: false,
      });
      void message;
      storeAuthNotice('Password updated. Log in with your new password.');
      router.replace('/login');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the server');
      setPending(false);
    }
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} aria-busy={pending} noValidate>
        <Field id="password" label="New password" type="password" autoComplete="new-password" value={password} onChange={setPassword} errorId={error ? 'reset-error' : undefined} />
        <Field id="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} errorId={error ? 'reset-error' : undefined} />
        {error ? <FormMessage id="reset-error" tone="error">{error}</FormMessage> : null}
        <button type="submit" disabled={pending || !token}>{pending ? 'Saving…' : 'Update password'}</button>
      </form>
      <p className="auth-links"><Link href="/login">Back to login</Link></p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthGuard mode="any">
      <Suspense fallback={<p className="status-line">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </AuthGuard>
  );
}
