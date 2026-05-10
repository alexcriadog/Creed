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
    <section>
      <h2 className="text-label mb-3">PÍDELE AL COACH</h2>
      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={`/chat?role=${a.role}&prefill=${encodeURIComponent(a.prefill)}`}
            className="metric-card tap-feedback group flex flex-col items-start gap-2 hover:border-[color:var(--color-accent)]"
          >
            <span
              className={`agent-chip ${
                a.role === 'training' ? 'agent-chip-coach' : 'agent-chip-nutrition'
              }`}
              aria-hidden
            >
              {a.role === 'training' ? 'C' : 'N'}
            </span>
            <span className="text-[length:var(--text-sm)] font-semibold leading-tight text-[color:var(--color-text-primary)]">
              {a.label}
            </span>
            <span className="text-label">
              {a.role === 'training' ? 'COACH' : 'NUTRI'}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
