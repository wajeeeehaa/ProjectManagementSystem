import type { ReactNode } from 'react';

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Project Management</p>
        <h1>{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function Field({
  id,
  label,
  type,
  autoComplete,
  value,
  onChange,
  errorId,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  errorId?: string;
}) {
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        aria-invalid={Boolean(errorId)}
        aria-describedby={errorId}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}

export function FormMessage({
  id,
  tone,
  children,
}: {
  id?: string;
  tone: 'error' | 'success' | 'notice';
  children: ReactNode;
}) {
  return (
    <p id={id} className={`form-message ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
