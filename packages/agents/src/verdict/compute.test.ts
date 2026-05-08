import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOALS,
  computeStatus,
  computeVerdict,
  ema7,
  mealsAdherence,
  moodAverage,
  recoveryAvg,
  trainingAdherence,
  weightTrend,
} from './compute';
import type { VerdictGoals, VerdictInput } from './types';

const TODAY = '2026-05-08';

function dateOffset(days: number): string {
  const d = new Date(TODAY + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const DOWN_GOAL: VerdictGoals = { ...DEFAULT_GOALS, weight_direction_target: 'down' };

describe('ema7', () => {
  it('returns null on empty array', () => {
    expect(ema7([])).toBeNull();
  });

  it('returns single value when only one entry', () => {
    expect(ema7([{ date: TODAY, weight_kg: 70 }])).toBe(70);
  });

  it('weights more recent values heavier than older', () => {
    const flat = [
      { date: dateOffset(6), weight_kg: 70 },
      { date: dateOffset(5), weight_kg: 70 },
      { date: dateOffset(4), weight_kg: 70 },
      { date: dateOffset(3), weight_kg: 70 },
      { date: dateOffset(2), weight_kg: 70 },
      { date: dateOffset(1), weight_kg: 70 },
      { date: TODAY, weight_kg: 70 },
    ];
    expect(ema7(flat)).toBe(70);

    const dropping = [
      { date: dateOffset(6), weight_kg: 75 },
      { date: TODAY, weight_kg: 70 },
    ];
    const result = ema7(dropping);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(75);
    expect(result!).toBeGreaterThan(70);
  });
});

describe('weightTrend', () => {
  it('returns unknown when no data', () => {
    expect(weightTrend([], TODAY)).toEqual({
      direction: 'unknown',
      slope_kg_per_week: null,
      ema7_kg: null,
    });
  });

  it('detects "down" trend within 14 days', () => {
    const weights = [
      { date: dateOffset(13), weight_kg: 75 },
      { date: TODAY, weight_kg: 73 },
    ];
    const result = weightTrend(weights, TODAY);
    expect(result.direction).toBe('down');
    expect(result.slope_kg_per_week).toBeLessThan(0);
    expect(result.ema7_kg).not.toBeNull();
  });

  it('detects "up" trend within 14 days', () => {
    const weights = [
      { date: dateOffset(10), weight_kg: 70 },
      { date: TODAY, weight_kg: 72 },
    ];
    expect(weightTrend(weights, TODAY).direction).toBe('up');
  });

  it('returns "flat" when slope < 0.1 kg/week', () => {
    const weights = [
      { date: dateOffset(7), weight_kg: 72.0 },
      { date: TODAY, weight_kg: 72.05 },
    ];
    expect(weightTrend(weights, TODAY).direction).toBe('flat');
  });

  it('returns "unknown" when only one entry within 14 days', () => {
    expect(weightTrend([{ date: TODAY, weight_kg: 72 }], TODAY).direction).toBe(
      'unknown',
    );
  });
});

describe('recoveryAvg', () => {
  it('returns null on no data', () => {
    expect(recoveryAvg([], TODAY)).toBeNull();
  });

  it('averages valid scores within window', () => {
    const recoveries = [
      { date: dateOffset(20), score: 50 },
      { date: dateOffset(13), score: 80 },
      { date: TODAY, score: 70 },
    ];
    expect(recoveryAvg(recoveries, TODAY, 14)).toBe(75);
  });

  it('skips null scores', () => {
    const recoveries = [
      { date: dateOffset(1), score: null },
      { date: TODAY, score: 80 },
    ];
    expect(recoveryAvg(recoveries, TODAY, 14)).toBe(80);
  });
});

describe('mealsAdherence', () => {
  it('returns 0 with no meals', () => {
    expect(mealsAdherence([], TODAY, DEFAULT_GOALS)).toBe(0);
  });

  it('returns 100 when every day hits target', () => {
    const meals = [];
    for (let d = 0; d < 7; d++) {
      for (let m = 0; m < 4; m++) {
        meals.push({ date: dateOffset(d) });
      }
    }
    expect(mealsAdherence(meals, TODAY, DEFAULT_GOALS)).toBe(100);
  });

  it('returns ~50% when half the days hit target', () => {
    const meals = [];
    for (let d = 0; d < 7; d += 2) {
      for (let m = 0; m < 4; m++) meals.push({ date: dateOffset(d) });
    }
    const result = mealsAdherence(meals, TODAY, DEFAULT_GOALS);
    expect(result).toBeGreaterThanOrEqual(40);
    expect(result).toBeLessThanOrEqual(60);
  });
});

describe('trainingAdherence', () => {
  it('returns 0 with no trainings', () => {
    expect(trainingAdherence([], TODAY, DEFAULT_GOALS)).toBe(0);
  });

  it('counts done and partial, ignores skipped/scheduled', () => {
    const trainings = [
      { date: dateOffset(1), status: 'done' },
      { date: dateOffset(2), status: 'partial' },
      { date: dateOffset(3), status: 'skipped' },
      { date: dateOffset(4), status: 'scheduled' },
    ];
    expect(trainingAdherence(trainings, TODAY, DEFAULT_GOALS)).toBe(50);
  });

  it('clamps to 100 even if exceeds target', () => {
    const trainings = Array.from({ length: 10 }, (_, i) => ({
      date: dateOffset(i),
      status: 'done',
    }));
    expect(trainingAdherence(trainings, TODAY, DEFAULT_GOALS)).toBe(100);
  });

  it('ignores trainings older than 7 days', () => {
    const trainings = [{ date: dateOffset(10), status: 'done' }];
    expect(trainingAdherence(trainings, TODAY, DEFAULT_GOALS)).toBe(0);
  });
});

describe('moodAverage', () => {
  it('returns null if all moods are null', () => {
    expect(moodAverage([{ mood: null, energy: null }])).toBeNull();
  });

  it('averages valid moods', () => {
    expect(
      moodAverage([
        { mood: 4, energy: 3 },
        { mood: 5, energy: 4 },
      ]),
    ).toBe(4.5);
  });
});

describe('computeStatus', () => {
  const baseComponents = {
    weight_trend: { direction: 'flat' as const, slope_kg_per_week: 0, ema7_kg: 70 },
    recovery_avg_14d: 60,
    adherence_meals_pct: 50,
    adherence_training_pct: 50,
    mood_avg: 3,
  };

  it('returns amber by default with mid signals', () => {
    expect(
      computeStatus({ components: baseComponents, goals: DEFAULT_GOALS }).status,
    ).toBe('amber');
  });

  it('returns green with high signals', () => {
    const result = computeStatus({
      components: {
        ...baseComponents,
        adherence_meals_pct: 90,
        adherence_training_pct: 100,
        recovery_avg_14d: 80,
        mood_avg: 5,
      },
      goals: DEFAULT_GOALS,
    });
    expect(result.status).toBe('green');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('returns red with low signals', () => {
    expect(
      computeStatus({
        components: {
          ...baseComponents,
          adherence_meals_pct: 20,
          adherence_training_pct: 20,
          recovery_avg_14d: 40,
        },
        goals: DEFAULT_GOALS,
      }).status,
    ).toBe('red');
  });

  it('rewards weight trend aligned with goal', () => {
    const aligned = computeStatus({
      components: {
        ...baseComponents,
        weight_trend: { direction: 'down', slope_kg_per_week: -0.3, ema7_kg: 72 },
        adherence_meals_pct: 75,
      },
      goals: DOWN_GOAL,
    });
    expect(aligned.status).toBe('green');
  });

  it('penalizes weight trend opposite to goal', () => {
    const opposed = computeStatus({
      components: {
        ...baseComponents,
        weight_trend: { direction: 'up', slope_kg_per_week: 0.3, ema7_kg: 72 },
        adherence_meals_pct: 30,
      },
      goals: DOWN_GOAL,
    });
    expect(opposed.status).toBe('red');
  });
});

describe('computeVerdict (integration)', () => {
  it('returns deterministic result with rich input', () => {
    const input: VerdictInput = {
      today: TODAY,
      weights: [
        { date: dateOffset(13), weight_kg: 75 },
        { date: dateOffset(7), weight_kg: 74 },
        { date: TODAY, weight_kg: 73 },
      ],
      recoveries: Array.from({ length: 14 }, (_, i) => ({
        date: dateOffset(i),
        score: 75 + i,
      })),
      meals: Array.from({ length: 28 }, (_, i) => ({
        date: dateOffset(Math.floor(i / 4)),
      })),
      trainings: [
        { date: dateOffset(1), status: 'done' },
        { date: dateOffset(3), status: 'done' },
        { date: dateOffset(5), status: 'partial' },
      ],
      moods: [
        { mood: 4, energy: 3 },
        { mood: 5, energy: 4 },
      ],
      goals: DOWN_GOAL,
    };
    const result = computeVerdict(input);
    expect(result.status).toBe('green');
    expect(result.components.weight_trend.direction).toBe('down');
    expect(result.components.adherence_meals_pct).toBe(100);
    expect(result.components.recovery_avg_14d).not.toBeNull();
    expect(result.text).toContain('Vas bien');
  });

  it('handles empty input gracefully', () => {
    const result = computeVerdict({
      today: TODAY,
      weights: [],
      recoveries: [],
      meals: [],
      trainings: [],
      moods: [],
      goals: DEFAULT_GOALS,
    });
    expect(result.status).toBe('red');
    expect(result.components.recovery_avg_14d).toBeNull();
    expect(result.components.weight_trend.direction).toBe('unknown');
  });
});
