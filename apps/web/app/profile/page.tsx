import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from './actions';
import { DeleteAccountButton } from './delete-button';
import { setLocale } from '@/lib/actions/locale';
import { AppHeader } from '@/components/app-header';
import { BottomNav } from '@/components/bottom-nav';
import { SubmitButton } from '@/components/submit-button';
import { WeeklySummaryCard } from '@/components/weekly-summary-card';

function initialsOf(name?: string | null, email?: string | null): string {
  const src = (name && name.trim().length > 0 ? name : email) ?? '?';
  const parts = src.trim().split(/[\s.@]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase().slice(0, 2);
}

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profile }, { data: folder }, { data: whoop }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('athlete_folder').select('*').eq('user_id', user.id).single(),
    supabase
      .from('whoop_connections')
      .select('status, last_synced_at')
      .eq('user_id', user.id)
      .maybeSingle(),
  ]);

  const initials = initialsOf(profile?.display_name, user.email);

  return (
    <>
      <main className="mx-auto max-w-md px-4 pb-32 pt-6 sm:max-w-lg sm:px-6 sm:pt-10">
        <AppHeader />

        <section className="surface-glass mb-4 flex items-center gap-4 px-5 py-5">
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-semibold text-[color:var(--color-text-on-accent)]"
            style={{
              background:
                'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
              boxShadow:
                'inset 0 1px 0 oklch(100% 0 0 / 0.3), 0 4px 10px oklch(20% 0.05 260 / 0.18)',
            }}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-semibold text-[color:var(--color-text-primary)]">
              {profile?.display_name ?? 'Sin nombre'}
            </h1>
            <p className="truncate text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
              {user.email}
            </p>
            {profile?.role === 'admin' && (
              <span className="mt-1 inline-block rounded bg-[color:var(--color-accent)]/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-[color:var(--color-accent)]">
                Admin
              </span>
            )}
          </div>
        </section>

        <WeeklySummaryCard />

        <Section label="DATOS FÍSICOS">
          <Row label="Sexo" value={profile?.sex} />
          <Row label="Nacimiento" value={profile?.date_of_birth} />
          <Row
            label="Altura"
            value={profile?.height_cm ? `${profile.height_cm} cm` : null}
          />
          <Row label="Timezone" value={profile?.timezone} />
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

        <NavCard
          href="/ia"
          icon="💬"
          title="Mis coaches"
          subtitle="Habla con la nutricionista y el preparador"
        />

        <NavCard
          href="/datos"
          icon="📊"
          title="Estadísticas detalladas"
          subtitle="Gráficos Whoop, histórico de medidas y comidas"
        />

        <Section label="WHOOP">
          {whoop ? (
            <>
              <Row label="Estado" value={whoop.status} />
              <Row
                label="Último sync"
                value={
                  whoop.last_synced_at
                    ? new Date(whoop.last_synced_at).toLocaleString('es-ES')
                    : 'Nunca'
                }
              />
              <form action="/api/whoop/disconnect" method="post" className="mt-3">
                <SubmitButton variant="secondary" size="sm" pendingLabel="Desconectando…">
                  Desconectar Whoop
                </SubmitButton>
              </form>
            </>
          ) : (
            <a
              href="/api/whoop/authorize"
              className="tap-feedback inline-block rounded-[var(--radius-md)] px-4 py-1.5 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)]"
              style={{
                background:
                  'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
                boxShadow:
                  'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 2px 6px oklch(20% 0.05 260 / 0.18)',
              }}
            >
              Conectar Whoop →
            </a>
          )}
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

        <section className="surface-glass mb-4 flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <form action={signOut}>
            <SubmitButton variant="secondary" size="sm" pendingLabel="Cerrando…">
              Cerrar sesión
            </SubmitButton>
          </form>
          <DeleteAccountButton />
        </section>

        <p className="mb-4 text-center text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          Onboarding · {profile?.onboarding_status ?? '—'}
        </p>
      </main>
      <BottomNav />
    </>
  );
}

function NavCard({
  href,
  icon,
  title,
  subtitle,
}: {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="tap-feedback surface-glass mb-3 flex items-center gap-4 px-5 py-4"
    >
      <span aria-hidden className="text-[length:var(--text-xl)]">
        {icon}
      </span>
      <div className="flex-1">
        <div className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-semibold text-[color:var(--color-text-primary)]">
          {title}
        </div>
        <div className="text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          {subtitle}
        </div>
      </div>
      <span className="text-[color:var(--color-text-muted)]" aria-hidden>
        ›
      </span>
    </Link>
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
