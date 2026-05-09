import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Creed',
    template: '%s — Creed',
  },
  description:
    'Plataforma personal de coaching físico con datos de Whoop y dos agentes AI coordinados.',
  applicationName: 'Creed',
  authors: [{ name: 'Creed' }],
  robots: { index: false, follow: false },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: 'Creed',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'oklch(98% 0.005 260)' },
    { media: '(prefers-color-scheme: dark)', color: 'oklch(14% 0.005 260)' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="auto" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
