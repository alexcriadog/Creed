import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { McpContext } from './types';

const syncWhoop = vi.fn();
vi.mock('@creed/whoop', () => ({ syncWhoop: (...args: unknown[]) => syncWhoop(...args) }));

import { maybeRefreshWhoop } from './whoop-refresh';

function ctxWithConnection(conn: { status: string; last_synced_at: string | null } | null): McpContext {
  const supabase = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: conn, error: null }) }),
      }),
    }),
  } as unknown as McpContext['supabase'];
  return { supabase, userId: 'user-1', now: new Date('2026-09-20T10:00:00Z') };
}

beforeEach(() => {
  syncWhoop.mockReset();
  process.env.WHOOP_CLIENT_ID = 'cid';
  process.env.WHOOP_CLIENT_SECRET = 'sec';
});

describe('maybeRefreshWhoop', () => {
  it('sin conexión → stale, no refresca', async () => {
    expect(await maybeRefreshWhoop(ctxWithConnection(null))).toEqual({ stale: true, refreshed: false });
    expect(syncWhoop).not.toHaveBeenCalled();
  });

  it('conexión reciente (<2h) → fresco sin llamar a Whoop', async () => {
    const r = await maybeRefreshWhoop(ctxWithConnection({ status: 'connected', last_synced_at: '2026-09-20T09:00:00Z' }));
    expect(r).toEqual({ stale: false, refreshed: false });
    expect(syncWhoop).not.toHaveBeenCalled();
  });

  it('conexión vieja → sync incremental desde last_synced_at con service role', async () => {
    syncWhoop.mockResolvedValue({ cycles: 1, recovery: 1, sleep: 1, workouts: 0, errors: [] });
    const r = await maybeRefreshWhoop(ctxWithConnection({ status: 'connected', last_synced_at: '2026-09-19T20:00:00Z' }));
    expect(r).toEqual({ stale: false, refreshed: true });
    expect(syncWhoop).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', since: '2026-09-19T20:00:00.000Z', whoopClientId: 'cid', whoopClientSecret: 'sec' }),
    );
  });

  it('si Whoop falla o tarda → stale, sin lanzar', async () => {
    syncWhoop.mockRejectedValue(new Error('rate limit'));
    const r = await maybeRefreshWhoop(ctxWithConnection({ status: 'connected', last_synced_at: '2026-09-19T20:00:00Z' }));
    expect(r).toEqual({ stale: true, refreshed: false });
  });

  it('conexión revocada → stale', async () => {
    const r = await maybeRefreshWhoop(ctxWithConnection({ status: 'revoked', last_synced_at: '2026-09-20T09:00:00Z' }));
    expect(r).toEqual({ stale: true, refreshed: false });
  });
});
