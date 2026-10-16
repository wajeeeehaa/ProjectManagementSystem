import type { ReactNode } from 'react';
import { Inter, Playfair_Display } from 'next/font/google';
import { Providers } from '../lib/Providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-playfair',
});

export const metadata = {
  title: 'Project Management System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
