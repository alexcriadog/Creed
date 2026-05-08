// @creed/agents — Nutricionista, Preparador, Orquestador.
// Tools, prompts, runner. Populated in fase 5.
// Default dev: Groq (cheap models). Sonnet 4.6 reserved for production coach flows.

export {
  computeVerdict,
  computeStatus,
  ema7,
  weightTrend,
  recoveryAvg,
  mealsAdherence,
  trainingAdherence,
  moodAverage,
  DEFAULT_GOALS,
} from './verdict/compute';

export type {
  VerdictStatus,
  VerdictComponents,
  VerdictResult,
  VerdictInput,
  VerdictGoals,
  WeightTrend,
  WeightEntry,
  RecoveryEntry,
  MealEntry,
  TrainingEntry,
  MoodEntry,
} from './verdict/types';

export { parseMeal } from './parser/meal-parser';
export type { ParseResult, ParsedItem } from './parser/meal-parser';
