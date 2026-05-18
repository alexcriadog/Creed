// Helpers de fecha pure (sin imports server-only) reutilizables en client y
// server components.

export function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const parts = s.split('-').map(Number) as [number, number, number];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function weekStartFromParams(weekParam: string | undefined): Date {
  const parsed = weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam)
    ? new Date(weekParam + 'T00:00:00')
    : new Date();
  return mondayOf(parsed);
}
