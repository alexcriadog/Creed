/**
 * Meal parser — texto libre de comida → macros estructuradas.
 *
 * Default dev: Groq Llama 3.3 70B (cheap, fast). Directiva del usuario:
 * Anthropic con cuidado, todos los tests/desarrollo contra Groq.
 */
import Groq from 'groq-sdk';
import { z } from 'zod';

const PARSER_VERSION_TEXT = 'groq-llama4-scout-v1';
const PARSER_VERSION_VISION = 'groq-llama4-scout-vision-v1';
// Llama 4 Scout: multimodal (texto + visión) disponible en la cuenta Groq.
// Reemplaza llama-3.3-70b-versatile (cuota diaria agotada) y maverick (no
// disponible en esta cuenta).
const DEFAULT_TEXT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const DEFAULT_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

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

Reglas críticas:
- **Consistencia interna obligatoria:** las calorías deben aproximarse a 4*protein_g + 4*carbs_g + 9*fat_g (±10%). Si no cuadran, revisa antes de devolver.
- **Sé conservador.** Prefiere subestimar que sobreestimar — es peor inflar macros que quedarse corto. Tirar al rango bajo de las referencias.
- Si la cantidad no está clara, asume una porción estándar pequeña-realista y añade warning explicando la asunción.
- Macros por ítem deben corresponder a la cantidad concreta indicada, no por 100 g.
- Si no entiendes algún ítem, ponlo con todos los macros en null y añade warning. No inventes.

Referencias rápidas (orientativas, por 100 g salvo nota):
- Pollo plancha: 165 kcal, 31P, 0C, 3.6F
- Pavo fiambre (loncha ~15-20 g): 5-6 kcal/g, 1P por g, ~0C, ~0.05F
- Pan integral: 240-260 kcal, 9P, 42C, 3F (rebanada ~30 g)
- Huevo (1 ud, ~55 g): 75 kcal, 6P, 0.5C, 5F
- Aceite oliva: 9 kcal/ml, 0P, 0C, 1F/ml
- Arroz blanco cocido: 130 kcal, 2.5P, 28C, 0.3F
- Avena cruda: 380 kcal, 13P, 67C, 7F

Salida: NO markdown, NO explicación, SOLO el JSON.`;

interface ParserOptions {
  apiKey: string;
  rawText: string;
  /** Override del modelo. Si hay `imageBase64`, el default es el vision model. */
  model?: string;
  /** Default: 0.1 — queremos parsing determinista. */
  temperature?: number;
  /** Imagen opcional en base64 (sin prefijo data:). Si se pasa, usa modelo de visión. */
  imageBase64?: string;
  /** Default: 'image/jpeg'. */
  imageMimeType?: string;
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

  // Penaliza si 4P + 4C + 9F no se acerca a la suma de calorías declarada.
  // Esta es la señal más fiable de que el modelo está inventando macros.
  let totalKcal = 0;
  let derivedKcal = 0;
  for (const it of items) {
    if (typeof it.calories === 'number') totalKcal += it.calories;
    derivedKcal +=
      4 * (typeof it.protein_g === 'number' ? it.protein_g : 0) +
      4 * (typeof it.carbs_g === 'number' ? it.carbs_g : 0) +
      9 * (typeof it.fat_g === 'number' ? it.fat_g : 0);
  }
  let consistencyPenalty = 0;
  if (totalKcal > 0 && derivedKcal > 0) {
    const diff = Math.abs(totalKcal - derivedKcal) / totalKcal;
    if (diff > 0.25) consistencyPenalty = 0.4;
    else if (diff > 0.15) consistencyPenalty = 0.25;
    else if (diff > 0.1) consistencyPenalty = 0.1;
  }

  return Math.max(
    0,
    Math.min(1, macroCoverage - warningPenalty - consistencyPenalty),
  );
}

export async function parseMeal(opts: ParserOptions): Promise<ParseResult> {
  const groq = new Groq({ apiKey: opts.apiKey });
  const hasImage = typeof opts.imageBase64 === 'string' && opts.imageBase64.length > 0;
  const model = opts.model ?? (hasImage ? DEFAULT_VISION_MODEL : DEFAULT_TEXT_MODEL);
  const mime = opts.imageMimeType ?? 'image/jpeg';

  const userContent: Groq.Chat.Completions.ChatCompletionContentPart[] = hasImage
    ? [
        { type: 'text', text: opts.rawText || 'Describe los alimentos en la foto.' },
        {
          type: 'image_url',
          image_url: { url: `data:${mime};base64,${opts.imageBase64}` },
        },
      ]
    : [{ type: 'text', text: opts.rawText }];

  // Los modelos de visión de Groq no soportan response_format: json_object —
  // pedimos el JSON via prompt y validamos en cliente. Para texto seguimos con
  // json_object porque es más fiable.
  const completion = await groq.chat.completions.create({
    model,
    temperature: opts.temperature ?? 0,
    ...(hasImage ? {} : { response_format: { type: 'json_object' as const } }),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: hasImage ? userContent : opts.rawText },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('parser_empty_response');
  }

  const jsonText = extractJsonObject(content);

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
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
    parser_version: hasImage ? PARSER_VERSION_VISION : PARSER_VERSION_TEXT,
  };
}

// Extrae el primer bloque JSON {...} del texto. Los modelos de visión a veces
// envuelven la respuesta con markdown o texto adicional.
function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}
