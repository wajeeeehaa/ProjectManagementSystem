'use client';

import { AuthGuard } from '../../components/AuthGuard';
import { EmailRequestForm } from '../../components/EmailRequestForm';

export default function ForgotPasswordPage() {
  return (
    <AuthGuard mode="public">
      <EmailRequestForm
        title="Reset password"
        pathFor={(email) => `/api/auth/reset-password-link/${encodeURIComponent(email)}`}
        successMessage="Reset link sent. Check your email."
        pendingLabel="Sending…"
        submitLabel="Send reset link"
      />
    </AuthGuard>
  );
}
