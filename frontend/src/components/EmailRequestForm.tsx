'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AuthShell, Field, FormMessage } from './AuthShell';
import { ApiError, apiRequest } from '../lib/api';

export function EmailRequestForm({
  title,
  pathFor,
  successMessage,
  pendingLabel,
  submitLabel,
}: {
  title: string;
  pathFor: (email: string) => string;
  successMessage: string;
  pendingLabel: string;
  submitLabel: string;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      await apiRequest(pathFor(email.trim()), { retry: false });
      setSuccess(successMessage);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the server');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title={title}>
      <form onSubmit={onSubmit} aria-busy={pending} noValidate>
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          errorId={error ? 'email-request-error' : undefined}
        />
        {error ? (
          <FormMessage id="email-request-error" tone="error">
            {error}
          </FormMessage>
        ) : null}
        {success ? <FormMessage tone="success">{success}</FormMessage> : null}
        <button type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
      </form>
      <p className="auth-links">
        <Link href="/login">Back to login</Link>
      </p>
    </AuthShell>
  );
}
