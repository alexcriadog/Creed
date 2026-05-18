'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet } from '@/components/sheet';
import { PrimaryButton, SecondaryButton } from '@/components/form-controls';

// Botón global de sync Whoop colocado en el AppHeader.
// - Click → modal de confirmación con una línea sobre lo que hace.
// - Confirm → fetch con redirect:'manual' para ignorar la 3xx del endpoint y
//   no navegar a /datos.
// - Mientras `isPending`: el modal queda cerrado y el botón muestra spinner.
// - Tras la respuesta, router.refresh() re-renderiza el server component
//   actual con los datos actualizados.
export function WhoopSyncButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function openConfirm() {
    if (isPending) return;
    setConfirmOpen(true);
  }

  function confirm() {
    setConfirmOpen(false);
    startTransition(async () => {
      try {
        await fetch('/api/whoop/sync', {
          method: 'POST',
          redirect: 'manual',
        });
      } catch (err) {
        console.warn('[whoop-sync]', err);
      }
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        disabled={isPending}
        aria-busy={isPending}
        aria-label="Sincronizar Whoop"
        title="Sincronizar Whoop"
        className="icon-chip btn-feedback disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? <SmallSpinner /> : <RefreshIcon />}
      </button>
      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Sincronizar con Whoop"
      >
        <p className="mb-4 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)]">
          Vamos a pedirle a Whoop tus últimos entrenos, recovery y sleep desde
          el último sync. Tarda unos segundos.
        </p>
        <div className="flex justify-end gap-2">
          <SecondaryButton type="button" onClick={() => setConfirmOpen(false)}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton type="button" onClick={confirm}>
            Sincronizar
          </PrimaryButton>
        </div>
      </Sheet>
    </>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

function SmallSpinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden
      className="animate-spin"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
    </svg>
  );
}
