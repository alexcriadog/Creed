import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ModelsForm } from './models-form';

export const dynamic = 'force-dynamic';

export interface ModelAssignment {
  flow: string;
  model: string;
  updated_at: string;
}

export interface CostLimit {
  service: string;
  monthly_cap_eur: number;
  alarm_threshold_pct: number;
  pause_at_cap: boolean;
}

const FLOW_LABEL: Record<string, string> = {
  nutritionist_chat: 'Chat nutricionista',
  trainer_chat: 'Chat preparador',
  orchestrator: 'Orquestador',
  onboarding: 'Onboarding',
  lapse_recovery: 'Modo lapso',
  weekly_close: 'Cierre semanal',
  weekly_plan: 'Plan semanal',
  meal_parser: 'Parser comidas',
  conversation_compactor: 'Compactador conversación',
};

export default async function AdminModelsPage() {
  const supabase = await createSupabaseServerClient();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [assignments, limits, tokensByModel] = await Promise.all([
    supabase
      .from('model_assignments')
      .select('flow, model, updated_at')
      .order('flow', { ascending: true }),
    supabase
      .from('cost_limits')
      .select('service, monthly_cap_eur, alarm_threshold_pct, pause_at_cap')
      .order('service', { ascending: true }),
    supabase
      .from('messages')
      .select('model, input_tokens, output_tokens')
      .gte('created_at', startOfMonth.toISOString())
      .eq('role', 'assistant'),
  ]);

  const usage = new Map<
    string,
    { input: number; output: number; messages: number }
  >();
  for (const m of tokensByModel.data ?? []) {
    if (!m.model) continue;
    const cur = usage.get(m.model) ?? { input: 0, output: 0, messages: 0 };
    cur.input += m.input_tokens ?? 0;
    cur.output += m.output_tokens ?? 0;
    cur.messages += 1;
    usage.set(m.model, cur);
  }

  return (
    <div className="space-y-8">
      <ModelsForm
        assignments={(assignments.data ?? []) as ModelAssignment[]}
        limits={(limits.data ?? []) as CostLimit[]}
        flowLabels={FLOW_LABEL}
      />

      <section>
        <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Uso del mes por modelo
        </h2>
        {usage.size === 0 ? (
          <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border-default)] p-4 text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
            Sin uso este mes.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[color:var(--color-border-default)]">
            <table className="w-full text-[length:var(--text-sm)]">
              <thead>
                <tr className="border-b border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] text-left text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                  <th className="px-3 py-2">Modelo</th>
                  <th className="px-3 py-2 text-right">Mensajes</th>
                  <th className="px-3 py-2 text-right">Input tokens</th>
                  <th className="px-3 py-2 text-right">Output tokens</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(usage.entries())
                  .sort((a, b) => b[1].input + b[1].output - (a[1].input + a[1].output))
                  .map(([model, u]) => (
                    <tr
                      key={model}
                      className="border-b border-[color:var(--color-border-default)] last:border-0"
                    >
                      <td className="px-3 py-2 font-mono text-[length:var(--text-xs)]">
                        {model}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{u.messages}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {u.input.toLocaleString('es-ES')}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {u.output.toLocaleString('es-ES')}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
