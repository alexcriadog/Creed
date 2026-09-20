import { describe, it, expect, vi, afterEach } from 'vitest';
import { WhoopClient } from './client';

afterEach(() => vi.restoreAllMocks());

function client() {
  return new WhoopClient({
    accessToken: 'tok', refreshToken: 'ref', expiresAt: new Date(Date.now() + 3_600_000),
    clientId: 'cid', clientSecret: 'sec', onTokensRefreshed: async () => {},
  });
}

describe('WhoopClient rutas v2', () => {
  it('getBodyMeasurement llama a /developer/v2/user/measurement/body', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ height_meter: 1.8, weight_kilogram: 78.4, max_heart_rate: 195 }), { status: 200 }),
    );
    const body = await client().getBodyMeasurement();
    expect(body).toEqual({ height_meter: 1.8, weight_kilogram: 78.4, max_heart_rate: 195 });
    expect(String(spy.mock.calls[0]![0])).toBe('https://api.prod.whoop.com/developer/v2/user/measurement/body');
  });

  it('listCycles usa el mismo prefijo', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ records: [] }), { status: 200 }));
    await client().listCycles({ limit: 1 });
    expect(String(spy.mock.calls[0]![0])).toMatch(/^https:\/\/api\.prod\.whoop\.com\/developer\/v2\/cycle\?/);
  });
});
