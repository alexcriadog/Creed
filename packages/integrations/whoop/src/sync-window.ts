/** Ventana temporal de una sync de Whoop. */

/** Whoop se fundó en 2012; la API v2 no expone nada anterior a esto en la práctica. */
export const FULL_HISTORY_SINCE = '2015-01-01T00:00:00.000Z';
const DEFAULT_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

export interface SyncWindowOptions {
  /** ISO 8601. Manda sobre `full`. */
  since?: string;
  /** ISO 8601. Default: now. */
  until?: string;
  /** Trae todo el historial (primera sync). */
  full?: boolean;
}

export function resolveSyncWindow(opts: SyncWindowOptions, now: Date): { since: string; until: string } {
  const since = opts.since ?? (opts.full ? FULL_HISTORY_SINCE : new Date(now.getTime() - DEFAULT_LOOKBACK_MS).toISOString());
  const until = opts.until ?? now.toISOString();
  return { since, until };
}
