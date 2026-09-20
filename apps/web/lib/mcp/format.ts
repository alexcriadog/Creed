/** Helpers numéricos para respuestas compactas del MCP. */

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 1RM estimado (Epley). Para 1 rep devuelve el peso tal cual. */
export function e1rm(weightKg: number, reps: number): number {
  if (reps <= 1) return round1(weightKg);
  return round1(weightKg * (1 + reps / 30));
}

/** Suma peso×reps de las series con ambos valores presentes. */
export function tonnage(sets: { weight_kg: number | null; reps: number | null }[]): number {
  return round1(
    sets.reduce((acc, s) => acc + (s.weight_kg && s.reps ? s.weight_kg * s.reps : 0), 0),
  );
}
