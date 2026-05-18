'use client';

// ChipButton — pill horizontal con icono emoji + label inline.
// Pensado para una fila compacta de quick-add cerca de la cabecera de la
// pantalla. Sin glass wrapper, sin labels apilados.

interface ChipButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ChipButton({ icon, label, onClick, disabled }: ChipButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-feedback inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-1.5 text-[length:var(--text-xs)] font-medium text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span aria-hidden className="text-[length:var(--text-sm)] leading-none">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
