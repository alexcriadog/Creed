import Link from 'next/link';

const ACTIONS = [
  {
    role: 'training' as const,
    label: 'Plan semanal',
    icon: '◳',
    prefill:
      'Propón mi plan de entrenamientos para los próximos 7 días. Una sesión por día apto, basándote en mi onboarding (días/semana, equipamiento, lesiones) y en mi recovery reciente.',
  },
  {
    role: 'training' as const,
    label: 'Próxima sesión',
    icon: '→',
    prefill:
      'Propón mi próxima sesión teniendo en cuenta mi última sesión y mi recovery actual.',
  },
  {
    role: 'nutrition' as const,
    label: 'Targets de macros',
    icon: '⊕',
    prefill:
      'Calcula y propón mis targets diarios (calorías, proteína, carbs, grasa, agua) basándote en mi peso actual, objetivo y nivel de actividad.',
  },
  {
    role: 'nutrition' as const,
    label: 'Revisa mis comidas',
    icon: '✓',
    prefill:
      'Revisa mis últimas comidas y dime qué ajustaría para mi objetivo. Sé específico con qué añadir o quitar.',
  },
];

export function QuickCoachActions() {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-[length:var(--text-sm)] font-semibold uppercase tracking-wider text-[color:var(--color-text-muted)]">
        Pídele al coach
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={`/chat?role=${a.role}&prefill=${encodeURIComponent(a.prefill)}`}
            className="group flex flex-col items-start gap-1 rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] p-3 transition hover:border-[color:var(--color-accent)]"
          >
            <span
              className="text-[length:var(--text-lg)] text-[color:var(--color-text-muted)] group-hover:text-[color:var(--color-accent)]"
              aria-hidden
            >
              {a.icon}
            </span>
            <span className="text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-primary)]">
              {a.label}
            </span>
            <span className="text-[length:var(--text-xs)] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              {a.role === 'training' ? 'preparador' : 'nutricionista'}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
