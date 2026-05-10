import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CreedLogo } from '@/components/creed-logo';
import { SubmitButton } from '@/components/submit-button';
import { saveTrainingOnboarding } from '@/lib/actions/onboarding-coach';

export const dynamic = 'force-dynamic';

const EQUIPMENT = [
  { value: 'barbell', label: 'Barra olímpica' },
  { value: 'dumbbells', label: 'Mancuernas' },
  { value: 'rack', label: 'Rack / jaula' },
  { value: 'bench', label: 'Banco' },
  { value: 'cable_machine', label: 'Poleas' },
  { value: 'machines', label: 'Máquinas guiadas' },
  { value: 'pullup_bar', label: 'Barra de dominadas' },
  { value: 'kettlebells', label: 'Kettlebells' },
  { value: 'bands', label: 'Gomas' },
  { value: 'cardio_machines', label: 'Cardio máquinas' },
];

const INJURIES = [
  { value: 'lower_back', label: 'Zona lumbar' },
  { value: 'shoulder', label: 'Hombro' },
  { value: 'knee', label: 'Rodilla' },
  { value: 'wrist', label: 'Muñeca' },
  { value: 'elbow', label: 'Codo' },
  { value: 'hip', label: 'Cadera' },
  { value: 'neck', label: 'Cuello' },
  { value: 'ankle', label: 'Tobillo' },
];

const BLOCKED = [
  { value: 'overhead_press', label: 'Press militar' },
  { value: 'deadlift_heavy', label: 'Peso muerto pesado' },
  { value: 'back_squat', label: 'Sentadilla con barra trasera' },
  { value: 'jumping', label: 'Saltos / pliometría' },
  { value: 'running_high_impact', label: 'Correr alta intensidad' },
];

export default async function TrainingOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await searchParams;
  const errorMsg = error ? decodeURIComponent(error) : null;

  return (
    <main className="mx-auto max-w-md px-4 py-10 sm:max-w-lg sm:px-6">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-[oklch(18%_0.04_260)] to-[oklch(10%_0.05_260)] shadow-[inset_0_1px_0_oklch(100%_0_0/0.15),0_4px_12px_oklch(20%_0.05_260/0.3)]">
          <CreedLogo size={26} />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-[family-name:var(--font-display)] text-[length:var(--text-base)] font-bold tracking-tight text-[color:var(--color-text-primary)]">
            creed
          </span>
          <span className="text-label">PASO 3 · DE 3 · ENTRENAMIENTO</span>
        </div>
      </header>

      <div className="surface-glass p-6 sm:p-8">
        <h1 className="mb-2 text-verdict text-[color:var(--color-text-primary)]">
          Entreno.
        </h1>
        <p className="mb-6 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          5 minutos. El coach usa esto para programar tus sesiones desde el primer día.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] bg-[color:var(--color-status-red)]/10 px-4 py-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]"
          >
            {errorMsg}
          </div>
        )}

        <form action={saveTrainingOnboarding} className="space-y-6">
          <Section title="Años entrenando con consistencia">
            <input
              name="years_training"
              type="number"
              min="0"
              max="60"
              required
              defaultValue="0"
              className="w-24 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-mono tabular-nums"
            />
          </Section>

          <Section title="Días por semana que puedes entrenar">
            <input
              name="days_per_week"
              type="number"
              min="0"
              max="7"
              required
              defaultValue="3"
              className="w-24 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 font-mono tabular-nums"
            />
          </Section>

          <Section title="¿Dónde entrenas?">
            <RadioGroup
              name="location"
              required
              options={[
                { value: 'gym_commercial', label: 'Gym comercial' },
                { value: 'gym_specialized', label: 'Box / gym especializado' },
                { value: 'home_full', label: 'Home gym completo' },
                { value: 'home_basic', label: 'Home básico' },
                { value: 'outdoor', label: 'Aire libre' },
                { value: 'mixed', label: 'Mixto' },
              ]}
            />
          </Section>

          <Section title="Equipamiento al que tienes acceso">
            <CheckboxGrid name="equipment" options={EQUIPMENT} />
          </Section>

          <Section title="Objetivo principal">
            <RadioGroup
              name="primary_goal"
              required
              options={[
                { value: 'strength', label: 'Fuerza' },
                { value: 'hypertrophy', label: 'Hipertrofia' },
                { value: 'endurance', label: 'Resistencia' },
                { value: 'general_health', label: 'Salud general' },
                { value: 'sport_specific', label: 'Específico deporte' },
              ]}
            />
          </Section>

          <Section title="Lesiones / molestias actuales">
            <CheckboxGrid name="injuries" options={INJURIES} />
          </Section>

          <Section title="Movimientos que NO puedes hacer">
            <CheckboxGrid name="blocked_movements" options={BLOCKED} />
          </Section>

          <Section title="Cardio actual">
            <label className="text-[length:var(--text-sm)]">
              Minutos por semana (aprox)
              <input
                name="cardio_minutes_week"
                type="number"
                min="0"
                max="2000"
                placeholder="60"
                className="ml-2 w-24 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-2 py-1 font-mono tabular-nums"
              />
            </label>
          </Section>

          <Section title="Nivel autopercibido">
            <RadioGroup
              name="self_level"
              required
              options={[
                { value: 'beginner', label: 'Principiante' },
                { value: 'intermediate', label: 'Intermedio' },
                { value: 'advanced', label: 'Avanzado' },
              ]}
            />
          </Section>

          <Section title="Algo más que el preparador deba saber">
            <textarea
              name="free_notes"
              rows={4}
              maxLength={2000}
              placeholder="Texto libre. Lesiones específicas, ejercicios favoritos, RPE habitual, contexto…"
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-accent)]"
            />
          </Section>

          <div className="flex justify-between gap-2 border-t border-[color:var(--color-border-default)] pt-4">
            <Link
              href="/onboarding/nutrition"
              className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
            >
              ← Anterior
            </Link>
            <SubmitButton pendingLabel="Guardando…">Terminar onboarding →</SubmitButton>
          </div>
        </form>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-[length:var(--text-sm)] font-semibold text-[color:var(--color-text-secondary)]">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function RadioGroup({
  name,
  options,
  required,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 text-[length:var(--text-sm)] transition hover:border-[color:var(--color-accent)] has-[:checked]:border-[color:var(--color-accent)] has-[:checked]:bg-[color:var(--color-accent)] has-[:checked]:text-[color:var(--color-text-on-accent)]"
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            required={required}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}

function CheckboxGrid({
  name,
  options,
}: {
  name: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 text-[length:var(--text-sm)] transition hover:border-[color:var(--color-accent)] has-[:checked]:border-[color:var(--color-accent)] has-[:checked]:bg-[color:var(--color-accent)] has-[:checked]:text-[color:var(--color-text-on-accent)]"
        >
          <input type="checkbox" name={name} value={o.value} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}
