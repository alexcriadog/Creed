/**
 * Pantalla de consentimiento OAuth 2.1 (Supabase Auth como servidor OAuth).
 * Supabase redirige aquí con ?authorization_id=… cuando un cliente MCP
 * (claude.ai) pide acceso. El usuario ya autenticado aprueba o deniega en
 * /api/oauth/decision.
 */
import { redirect } from 'next/navigation';
import { CreedLogo } from '@/components/creed-logo';
import { SubmitButton } from '@/components/submit-button';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withNext } from '@/lib/auth/safe-next';

const SCOPE_LABELS: Record<string, string> = {
  openid: 'Identificarte',
  email: 'Ver tu email',
  profile: 'Ver tu perfil básico',
  phone: 'Ver tu teléfono',
};

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const { authorization_id: authorizationId } = await searchParams;

  if (!authorizationId) {
    return (
      <Shell>
        <p className="text-[length:var(--text-base)] text-[color:var(--color-text-primary)]">
          Falta el identificador de autorización. Vuelve a conectar desde la aplicación.
        </p>
      </Shell>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(withNext('/login', `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`));
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details) {
    return (
      <Shell>
        <p className="text-[length:var(--text-base)] text-[color:var(--color-status-red)]">
          Solicitud de autorización inválida o caducada{error ? ` (${error.message})` : ''}.
        </p>
      </Shell>
    );
  }

  // Consentimiento ya concedido antes a este cliente: Supabase devuelve directamente el redirect.
  if (!('authorization_id' in details)) {
    redirect((details as { redirect_url: string }).redirect_url);
  }

  const scopes = (details.scope ?? '').split(' ').filter(Boolean);

  return (
    <Shell>
      <h1 className="mb-1 text-verdict text-[color:var(--color-text-primary)]">
        Autorizar {details.client.name}
      </h1>
      <p className="text-label mb-6">ACCESO A TUS DATOS DE CREED</p>

      <p className="mb-4 text-[length:var(--text-base)] text-[color:var(--color-text-secondary)]">
        <strong className="text-[color:var(--color-text-primary)]">{details.client.name}</strong> podrá leer y
        escribir tus datos en Creed como <strong className="text-[color:var(--color-text-primary)]">{user.email}</strong>:
        Whoop, entrenos, comidas, medidas corporales y documentos.
      </p>

      {scopes.length > 0 && (
        <ul className="mb-6 space-y-1 text-[length:var(--text-sm)] text-[color:var(--color-text-muted)]">
          {scopes.map((s) => (
            <li key={s}>• {SCOPE_LABELS[s] ?? s}</li>
          ))}
        </ul>
      )}

      <p className="mb-6 truncate text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
        Volverás a: {details.redirect_uri}
      </p>

      <form action="/api/oauth/decision" method="POST" className="flex gap-3">
        <input type="hidden" name="authorization_id" value={authorizationId} />
        <SubmitButton name="decision" value="deny" variant="secondary" fullWidth pendingLabel="…">
          Denegar
        </SubmitButton>
        <SubmitButton name="decision" value="approve" fullWidth pendingLabel="Autorizando…">
          Autorizar
        </SubmitButton>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
      <div className="surface-glass p-6 sm:p-8">{children}</div>
    </main>
  );
}
