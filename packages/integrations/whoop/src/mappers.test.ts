import { describe, it, expect } from 'vitest';
import { bodyMeasurementToRow, bodyMeasurementChanged } from './mappers';

describe('bodyMeasurementToRow', () => {
  it('mapea altura/peso/FC máx y conserva raw', () => {
    const raw = { height_meter: 1.8, weight_kilogram: 78.4, max_heart_rate: 195 };
    expect(bodyMeasurementToRow('u1', raw)).toEqual({
      user_id: 'u1',
      height_m: 1.8,
      weight_kg: 78.4,
      max_hr: 195,
      raw,
    });
  });
});

describe('bodyMeasurementChanged', () => {
  const row = { height_m: 1.8, weight_kg: 78.4, max_hr: 195 };
  it('true si no hay fila previa', () => {
    expect(bodyMeasurementChanged(null, row)).toBe(true);
  });
  it('false si todo coincide (numéricos de Postgres pueden venir como string)', () => {
    expect(bodyMeasurementChanged({ height_m: '1.80', weight_kg: '78.40', max_hr: 195 }, row)).toBe(false);
  });
  it('true si cambia el peso', () => {
    expect(bodyMeasurementChanged({ height_m: 1.8, weight_kg: 78.9, max_hr: 195 }, row)).toBe(true);
  });
});
