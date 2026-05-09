import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
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
    { media: '(prefers-color-scheme: light)', color: '#dbe7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#0a1124' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('theme')?.value;
  const theme =
    themeCookie === 'light' || themeCookie === 'dark' ? themeCookie : 'auto';

  return (
    <html lang="es" data-theme={theme} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
