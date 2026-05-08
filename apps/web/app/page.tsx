import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, onboarding_status')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_status !== 'complete') redirect('/onboarding');

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="surface-glass p-8 md:p-12">
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Fase 2 · auth + perfil
        </p>
        <h1 className="mb-6 font-[family-name:var(--font-display)] text-[length:var(--text-display)] font-bold leading-[1.05] tracking-tight text-[color:var(--color-text-primary)]">
          Hola, {profile?.display_name ?? 'atleta'}.
        </h1>
        <p className="mb-8 text-[length:var(--text-lg)] leading-relaxed text-[color:var(--color-text-secondary)]">
          El dashboard llega en fase 3 (datos de Whoop) y fase 4 (registro manual).
          De momento solo está activa la auth.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/profile"
            className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-4 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-primary)] transition hover:bg-[color:var(--color-bg-surface-raised)]"
          >
            Ver perfil
          </Link>
        </div>
      </div>
    </main>
  );
}
