export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <div className="surface-glass p-8 md:p-12">
        <p className="mb-4 text-sm font-medium uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Fase 1 · andamiaje
        </p>
        <h1 className="mb-6 font-[family-name:var(--font-display)] text-[length:var(--text-display)] font-bold leading-[1.05] tracking-tight text-[color:var(--color-text-primary)]">
          Creed
        </h1>
        <p className="text-[length:var(--text-lg)] leading-relaxed text-[color:var(--color-text-secondary)]">
          Plataforma personal de coaching físico. Whoop + dos agentes AI coordinados — un nutricionista y un preparador físico — actuando con el rigor de un equipo profesional para un atleta de élite.
        </p>
        <div className="mt-8 flex flex-wrap gap-2 text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
          <span className="rounded-full border border-[color:var(--color-border-default)] px-3 py-1">
            Next.js 15
          </span>
          <span className="rounded-full border border-[color:var(--color-border-default)] px-3 py-1">
            Supabase
          </span>
          <span className="rounded-full border border-[color:var(--color-border-default)] px-3 py-1">
            Claude + Groq
          </span>
          <span className="rounded-full border border-[color:var(--color-border-default)] px-3 py-1">
            Tailwind v4
          </span>
        </div>
      </div>
    </main>
  );
}
