import { sendOtp } from './actions';

const ERRORS: Record<string, string> = {
  invalid_email: 'Introduce un email válido.',
  send_failed: 'No pudimos enviar el código. Inténtalo de nuevo.',
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
          Recibirás un código de 6 dígitos por email. Sin contraseñas.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] bg-[color:var(--color-status-red)]/10 px-4 py-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]"
          >
            {errorMsg}
          </div>
        )}

        <form action={sendOtp} className="space-y-4">
          <input
            name="email"
            type="email"
            required
            placeholder="tu@email.com"
            autoComplete="email"
            inputMode="email"
            className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-bg-surface-raised)] px-4 py-3 text-[color:var(--color-text-primary)] outline-none transition focus:border-[color:var(--color-accent)]"
          />
          <button
            type="submit"
            className="w-full rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-4 py-3 font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)]"
          >
            Enviar código
          </button>
        </form>
      </div>
    </main>
  );
}
