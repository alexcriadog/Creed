import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreedLogo } from '@/components/creed-logo';

export const dynamic = 'force-dynamic';

const NAV: Array<{ href: string; label: string }> = [
  { href: '/admin', label: 'Resumen' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/models', label: 'Modelos' },
  { href: '/admin/conversations', label: 'Conversaciones' },
  { href: '/admin/prompts', label: 'Prompts' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') redirect('/');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[oklch(18%_0.04_260)] to-[oklch(10%_0.05_260)] shadow-[inset_0_1px_0_oklch(100%_0_0/0.15),0_4px_12px_oklch(20%_0.05_260/0.3)]">
            <CreedLogo size={26} />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-bold tracking-tight text-[color:var(--color-text-primary)]">
              creed
            </span>
            <span className="text-label">
              ADMIN · {profile?.display_name?.toUpperCase() ?? 'STAFF'}
            </span>
          </div>
        </div>
        <Link
          href="/"
          className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
        >
          ← Salir del panel
        </Link>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-border-subtle)] bg-[color:var(--color-surface-raised)] px-4 py-1.5 font-mono text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
