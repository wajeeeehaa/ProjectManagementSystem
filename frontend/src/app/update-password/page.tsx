'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
import { AuthGuard } from '../../components/AuthGuard';
import { AuthShell, Field, FormMessage } from '../../components/AuthShell';
import { ApiError, apiRequest } from '../../lib/api';
import { signedOut } from '../../lib/authSlice';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../lib/passwordPolicy';
import { storeAuthNotice } from '../../lib/session';
import type { AppDispatch } from '../../lib/store';

function UpdatePasswordForm() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const [oldPassword, setOldPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (oldPassword.trim().length < 8) {
      setError('Password must be at least 8 characters');
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
      await apiRequest('/api/auth/update-password', {
        method: 'PATCH',
        body: JSON.stringify({ oldPassword, newPassword: password }),
        redirectOnUnauthorized: true,
      });
      storeAuthNotice('Password updated. Log in with your new password.');
      dispatch(signedOut());
      router.replace('/login');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the server');
      setPending(false);
    }
  }

  return (
    <AuthShell title="Change password">
      <form onSubmit={onSubmit} aria-busy={pending} noValidate>
        <Field id="oldPassword" label="Current password" type="password" autoComplete="current-password" value={oldPassword} onChange={setOldPassword} errorId={error ? 'update-error' : undefined} />
        <Field id="password" label="New password" type="password" autoComplete="new-password" value={password} onChange={setPassword} errorId={error ? 'update-error' : undefined} />
        <Field id="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} errorId={error ? 'update-error' : undefined} />
        {error ? <FormMessage id="update-error" tone="error">{error}</FormMessage> : null}
        <button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Update password'}</button>
      </form>
      <p className="auth-links"><Link href="/dashboard">Back to dashboard</Link></p>
    </AuthShell>
  );
}

export default function UpdatePasswordPage() {
  return (
    <AuthGuard mode="private">
      <UpdatePasswordForm />
    </AuthGuard>
  );
}
