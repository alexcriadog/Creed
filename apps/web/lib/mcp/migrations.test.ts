import { describe, it, expect } from 'vitest';
import { createTestUser } from './test-utils';

describe('migraciones MCP', () => {
  it('documents: RLS self-only y búsqueda full-text en español', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    try {
      const { error: insErr } = await a.supabase.from('documents').insert({
        user_id: a.id,
        kind: 'nutri_plan',
        title: 'Pauta semana 1',
        doc_date: '2026-09-15',
        text: 'Desayuno: avena con proteína. Cena: pescado y verduras.',
      });
      expect(insErr).toBeNull();

      const { data: mine, error: searchErr } = await a.supabase
        .from('documents')
        .select('id')
        .textSearch('search', 'avena', { config: 'spanish' });
      expect(searchErr).toBeNull();
      expect(mine).toHaveLength(1);

      const { data: theirs } = await b.supabase.from('documents').select('id');
      expect(theirs).toHaveLength(0);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });

  it('sessions.source acepta text; meals tiene source/confidence', async () => {
    const a = await createTestUser();
    try {
      const { error } = await a.supabase
        .from('sessions')
        .insert({ user_id: a.id, source: 'text', status: 'completed' });
      expect(error).toBeNull();

      const { error: mErr } = await a.supabase.from('meals').insert({
        user_id: a.id,
        consumed_at: new Date().toISOString(),
        raw_text: 'x',
        source: 'claude',
        confidence: 'estimated',
      });
      expect(mErr).toBeNull();
    } finally {
      await a.cleanup();
    }
  });

  it('whoop_body_measurements: el usuario lee lo suyo y nada más', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    try {
      const { adminClient } = await import('./test-utils');
      const { error } = await adminClient().from('whoop_body_measurements').insert({
        user_id: a.id, height_m: 1.8, weight_kg: 78.4, max_hr: 195, raw: { height_meter: 1.8 },
      });
      expect(error).toBeNull();
      const { data: mine } = await a.supabase.from('whoop_body_measurements').select('weight_kg');
      expect(mine).toEqual([{ weight_kg: 78.4 }]);
      const { data: theirs } = await b.supabase.from('whoop_body_measurements').select('id');
      expect(theirs).toEqual([]);
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });
});
