import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

const baseField =
  'w-full rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] bg-[color:var(--color-surface-raised)] px-3 py-2 text-[length:var(--text-base)] text-[color:var(--color-text-primary)] outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/30';

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-secondary)]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[length:var(--text-xs)] text-[color:var(--color-text-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseField} ${props.className ?? ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${baseField} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${baseField} ${props.className ?? ''}`} />;
}

export function PrimaryButton({
  children,
  ...rest
}: InputHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; type?: 'submit' | 'button' }) {
  return (
    <button
      {...rest}
      className={`rounded-[var(--radius-md)] bg-[color:var(--color-accent)] px-4 py-2 text-[length:var(--text-sm)] font-medium text-[color:var(--color-text-on-accent)] transition hover:bg-[color:var(--color-accent-strong)] disabled:opacity-50 ${rest.className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  ...rest
}: InputHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; type?: 'submit' | 'button' }) {
  return (
    <button
      {...rest}
      className={`rounded-[var(--radius-md)] border border-[color:var(--color-border-default)] px-4 py-2 text-[length:var(--text-sm)] text-[color:var(--color-text-secondary)] transition hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)] ${rest.className ?? ''}`}
    >
      {children}
    </button>
  );
}
