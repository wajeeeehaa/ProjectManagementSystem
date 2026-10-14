import type { ReactNode } from 'react';
import { Providers } from '../lib/Providers';
import './globals.css';

export const metadata = {
  title: 'Project Management System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
