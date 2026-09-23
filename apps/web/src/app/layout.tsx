import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/lib/auth';

import './globals.css';

export const metadata: Metadata = { title: 'Clinical AI Platform', description: 'AI-assisted clinical documentation and patient communication', manifest: '/manifest.json' };
export const viewport: Viewport = { themeColor: '#0F6FDE', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
