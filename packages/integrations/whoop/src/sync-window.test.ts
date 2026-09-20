import { describe, it, expect } from 'vitest';
import { resolveSyncWindow, FULL_HISTORY_SINCE } from './sync-window';

const now = new Date('2026-09-20T10:00:00Z');

describe('resolveSyncWindow', () => {
  it('por defecto: 90 días atrás hasta ahora', () => {
    expect(resolveSyncWindow({}, now)).toEqual({ since: '2026-06-22T10:00:00.000Z', until: '2026-09-20T10:00:00.000Z' });
  });
  it('full → todo el historial', () => {
    expect(resolveSyncWindow({ full: true }, now).since).toBe(FULL_HISTORY_SINCE);
  });
  it('since/until explícitos mandan sobre full', () => {
    expect(resolveSyncWindow({ full: true, since: '2026-09-01T00:00:00.000Z', until: '2026-09-02T00:00:00.000Z' }, now)).toEqual({
      since: '2026-09-01T00:00:00.000Z',
      until: '2026-09-02T00:00:00.000Z',
    });
  });
});
