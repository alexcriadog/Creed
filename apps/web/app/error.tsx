'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="surface-glass p-6 sm:p-8">
        <div
          aria-hidden
          className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)]"
          style={{
            background: 'color-mix(in oklch, var(--color-status-red) 14%, transparent)',
            color: 'var(--color-status-red)',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          </svg>
        </div>
        <h1 className="mb-2 text-verdict text-[color:var(--color-text-primary)]">
          Algo falló.
        </h1>
        <p className="mb-1 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          {error.message || 'Error inesperado del servidor.'}
        </p>
        {error.digest && (
          <p className="mb-6 font-mono text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
            ID: {error.digest}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="btn-feedback inline-flex items-center justify-center rounded-[var(--radius-md)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)]"
            style={{
              background:
                'linear-gradient(135deg, oklch(58% 0.21 260), oklch(50% 0.22 260))',
              boxShadow:
                'inset 0 1px 0 oklch(100% 0 0 / 0.25), 0 4px 12px oklch(20% 0.05 260 / 0.25)',
            }}
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="btn-feedback rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-4 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
