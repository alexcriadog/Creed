import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { saveOnboarding } from './actions';

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, sex, date_of_birth, height_cm, onboarding_status')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_status === 'complete') {
    redirect('/');
  }

  const { data: folder } = await supabase
    .from('athlete_folder')
    .select('primary_objective, baseline_weight_kg, target_weight_kg, target_date')
    .eq('user_id', user.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="surface-glass p-8 md:p-12">
        <p className="mb-2 text-sm font-medium uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Onboarding · fase 2 (formulario simple)
        </p>
        <h1 className="mb-3 font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold text-[color:var(--color-text-primary)]">
          Cuéntame sobre ti
        </h1>
        <p className="mb-8 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          En fase 5, esto será una entrevista con tu coach. De momento es un formulario.
          Puedes editar todo después en Perfil.
        </p>

        <form action={saveOnboarding} className="space-y-6">
          <Field label="Cómo prefieres que te llamen">
            <input
              name="display_name"
              type="text"
              required
              defaultValue={profile?.display_name ?? ''}
              maxLength={50}
              className="input-glass"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Sexo">
              <select name="sex" required defaultValue={profile?.sex ?? ''} className="input-glass">
                <option value="" disabled>—</option>
                <option value="male">Hombre</option>
                <option value="female">Mujer</option>
                <option value="other">Otro</option>
              </select>
            </Field>
            <Field label="Fecha de nacimiento">
              <input
                name="date_of_birth"
                type="date"
                required
                defaultValue={profile?.date_of_birth ?? ''}
                className="input-glass"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Altura (cm)">
              <input
                name="height_cm"
                type="number"
                required
                step="0.1"
                min="100"
                max="230"
                defaultValue={profile?.height_cm ?? ''}
                className="input-glass tabular-nums"
              />
            </Field>
            <Field label="Peso actual (kg)">
              <input
                name="baseline_weight_kg"
                type="number"
                required
                step="0.1"
                min="30"
                max="250"
                defaultValue={folder?.baseline_weight_kg ?? ''}
                className="input-glass tabular-nums"
              />
            </Field>
          </div>

          <Field label="Objetivo principal">
            <select
              name="primary_objective"
              required
              defaultValue={folder?.primary_objective ?? ''}
              className="input-glass"
            >
              <option value="" disabled>—</option>
              <option value="lose_fat">Perder grasa</option>
              <option value="build_muscle">Ganar músculo</option>
              <option value="build_strength">Ganar fuerza</option>
              <option value="recomp">Recomposición</option>
              <option value="maintain">Mantener</option>
            </select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Peso objetivo (kg) — opcional">
              <input
                name="target_weight_kg"
                type="number"
                step="0.1"
                min="30"
                max="250"
                defaultValue={folder?.target_weight_kg ?? ''}
                className="input-glass tabular-nums"
              />
            </Field>
            <Field label="Fecha objetivo — opcional">
              <input
                name="target_date"
                type="date"
                defaultValue={folder?.target_date ?? ''}
                className="input-glass"
              />
            </Field>
          </div>

          <button
            type="submit"
            className="w-full rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-6 py-3 font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)]"
          >
            Guardar y continuar
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}
