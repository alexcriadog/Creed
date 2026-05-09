import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';

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
    <div className="mx-auto max-w-5xl px-6 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--color-border-default)] pb-4">
        <div>
          <p className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Panel admin · Creed
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-semibold text-[color:var(--color-text-primary)]">
            {profile?.display_name ?? 'admin'}
          </h1>
        </div>
        <Link
          href="/"
          className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
        >
          ← Salir del panel
        </Link>
      </header>
      <nav className="mb-6 flex flex-wrap gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <main>{children}</main>
    </div>
  );
}
