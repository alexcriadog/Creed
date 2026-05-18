'use client';

import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// Modal con backdrop por capas — backdrop z-30, contenido z-50.
// La bottom nav vive en z-40 → queda entre los dos, visible y accesible
// incluso con el modal abierto. Backdrop translúcido (no oscurece tanto).
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 z-30 backdrop-blur-[2px]"
        style={{ background: 'oklch(20% 0.02 260 / 0.28)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--radius-lg)] border border-[color:var(--color-border-default)] shadow-[var(--shadow-lg)] backdrop-blur-xl"
        style={{ background: 'var(--color-canvas-tint)' }}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--color-border-default)] px-5 py-3">
          <h2
            id="sheet-title"
            className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-semibold text-[color:var(--color-text-primary)]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded p-1 text-[color:var(--color-text-muted)] transition hover:text-[color:var(--color-text-primary)]"
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </>
  );
}
