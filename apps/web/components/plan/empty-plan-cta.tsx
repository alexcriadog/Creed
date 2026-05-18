import Link from 'next/link';

const PREFILL =
  'Quiero que me montes el plan de entrenamiento. Empieza con la entrevista y al final propónmelo.';

export function EmptyPlanCTA() {
  const href = `/ia?role=training&mode=onboarding&prefill=${encodeURIComponent(PREFILL)}`;
  return (
    <section className="surface-glass mb-4 px-5 py-6 text-center">
      <div className="mb-3 text-[length:var(--text-3xl)]" aria-hidden>
        💪
      </div>
      <h2 className="mb-2 font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-semibold text-[color:var(--color-text-primary)]">
        Tu plan aún no existe
      </h2>
      <p className="mb-5 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
        Habla con tu coach para que te haga unas preguntas y monte un programa
        de al menos 4 semanas a tu medida.
      </p>
      <Link
        href={href}
        className="tap-feedback inline-flex items-center gap-2 rounded-[var(--radius-md)] px-5 py-2.5 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)]"
        style={{
          background:
            'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
          boxShadow:
            'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 2px 6px oklch(20% 0.05 260 / 0.18)',
        }}
      >
        <span aria-hidden>💬</span> Hablar con el coach
      </Link>
    </section>
  );
}
