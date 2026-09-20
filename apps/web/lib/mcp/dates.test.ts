import { describe, it, expect } from 'vitest';
import { todayMadrid, dayRangeMadrid, startOfDayMadrid, addDays, assertDateRange } from './dates';

describe('dates (Europe/Madrid)', () => {
  it('todayMadrid usa la zona de Madrid, no UTC', () => {
    // 2026-07-01T22:30Z = 2026-07-02 00:30 en Madrid (CEST, UTC+2)
    expect(todayMadrid(new Date('2026-07-01T22:30:00Z'))).toBe('2026-07-02');
    // 2026-01-15T23:30Z = 2026-01-16 00:30 en Madrid (CET, UTC+1)
    expect(todayMadrid(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16');
    expect(todayMadrid(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15');
  });

  it('startOfDayMadrid devuelve el instante UTC de las 00:00 locales', () => {
    expect(startOfDayMadrid('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(startOfDayMadrid('2026-07-15').toISOString()).toBe('2026-07-14T22:00:00.000Z');
  });

  it('dayRangeMadrid cubre el día completo, incluido el cambio de hora', () => {
    expect(dayRangeMadrid('2026-01-15')).toEqual({
      from: '2026-01-14T23:00:00.000Z',
      to: '2026-01-15T23:00:00.000Z',
    });
    // 29 de marzo de 2026: entra el horario de verano → el día dura 23 h
    expect(dayRangeMadrid('2026-03-29')).toEqual({
      from: '2026-03-28T23:00:00.000Z',
      to: '2026-03-29T22:00:00.000Z',
    });
  });

  it('addDays opera en calendario', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('assertDateRange rechaza rangos invertidos o demasiado largos', () => {
    expect(() => assertDateRange('2026-01-10', '2026-01-01', 90)).toThrow(/anterior/);
    expect(() => assertDateRange('2026-01-01', '2026-06-01', 90)).toThrow(/90/);
    expect(() => assertDateRange('2026-01-01', '2026-01-31', 90)).not.toThrow();
  });
});
