/**
 * Meal parser — texto libre de comida → macros estructuradas.
 *
 * Default dev: Groq Llama 3.3 70B (cheap, fast). Directiva del usuario:
 * Anthropic con cuidado, todos los tests/desarrollo contra Groq.
 */
import Groq from 'groq-sdk';
import { z } from 'zod';

const PARSER_VERSION = 'groq-llama-3.3-70b-v1';

const itemSchema = z.object({
  name: z.string(),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  calories: z.number().nullable().optional(),
  protein_g: z.number().nullable().optional(),
  carbs_g: z.number().nullable().optional(),
  fat_g: z.number().nullable().optional(),
});

const parserOutputSchema = z.object({
  items: z.array(itemSchema),
  warnings: z.array(z.string()).optional(),
});

export type ParsedItem = z.infer<typeof itemSchema>;

export interface ParseResult {
  parsed: {
    items: ParsedItem[];
    warnings: string[];
  };
  total_calories: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
  parser_confidence: number;
  parser_version: string;
}

const SYSTEM_PROMPT = `Eres un nutricionista experto que extrae macros de descripciones de comidas en español.

Devuelve SOLO un objeto JSON válido con esta forma exacta:
{
  "items": [
    {
      "name": "string en español",
      "quantity": number | null,
      "unit": "g" | "ml" | "ud" | "raciones" | null,
      "calories": number | null,
      "protein_g": number | null,
      "carbs_g": number | null,
      "fat_g": number | null
    }
  ],
  "warnings": ["string"]
}

Reglas:
- Si la cantidad no está clara, asume porción razonable estándar y añade un warning.
- Macros por ítem deben ser para la cantidad concreta indicada, no por 100g.
- Usa valores realistas (pollo a la plancha 100g ≈ 165 kcal, 31g proteína).
- Si no entiendes algún ítem, ponlo como item con todos los macros null y añade warning.
- NO incluyas markdown, NO incluyas explicación, SOLO el JSON.`;

interface ParserOptions {
  apiKey: string;
  rawText: string;
  /** Default: 'llama-3.3-70b-versatile' */
  model?: string;
  /** Default: 0.1 — queremos parsing determinista. */
  temperature?: number;
}

function sumOrNull(items: ParsedItem[], field: keyof ParsedItem): number | null {
  let total = 0;
  let any = false;
  for (const it of items) {
    const v = it[field];
    if (typeof v === 'number') {
      total += v;
      any = true;
    }
  }
  return any ? Number(total.toFixed(1)) : null;
}

function computeConfidence(items: ParsedItem[], warnings: string[]): number {
  if (items.length === 0) return 0;
  const itemsWithMacros = items.filter(
    (it) => typeof it.calories === 'number' && typeof it.protein_g === 'number',
  ).length;
  const macroCoverage = itemsWithMacros / items.length;
  const warningPenalty = Math.min(0.4, warnings.length * 0.1);
  return Math.max(0, Math.min(1, macroCoverage - warningPenalty));
}

export async function parseMeal(opts: ParserOptions): Promise<ParseResult> {
  const groq = new Groq({ apiKey: opts.apiKey });

  const completion = await groq.chat.completions.create({
    model: opts.model ?? 'llama-3.3-70b-versatile',
    temperature: opts.temperature ?? 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: opts.rawText },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('parser_empty_response');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new Error('parser_invalid_json');
  }

  const validation = parserOutputSchema.safeParse(raw);
  if (!validation.success) {
    throw new Error(`parser_schema_error: ${validation.error.issues[0]?.message ?? 'unknown'}`);
  }

  const items = validation.data.items;
  const warnings = validation.data.warnings ?? [];
  const confidence = computeConfidence(items, warnings);

  return {
    parsed: { items, warnings },
    total_calories: sumOrNull(items, 'calories'),
    total_protein_g: sumOrNull(items, 'protein_g'),
    total_carbs_g: sumOrNull(items, 'carbs_g'),
    total_fat_g: sumOrNull(items, 'fat_g'),
    parser_confidence: Number(confidence.toFixed(2)),
    parser_version: PARSER_VERSION,
  };
}
