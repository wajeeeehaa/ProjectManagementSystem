'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AuthGuard } from '../../components/AuthGuard';
import { AuthShell, FormMessage } from '../../components/AuthShell';
import { ApiError, apiRequest } from '../../lib/api';

function VerifyForm() {
  const token = useSearchParams().get('token')?.trim() ?? '';
  const [error, setError] = useState<string | null>(
    token ? null : 'This activation link is missing a token',
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onVerify() {
    if (pending) return;
    setError(null);
    if (!token) {
      setError('This activation link is missing a token');
      return;
    }
    setPending(true);
    try {
      await apiRequest(`/api/auth/verify/${encodeURIComponent(token)}`, {
        method: 'POST',
        retry: false,
      });
      setSuccess('Email verified. You can log in.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the server');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Verify email">
      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      {success ? <FormMessage tone="success">{success}</FormMessage> : null}
      <button type="button" onClick={onVerify} disabled={pending || !token}>
        {pending ? 'Verifying…' : 'Verify email'}
      </button>
      <p className="auth-links">
        <Link href="/login">Log in</Link>
        <Link href="/resend-activation">Resend activation link</Link>
      </p>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <AuthGuard mode="any">
      <Suspense fallback={<p className="status-line">Loading…</p>}>
        <VerifyForm />
      </Suspense>
    </AuthGuard>
  );
}
