import { CreedLogo } from '@/components/creed-logo';
import { SubmitButton } from '@/components/submit-button';
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="mb-6 flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-gradient-to-br from-[oklch(18%_0.04_260)] to-[oklch(10%_0.05_260)] shadow-[inset_0_1px_0_oklch(100%_0_0/0.15),0_8px_24px_oklch(20%_0.05_260/0.3)]">
          <CreedLogo size={40} />
        </span>
        <span className="font-[family-name:var(--font-display)] text-[length:var(--text-xl)] font-bold tracking-tight text-[color:var(--color-text-primary)]">
          creed
        </span>
      </div>

      <div className="surface-glass p-6 sm:p-8">
        <h1 className="mb-1 text-verdict text-[color:var(--color-text-primary)]">
          Entrar.
        </h1>
        <p className="text-label mb-6">EMAIL Y CONTRASEÑA</p>

        {errorMsg && (
          <div
            role="alert"
            className="mb-4 rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] bg-[color:var(--color-status-red)]/10 px-4 py-3 text-[length:var(--text-sm)] text-[color:var(--color-status-red)]"
          >
            {errorMsg}
          </div>
        )}

        <form action={signInWithPassword} className="space-y-3">
          <input
            name="email"
            type="email"
            required
            placeholder="tu@email.com"
            autoComplete="email"
            inputMode="email"
            className="input-glass"
          />
          <input
            name="password"
            type="password"
            required
            placeholder="contraseña"
            autoComplete="current-password"
            className="input-glass"
          />
          <SubmitButton fullWidth pendingLabel="Entrando…">Entrar</SubmitButton>
        </form>

        <details className="mt-5 text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
          <summary className="cursor-pointer">¿Sin contraseña? Magic link por email</summary>
          <form action={sendOtp} className="mt-3 space-y-2">
            <input
              name="email"
              type="email"
              required
              placeholder="tu@email.com"
              autoComplete="email"
              inputMode="email"
              className="input-glass"
            />
            <SubmitButton variant="secondary" fullWidth size="sm" pendingLabel="Enviando…">
              Enviar magic link
            </SubmitButton>
          </form>
        </details>
      </div>
    </main>
  );
}
