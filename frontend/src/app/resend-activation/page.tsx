'use client';

import { AuthGuard } from '../../components/AuthGuard';
import { EmailRequestForm } from '../../components/EmailRequestForm';

export default function ResendActivationPage() {
  return (
    <AuthGuard mode="public">
      <EmailRequestForm
        title="Resend activation link"
        pathFor={(email) => `/api/auth/new-activation-link/${encodeURIComponent(email)}`}
        successMessage="Activation link sent. Check your email."
        pendingLabel="Sending…"
        submitLabel="Send activation link"
      />
    </AuthGuard>
  );
}
