import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  children: ReactNode;
}) {
  return (
    <button className={`ui-button ui-button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
