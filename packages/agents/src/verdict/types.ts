export type VerdictStatus = 'green' | 'amber' | 'red';

export interface WeightTrend {
  direction: 'up' | 'down' | 'flat' | 'unknown';
  slope_kg_per_week: number | null;
  ema7_kg: number | null;
}

export interface VerdictComponents {
  weight_trend: WeightTrend;
  recovery_avg_14d: number | null;
  adherence_meals_pct: number;
  adherence_training_pct: number;
  mood_avg: number | null;
}

export interface VerdictResult {
  status: VerdictStatus;
  components: VerdictComponents;
  text: string;
  reasons: string[];
}

export interface WeightEntry {
  date: string;
  weight_kg: number;
}

export interface RecoveryEntry {
  date: string;
  score: number | null;
}

export interface MealEntry {
  date: string;
}

export interface TrainingEntry {
  date: string;
  status: string;
}

export interface MoodEntry {
  mood: number | null;
  energy: number | null;
}

export interface VerdictGoals {
  meals_per_day_target: number;
  trainings_per_week_target: number;
  weight_direction_target: 'down' | 'up' | 'maintain';
}

export interface VerdictInput {
  today: string;
  weights: WeightEntry[];
  recoveries: RecoveryEntry[];
  meals: MealEntry[];
  trainings: TrainingEntry[];
  moods: MoodEntry[];
  goals: VerdictGoals;
}
