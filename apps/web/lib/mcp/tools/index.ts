import type { ToolDef } from '../types';
import { getDailyBriefingTool } from './get-daily-briefing';
import { getTrainingHistoryTool } from './get-training-history';
import { getWhoopSummaryTool } from './get-whoop-summary';
import { getNutritionSummaryTool } from './get-nutrition-summary';
import { getBodyTrendTool } from './get-body-trend';
import { getProgramTool } from './get-program';
import { searchExercisesTool } from './search-exercises';
import { searchDocsTool, getDocTool } from './search-docs';
import { logWorkoutTool } from './log-workout';
import { logMealTool } from './log-meal';
import { logMeasurementTool } from './log-measurement';
import { saveDocumentTool } from './save-document';
import { setProgramTool } from './set-program';

/** Orden = orden en que el modelo las ve; lectura primero, escritura después. */
export const tools: ToolDef[] = [
  getDailyBriefingTool,
  getTrainingHistoryTool,
  getWhoopSummaryTool,
  getNutritionSummaryTool,
  getBodyTrendTool,
  getProgramTool,
  searchExercisesTool,
  searchDocsTool,
  getDocTool,
  logWorkoutTool,
  logMealTool,
  logMeasurementTool,
  saveDocumentTool,
  setProgramTool,
] as ToolDef[];
