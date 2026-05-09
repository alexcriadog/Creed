import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { saveNutritionOnboarding } from '@/lib/actions/onboarding-coach';

export const dynamic = 'force-dynamic';

const RESTRICTIONS = [
  { value: 'vegetarian', label: 'Vegetariano' },
  { value: 'vegan', label: 'Vegano' },
  { value: 'pescetarian', label: 'Pescetariano' },
  { value: 'gluten_free', label: 'Sin gluten' },
  { value: 'lactose_free', label: 'Sin lactosa' },
  { value: 'no_pork', label: 'Sin cerdo' },
  { value: 'low_carb', label: 'Bajo en carbohidratos' },
  { value: 'no_red_meat', label: 'Sin carne roja' },
];

const SUPPLEMENTS = [
  { value: 'protein', label: 'Proteína en polvo' },
  { value: 'creatine', label: 'Creatina' },
  { value: 'omega3', label: 'Omega-3' },
  { value: 'multivitamin', label: 'Multivitamínico' },
  { value: 'vitamin_d', label: 'Vitamina D' },
  { value: 'magnesium', label: 'Magnesio' },
  { value: 'caffeine', label: 'Cafeína / pre-entreno' },
];

export default async function NutritionOnboardingPage({
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
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="surface-glass p-6 md:p-8">
        <p className="mb-1 text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Onboarding · Paso 1 de 2
        </p>
        <h1 className="mb-1 font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold text-[color:var(--color-text-primary)]">
          Cuestionario nutricional
        </h1>
        <p className="mb-6 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          5 minutos. El nutricionista usará esto para personalizar tus consejos desde el primer
          mensaje.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] bg-[color:var(--color-status-red)]/10 px-4 py-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]"
          >
            {errorMsg}
          </div>
        )}

        <form action={saveNutritionOnboarding} className="space-y-6">
          <Section title="Objetivo principal">
            <RadioGroup
              name="goal"
              required
              options={[
                { value: 'lose_fat', label: 'Perder grasa' },
                { value: 'maintain', label: 'Mantener' },
                { value: 'build_muscle', label: 'Ganar masa' },
                { value: 'recomp', label: 'Recomposición' },
                { value: 'performance', label: 'Rendimiento' },
              ]}
            />
          </Section>

          <Section title="¿Cuántas comidas haces al día normalmente?">
            <input
              name="meals_per_day"
              type="number"
              min="1"
              max="8"
              required
              defaultValue="4"
              className="w-24 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] px-3 py-2 font-mono tabular-nums text-[color:var(--color-text-primary)]"
            />
          </Section>

          <Section title="¿Cómo comes habitualmente?">
            <RadioGroup
              name="cooking_style"
              required
              options={[
                { value: 'cook_self', label: 'Cocino yo' },
                { value: 'mixed', label: 'Mixto' },
                { value: 'order_made', label: 'Comida hecha / pido' },
              ]}
            />
          </Section>

          <Section title="Hidratación habitual">
            <label className="text-[length:var(--text-sm)]">
              Agua aprox al día (litros, opcional)
              <input
                name="hydration_l"
                type="number"
                step="0.5"
                min="0"
                max="10"
                placeholder="2.5"
                className="ml-2 w-24 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] px-2 py-1 font-mono tabular-nums"
              />
            </label>
          </Section>

          <Section title="Alcohol">
            <RadioGroup
              name="alcohol"
              required
              options={[
                { value: 'never', label: 'Nunca' },
                { value: 'occasional', label: 'Ocasional' },
                { value: 'weekly', label: 'Semanal' },
                { value: 'daily', label: 'Diario' },
              ]}
            />
          </Section>

          <Section title="Restricciones / preferencias alimentarias">
            <CheckboxGrid name="restrictions" options={RESTRICTIONS} />
          </Section>

          <Section title="Suplementos que tomas">
            <CheckboxGrid name="supplements" options={SUPPLEMENTS} />
          </Section>

          <Section title="Objetivo de peso (opcional)">
            <div className="flex flex-wrap gap-3 text-[length:var(--text-sm)]">
              <label>
                Peso objetivo (kg)
                <input
                  name="target_weight_kg"
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  placeholder="70"
                  className="ml-2 w-24 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] px-2 py-1 font-mono tabular-nums"
                />
              </label>
              <label>
                Plazo (semanas)
                <input
                  name="target_weeks"
                  type="number"
                  min="1"
                  max="104"
                  placeholder="12"
                  className="ml-2 w-24 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] px-2 py-1 font-mono tabular-nums"
                />
              </label>
            </div>
          </Section>

          <Section title="Algo más que el nutricionista deba saber">
            <textarea
              name="free_notes"
              rows={4}
              maxLength={2000}
              placeholder="Texto libre. Alergias específicas, intolerancias, gustos, situaciones puntuales…"
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-base)] px-3 py-2 text-[color:var(--color-text-primary)] outline-none focus:border-[color:var(--color-accent)]"
            />
          </Section>

          <div className="flex justify-between gap-2 border-t border-[color:var(--color-border-default)] pt-4">
            <Link
              href="/"
              className="text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
            >
              ← Más tarde
            </Link>
            <button
              type="submit"
              className="rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-5 py-2 font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)]"
            >
              Continuar →
            </button>
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
