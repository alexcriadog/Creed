'use client';
import { SubmitButton } from '@/components/submit-button';
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
      <SubmitButton variant="danger" size="sm" pendingLabel="Borrando…">
        Borrar mi cuenta
      </SubmitButton>
    </form>
  );
}
