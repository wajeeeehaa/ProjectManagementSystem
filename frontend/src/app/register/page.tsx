'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '../../components/AuthGuard';
import { AuthShell, Field, FormMessage } from '../../components/AuthShell';
import { ApiError, apiRequest } from '../../lib/api';
import { isStrongPassword, PASSWORD_RULE_MESSAGE } from '../../lib/passwordPolicy';

function RegisterForm() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSuccess(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Enter your first and last name');
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
      await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, firstName, lastName }),
        retry: false,
      });
      setSuccess('Account created. Check your email for the activation link.');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to reach the server');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell title="Create account">
      <form onSubmit={onSubmit} aria-busy={pending} noValidate>
        <Field id="firstName" label="First name" type="text" autoComplete="given-name" value={firstName} onChange={setFirstName} errorId={error ? 'register-error' : undefined} />
        <Field id="lastName" label="Last name" type="text" autoComplete="family-name" value={lastName} onChange={setLastName} errorId={error ? 'register-error' : undefined} />
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={setEmail} errorId={error ? 'register-error' : undefined} />
        <Field id="password" label="Password" type="password" autoComplete="new-password" value={password} onChange={setPassword} errorId={error ? 'register-error' : undefined} />
        <Field id="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} errorId={error ? 'register-error' : undefined} />
        {error ? <FormMessage id="register-error" tone="error">{error}</FormMessage> : null}
        {success ? <FormMessage tone="success">{success}</FormMessage> : null}
        <button type="submit" disabled={pending}>{pending ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <AuthGuard mode="public">
      <RegisterForm />
    </AuthGuard>
  );
}
