import Link from 'next/link';
import { verifyOtp } from './actions';

const ERRORS: Record<string, string> = {
  invalid_code: 'Código incorrecto o caducado.',
  missing_email: 'Falta el email. Vuelve a empezar.',
  unexpected: 'Algo no fue bien. Inténtalo de nuevo.',
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email, error } = await searchParams;
  const errorMsg = error ? ERRORS[error] ?? 'Algo no fue bien.' : null;

  if (!email) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <div className="surface-glass p-8">
          <p className="mb-4 text-[length:var(--text-base)] text-[color:var(--color-text-primary)]">
            Falta el email.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-4 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-primary)] transition hover:bg-[color:var(--color-surface-raised)]"
          >
            Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="surface-glass p-8">
        <h1 className="mb-2 font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold text-[color:var(--color-text-primary)]">
          Código enviado
        </h1>
        <p className="mb-6 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          Revisa <strong className="text-[color:var(--color-text-primary)]">{email}</strong>. El
          código caduca en 1 hora.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] bg-[color:var(--color-status-red)]/10 px-4 py-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]"
          >
            {errorMsg}
          </div>
        )}

        <form action={verifyOtp} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <input
            name="code"
            type="text"
            required
            inputMode="numeric"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            placeholder="123456"
            autoComplete="one-time-code"
            className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-transparent px-4 py-3 text-center font-mono text-[length:var(--text-2xl)] tracking-[0.5em] tabular-nums text-[color:var(--color-text-primary)] outline-none transition focus:border-[color:var(--color-accent)]"
          />
          <button
            type="submit"
            className="w-full rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-4 py-3 font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)]"
          >
            Verificar
          </button>
        </form>

        <Link
          href="/login"
          className="mt-4 block text-center text-[length:var(--text-sm)] text-[color:var(--color-text-muted)] underline-offset-2 hover:underline"
        >
          Cambiar email
        </Link>
      </div>
    </main>
  );
}
