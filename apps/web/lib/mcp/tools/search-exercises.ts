import { z } from 'zod';
import { defineTool } from '../types';
import { searchExercises } from '../exercises/resolve';

export const searchExercisesTool = defineTool({
  name: 'search_exercises',
  description:
    'Busca ejercicios en el catálogo de Creed (~870 ejercicios con nombre en inglés; acepta alias en español ' +
    'como "press banca", "sentadilla", "jalón al pecho"). Úsala cuando no estés seguro de a qué ejercicio ' +
    'corresponde lo que el usuario ha escrito, o para ofrecerle variantes. Devuelve id, slug, músculo principal ' +
    'y equipamiento; pasa el id a log_workout / set_program como exercise_id para fijar la elección. ' +
    'Si no hay resultados, log_workout creará un ejercicio personalizado con el nombre dado.',
  inputSchema: z.object({
    query: z.string().min(2).max(80).describe('Nombre del ejercicio, en español o inglés'),
    limit: z.number().int().min(1).max(10).default(5),
  }),
  handler: async (ctx, { query, limit }) => ({ results: await searchExercises(ctx, query, limit) }),
});
