import type {
  MealEntry,
  MoodEntry,
  RecoveryEntry,
  TrainingEntry,
  VerdictComponents,
  VerdictGoals,
  VerdictInput,
  VerdictResult,
  VerdictStatus,
  WeightEntry,
  WeightTrend,
} from './types';

export const DEFAULT_GOALS: VerdictGoals = {
  meals_per_day_target: 4,
  trainings_per_week_target: 4,
  weight_direction_target: 'maintain',
};

const DAY_MS = 86_400_000;

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / DAY_MS);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * EMA-7 sobre los últimos 7 weight entries (alpha = 2/(N+1) = 0.25 para N=7).
 * Asume entries ordenadas asc por fecha. Devuelve null si está vacío.
 */
export function ema7(weights: WeightEntry[]): number | null {
  if (weights.length === 0) return null;
  const tail = weights.slice(-7);
  const alpha = 2 / (tail.length + 1);
  const first = tail[0];
  if (!first) return null;
  let ema = first.weight_kg;
  for (let i = 1; i < tail.length; i++) {
    const entry = tail[i];
    if (!entry) continue;
    ema = alpha * entry.weight_kg + (1 - alpha) * ema;
  }
  return Number(ema.toFixed(2));
}

/**
 * Tendencia de peso: pendiente kg/semana entre primer y último de los últimos 14 días.
 */
export function weightTrend(weights: WeightEntry[], today: string): WeightTrend {
  if (weights.length === 0) {
    return { direction: 'unknown', slope_kg_per_week: null, ema7_kg: null };
  }
  const ema = ema7(weights);
  const cutoff = new Date(today + 'T00:00:00Z').getTime() - 14 * DAY_MS;
  const recent = weights.filter(
    (w) => new Date(w.date + 'T00:00:00Z').getTime() >= cutoff,
  );
  if (recent.length < 2) {
    return { direction: 'unknown', slope_kg_per_week: null, ema7_kg: ema };
  }
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last) {
    return { direction: 'unknown', slope_kg_per_week: null, ema7_kg: ema };
  }
  const days = Math.max(1, daysBetween(first.date, last.date));
  const slope = ((last.weight_kg - first.weight_kg) / days) * 7;
  const rounded = Number(slope.toFixed(2));
  let direction: WeightTrend['direction'];
  if (Math.abs(rounded) < 0.1) direction = 'flat';
  else direction = rounded > 0 ? 'up' : 'down';
  return { direction, slope_kg_per_week: rounded, ema7_kg: ema };
}

/**
 * Recovery medio de los últimos N días. Ignora null scores.
 */
export function recoveryAvg(
  recoveries: RecoveryEntry[],
  today: string,
  days = 14,
): number | null {
  const cutoff = new Date(today + 'T00:00:00Z').getTime() - days * DAY_MS;
  const valid = recoveries.filter(
    (r) =>
      r.score !== null &&
      new Date(r.date + 'T00:00:00Z').getTime() >= cutoff,
  );
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, r) => acc + (r.score ?? 0), 0);
  return Number((sum / valid.length).toFixed(1));
}

/**
 * Adherencia de comidas: % de los últimos 7 días que cumplen el target diario.
 */
export function mealsAdherence(
  meals: MealEntry[],
  today: string,
  goals: VerdictGoals,
): number {
  const target = Math.max(1, goals.meals_per_day_target);
  const todayMs = new Date(today + 'T00:00:00Z').getTime();
  let daysHit = 0;
  for (let d = 0; d < 7; d++) {
    const dayStart = todayMs - d * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const count = meals.filter((m) => {
      const ms = new Date(m.date + 'T00:00:00Z').getTime();
      return ms >= dayStart && ms < dayEnd;
    }).length;
    if (count >= target) daysHit++;
  }
  return Math.round((daysHit / 7) * 100);
}

/**
 * Adherencia de entrenos: % del target semanal alcanzado en los últimos 7 días.
 * Solo cuenta status='done' o 'partial'.
 */
export function trainingAdherence(
  trainings: TrainingEntry[],
  today: string,
  goals: VerdictGoals,
): number {
  const target = Math.max(1, goals.trainings_per_week_target);
  const cutoff = new Date(today + 'T00:00:00Z').getTime() - 7 * DAY_MS;
  const recent = trainings.filter(
    (t) =>
      (t.status === 'done' || t.status === 'partial') &&
      new Date(t.date + 'T00:00:00Z').getTime() >= cutoff,
  );
  return Math.round(clamp((recent.length / target) * 100, 0, 100));
}

export function moodAverage(moods: MoodEntry[]): number | null {
  const valid = moods.filter((m) => m.mood !== null);
  if (valid.length === 0) return null;
  const sum = valid.reduce((acc, m) => acc + (m.mood ?? 0), 0);
  return Number((sum / valid.length).toFixed(1));
}

interface ScoreInput {
  components: VerdictComponents;
  goals: VerdictGoals;
}

/**
 * Status determinista. Reglas:
 *   - meals adherence >=70 → +1, <40 → -1
 *   - training adherence >=80 → +1, <40 → -1
 *   - recovery avg >=70 → +1, <50 → -1
 *   - weight trend alinea con goal → +1, opuesto → -1 (si goal != maintain)
 *   - mood >= 4 → +1, <= 2 → -1
 * Score >=2 → green, <=-2 → red, else amber.
 */
export function computeStatus({ components, goals }: ScoreInput): {
  status: VerdictStatus;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  if (components.adherence_meals_pct >= 70) {
    score++;
    reasons.push(`comidas ${components.adherence_meals_pct}% (✓)`);
  } else if (components.adherence_meals_pct < 40) {
    score--;
    reasons.push(`comidas ${components.adherence_meals_pct}% (bajo)`);
  }

  if (components.adherence_training_pct >= 80) {
    score++;
    reasons.push(`entrenos ${components.adherence_training_pct}% (✓)`);
  } else if (components.adherence_training_pct < 40) {
    score--;
    reasons.push(`entrenos ${components.adherence_training_pct}% (bajo)`);
  }

  if (components.recovery_avg_14d !== null) {
    if (components.recovery_avg_14d >= 70) {
      score++;
      reasons.push(`recovery ${components.recovery_avg_14d} (✓)`);
    } else if (components.recovery_avg_14d < 50) {
      score--;
      reasons.push(`recovery ${components.recovery_avg_14d} (bajo)`);
    }
  }

  const wt = components.weight_trend;
  if (wt.direction !== 'unknown' && goals.weight_direction_target !== 'maintain') {
    const aligns =
      (goals.weight_direction_target === 'down' && wt.direction === 'down') ||
      (goals.weight_direction_target === 'up' && wt.direction === 'up');
    const opposes =
      (goals.weight_direction_target === 'down' && wt.direction === 'up') ||
      (goals.weight_direction_target === 'up' && wt.direction === 'down');
    if (aligns) {
      score++;
      reasons.push(`peso → ${wt.direction} (alineado)`);
    } else if (opposes) {
      score--;
      reasons.push(`peso → ${wt.direction} (opuesto al objetivo)`);
    }
  }

  if (components.mood_avg !== null) {
    if (components.mood_avg >= 4) {
      score++;
      reasons.push(`mood ${components.mood_avg} (✓)`);
    } else if (components.mood_avg <= 2) {
      score--;
      reasons.push(`mood ${components.mood_avg} (bajo)`);
    }
  }

  let status: VerdictStatus;
  if (score >= 2) status = 'green';
  else if (score <= -2) status = 'red';
  else status = 'amber';
  return { status, reasons };
}

function describeStatus(status: VerdictStatus, reasons: string[]): string {
  if (status === 'green') {
    return `Vas bien. ${reasons.length > 0 ? reasons.join('; ') + '.' : 'Mantén el ritmo.'}`;
  }
  if (status === 'red') {
    return `Cuidado: ${reasons.length > 0 ? reasons.join('; ') + '.' : 'demasiadas señales en rojo.'}`;
  }
  return `Atento: ${reasons.length > 0 ? reasons.join('; ') + '.' : 'señales mixtas esta semana.'}`;
}

export function computeVerdict(input: VerdictInput): VerdictResult {
  const components: VerdictComponents = {
    weight_trend: weightTrend(input.weights, input.today),
    recovery_avg_14d: recoveryAvg(input.recoveries, input.today, 14),
    adherence_meals_pct: mealsAdherence(input.meals, input.today, input.goals),
    adherence_training_pct: trainingAdherence(
      input.trainings,
      input.today,
      input.goals,
    ),
    mood_avg: moodAverage(input.moods),
  };
  const { status, reasons } = computeStatus({ components, goals: input.goals });
  return {
    status,
    components,
    reasons,
    text: describeStatus(status, reasons),
  };
}
