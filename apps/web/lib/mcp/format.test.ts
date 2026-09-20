import { describe, it, expect } from 'vitest';
import { e1rm, tonnage, round1 } from './format';

describe('format', () => {
  it('e1rm usa Epley con 1 decimal y devuelve el peso para 1 rep', () => {
    expect(e1rm(100, 5)).toBe(116.7);
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(82.5, 8)).toBe(104.5);
  });

  it('tonnage ignora series sin peso o sin reps', () => {
    expect(
      tonnage([
        { weight_kg: 100, reps: 5 },
        { weight_kg: null, reps: 5 },
        { weight_kg: 50, reps: null },
        { weight_kg: 20, reps: 0 },
      ]),
    ).toBe(500);
  });

  it('round1', () => {
    expect(round1(1.26)).toBe(1.3);
    expect(round1(2)).toBe(2);
  });
});
