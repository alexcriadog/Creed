import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from './actions';
import { DeleteAccountButton } from './delete-button';
import { setLocale } from '@/lib/actions/locale';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { SubmitButton } from '@/components/submit-button';

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
    <>
      <main className="mx-auto max-w-md px-4 pb-32 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <h1 className="mb-6 text-verdict text-[color:var(--color-text-primary)]">
          Perfil
        </h1>

        <Section label="CUENTA">
          <Row label="Nombre" value={profile?.display_name} />
          <Row label="Email" value={user.email} />
          <Row label="Rol" value={profile?.role} />
          <Row label="Timezone" value={profile?.timezone} />
        </Section>

        <Section label="DATOS FÍSICOS">
          <Row label="Sexo" value={profile?.sex} />
          <Row label="Nacimiento" value={profile?.date_of_birth} />
          <Row label="Altura" value={profile?.height_cm ? `${profile.height_cm} cm` : null} />
        </Section>

        <Section label="OBJETIVO">
          <Row label="Foco" value={folder?.primary_objective} />
          <Row
            label="Peso baseline"
            value={folder?.baseline_weight_kg ? `${folder.baseline_weight_kg} kg` : null}
          />
          <Row
            label="Peso objetivo"
            value={folder?.target_weight_kg ? `${folder.target_weight_kg} kg` : null}
          />
          <Row label="Fecha objetivo" value={folder?.target_date} />
        </Section>

        <Section label="PREFERENCIAS">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
              Idioma del coach
            </span>
            <div className="flex gap-2">
              <LocaleButton locale="es" current={profile?.locale ?? 'es'} label="ES" />
              <LocaleButton locale="en" current={profile?.locale ?? 'es'} label="EN" />
            </div>
          </div>
          <p className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
            La UI seguirá en español hasta que activemos i18n completo.
          </p>
        </Section>

        <Section label="SESIÓN">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form action={signOut}>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Cerrando…">
                Cerrar sesión
              </SubmitButton>
            </form>
            <DeleteAccountButton />
          </div>
        </Section>

        <p className="mb-4 text-center text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          Onboarding · {profile?.onboarding_status ?? '—'}
        </p>
      </main>
      <BottomNav />
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-glass mb-4 p-5">
      <h2 className="text-label mb-3">{label}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[color:var(--color-border-subtle)] pb-2 text-[length:var(--text-sm)] last:border-0 last:pb-0">
      <dt className="text-[color:var(--color-text-muted)]">{label}</dt>
      <dd className="font-medium tabular-nums text-[color:var(--color-text-primary)]">
        {value || '—'}
      </dd>
    </div>
  );
}

function LocaleButton({
  locale,
  current,
  label,
}: {
  locale: 'es' | 'en';
  current: string;
  label: string;
}) {
  const active = current === locale;
  return (
    <form action={setLocale}>
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton
        variant={active ? 'primary' : 'secondary'}
        size="sm"
        className="!rounded-[var(--radius-pill)] !px-3 !py-1 font-mono"
        aria-pressed={active}
      >
        {label}
      </SubmitButton>
    </form>
  );
}
