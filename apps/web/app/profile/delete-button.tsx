'use client';
import { deleteAccount } from './actions';

export function DeleteAccountButton() {
  return (
    <form
      action={deleteAccount}
      onSubmit={(e) => {
        if (
          !confirm(
            'Esto borra tu cuenta y todos tus datos. ¿Confirmar? (irreversible)',
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className="rounded-[var(--radius-md)] border border-[color:var(--color-status-red)] bg-[color:var(--color-status-red)]/10 px-4 py-2 text-[length:var(--text-sm)] font-medium text-[color:var(--color-status-red)] transition hover:bg-[color:var(--color-status-red)]/20"
      >
        Borrar mi cuenta
      </button>
    </form>
  );
}
