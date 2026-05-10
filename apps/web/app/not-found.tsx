import Link from 'next/link';
import { CreedLogo } from '@/components/creed-logo';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="mb-6 flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-gradient-to-br from-[oklch(18%_0.04_260)] to-[oklch(10%_0.05_260)] shadow-[inset_0_1px_0_oklch(100%_0_0/0.15),0_8px_24px_oklch(20%_0.05_260/0.3)]">
          <CreedLogo size={40} />
        </span>
      </div>
      <div className="surface-glass p-6 text-center sm:p-8">
        <p className="text-label mb-2">404</p>
        <h1 className="mb-3 text-verdict text-[color:var(--color-text-primary)]">
          Página no encontrada.
        </h1>
        <p className="mb-6 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          La ruta que buscas no existe o se movió.
        </p>
        <Link
          href="/"
          className="btn-feedback inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)]"
          style={{
            background:
              'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
            boxShadow:
              'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 4px 12px oklch(20% 0.05 260 / 0.25)',
          }}
        >
          Volver al inicio →
        </Link>
      </div>
    </main>
  );
}
