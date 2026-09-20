import { z } from 'zod';

/** Día en la zona del atleta: YYYY-MM-DD. */
export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD');

/** Instante con zona horaria explícita (2026-09-20T08:30:00+02:00 o …Z). */
export const isoInstant = z.string().datetime({ offset: true });

export const documentKind = z.enum(['nutri_report', 'nutri_plan', 'analitica', 'otro']);
