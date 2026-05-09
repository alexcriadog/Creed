import { sendOtp, signInWithPassword } from './actions';

const ERRORS: Record<string, string> = {
  invalid_email: 'Introduce un email válido.',
  missing_password: 'Introduce tu contraseña.',
  invalid_credentials: 'Email o contraseña incorrectos.',
  send_failed: 'No pudimos enviar el magic link. Inténtalo de nuevo.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMsg = error ? ERRORS[error] ?? 'Algo no fue bien.' : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="surface-glass p-8">
        <h1 className="mb-2 font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold text-[color:var(--color-text-primary)]">
          Entrar a Creed
        </h1>
        <p className="mb-6 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          Email y contraseña.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] bg-[color:var(--color-status-red)]/10 px-4 py-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]"
          >
            {errorMsg}
          </div>
        )}

        <form action={signInWithPassword} className="space-y-4">
          <input
            name="email"
            type="email"
            required
            placeholder="tu@email.com"
            autoComplete="email"
            inputMode="email"
            className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-surface-raised)] px-4 py-3 text-[color:var(--color-text-primary)] outline-none transition focus:border-[color:var(--color-accent)]"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="contraseña"
            autoComplete="current-password"
            className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-surface-raised)] px-4 py-3 text-[color:var(--color-text-primary)] outline-none transition focus:border-[color:var(--color-accent)]"
          />
          <button
            type="submit"
            className="w-full rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-4 py-3 font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)]"
          >
            Entrar
          </button>
        </form>

        <details className="mt-4 text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
          <summary className="cursor-pointer">¿Sin contraseña? Magic link por email</summary>
          <form action={sendOtp} className="mt-3 space-y-2">
            <input
              name="email"
              type="email"
              required
              placeholder="tu@email.com"
              autoComplete="email"
              inputMode="email"
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-surface-raised)] px-3 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-primary)] outline-none transition focus:border-[color:var(--color-accent)]"
            />
            <button
              type="submit"
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-3 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
            >
              Enviar magic link
            </button>
          </form>
        </details>
      </div>
    </main>
  );
}
