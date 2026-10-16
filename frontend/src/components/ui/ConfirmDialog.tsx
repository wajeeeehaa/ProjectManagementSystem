'use client';

import { ArrowRightLeft, Trash2, UserMinus, type LucideIcon } from 'lucide-react';
import { Button } from './Button';

const icons: Record<'delete' | 'remove' | 'transfer', LucideIcon> = {
  delete: Trash2,
  remove: UserMinus,
  transfer: ArrowRightLeft,
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  intent,
  pending = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  intent: 'delete' | 'remove' | 'transfer';
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const Icon = icons[intent];
  const danger = intent !== 'transfer';

  return (
    <div className="modal-overlay confirm-overlay" role="presentation">
      <section className={`modal-panel confirm-panel${danger ? ' confirm-danger' : ''}`} role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className={`confirm-mark${danger ? ' confirm-mark-danger' : ''}`} aria-hidden="true">
          <Icon size={28} strokeWidth={2.25} />
        </div>
        <header>
          <h2 id="confirm-title">{title}</h2>
        </header>
        <p>{message}</p>
        <footer>
          <Button variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} type="button" disabled={pending} onClick={onConfirm}>
            <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
            {confirmLabel}
          </Button>
        </footer>
      </section>
    </div>
  );
}
