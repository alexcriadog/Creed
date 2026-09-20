import { describe, it, expect } from 'vitest';
import { createTestUser } from './test-utils';

describe('createTestUser', () => {
  it('crea un usuario con sesión válida y RLS activo', async () => {
    const u = await createTestUser();
    try {
      const { data, error } = await u.supabase
        .from('profiles')
        .select('id')
        .eq('id', u.id)
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBe(u.id);
    } finally {
      await u.cleanup();
    }
  });

  it('otro usuario no ve el perfil ajeno (RLS)', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    try {
      const { data } = await b.supabase.from('profiles').select('id').eq('id', a.id);
      expect(data).toEqual([]);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });
});
