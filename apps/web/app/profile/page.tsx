import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from './actions';
import { DeleteAccountButton } from './delete-button';

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: folder } = await supabase
    .from('athlete_folder')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="surface-glass p-8 md:p-10">
        <Link
          href="/"
          className="mb-4 inline-block text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
        >
          ← Inicio
        </Link>
        <h1 className="mb-6 font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold text-[color:var(--color-text-primary)]">
          Perfil
        </h1>

        <dl className="space-y-3 text-[length:var(--text-sm)]">
          <Row label="Nombre" value={profile?.display_name} />
          <Row label="Email" value={user.email} />
          <Row label="Rol" value={profile?.role} />
          <Row label="Locale" value={profile?.locale} />
          <Row label="Timezone" value={profile?.timezone} />
          <Row label="Sexo" value={profile?.sex} />
          <Row label="Fecha de nacimiento" value={profile?.date_of_birth} />
          <Row label="Altura (cm)" value={profile?.height_cm?.toString()} />
          <Row label="Objetivo" value={folder?.primary_objective} />
          <Row label="Peso baseline (kg)" value={folder?.baseline_weight_kg?.toString()} />
          <Row label="Peso objetivo (kg)" value={folder?.target_weight_kg?.toString()} />
          <Row label="Fecha objetivo" value={folder?.target_date} />
          <Row label="Onboarding" value={profile?.onboarding_status} />
        </dl>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-4 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-primary)] transition hover:bg-[color:var(--color-bg-surface-raised)]"
            >
              Cerrar sesión
            </button>
          </form>

          <DeleteAccountButton />
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[color:var(--color-border-default)] pb-2 last:border-0">
      <dt className="text-[color:var(--color-text-muted)]">{label}</dt>
      <dd className="text-[color:var(--color-text-primary)]">{value || '—'}</dd>
    </div>
  );
}
