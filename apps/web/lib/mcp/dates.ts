/**
 * Fechas en la zona del atleta (Europe/Madrid). Las tools reciben días
 * `YYYY-MM-DD` y consultan instantes UTC en Postgres.
 */
import { McpError } from './types';

export const TZ = 'Europe/Madrid';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(date: string): [number, number, number] {
  if (!ISO_DAY.test(date)) throw new McpError('invalid_date', `Fecha inválida "${date}" (usa YYYY-MM-DD).`);
  const [y = 0, m = 0, d = 0] = date.split('-').map(Number);
  return [y, m, d];
}

/** Día local (YYYY-MM-DD) de un instante. */
export function todayMadrid(now: Date): string {
  return dayFormatter.format(now);
}

/** Minutos que Madrid va por delante de UTC en ese instante (60 en CET, 120 en CEST). */
function madridOffsetMinutes(utc: Date): number {
  const p = partsFormatter.formatToParts(utc).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  const num = (k: string) => Number(p[k] ?? 0);
  const asIfUtc = Date.UTC(num('year'), num('month') - 1, num('day'), num('hour'), num('minute'), num('second'));
  return Math.round((asIfUtc - utc.getTime()) / 60_000);
}

/** Instante UTC de las 00:00 de `date` en Madrid. */
export function startOfDayMadrid(date: string): Date {
  const [y, m, d] = parseDay(date);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offset = madridOffsetMinutes(guess);
  const local = new Date(guess.getTime() - offset * 60_000);
  // Si el offset cambia justo en ese instante (día de cambio de hora), recalcula.
  const offset2 = madridOffsetMinutes(local);
  return offset2 === offset ? local : new Date(guess.getTime() - offset2 * 60_000);
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDay(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Rango semiabierto [from, to) en ISO que cubre el día local completo. */
export function dayRangeMadrid(date: string): { from: string; to: string } {
  return {
    from: startOfDayMadrid(date).toISOString(),
    to: startOfDayMadrid(addDays(date, 1)).toISOString(),
  };
}

export function assertDateRange(from: string, to: string, maxDays: number): void {
  parseDay(from);
  parseDay(to);
  if (to < from) throw new McpError('invalid_range', 'La fecha final es anterior a la inicial.');
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days > maxDays) throw new McpError('range_too_long', `El rango máximo es de ${maxDays} días.`);
}
