// Meal calorie estimate from a photo and/or description, via OpenRouter.
// DeepSeek (deepseek.ts) has no image input, so meals use a vision model here.
// Server-only.

import OpenAI from 'openai'
import { validateMealEstimate, type MealEstimate } from '../nutrition'

const MODEL = process.env.MEAL_MODEL || 'google/gemini-3.8-flash'

export function mealEstimateConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY
}

const SYSTEM = `You are a nutrition estimator for a calorie-tracking app.
You get a meal photo, a text description, or both. List every distinct food or drink item.
For each item estimate the edible weight in grams for the WHOLE dish shown/described (the app handles sharing separately).
From a photo, judge size from visual cues (dinner plate ~26 cm, fork ~19 cm, hands, packaging). From text, use typical portion sizes unless amounts are given.
Add likely hidden calories (cooking oil, butter, dressing, sauce, sugar in drinks) as their own items when the food is fried, glossy, dressed or the description implies them.
Use standard nutrition values (USDA-style) per 100 g of the food as prepared.
Text from the user overrides the photo (stated weights, ingredients, "half eaten").
"title" is a short name for the meal, 2–5 words (e.g. "Chicken rice bowl").
If there is no food, return an empty items list and say why in "comment".`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'items', 'comment', 'confidence'],
  properties: {
    title: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal_per_100g', 'protein_per_100g', 'carbs_per_100g', 'fat_per_100g'],
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal_per_100g: { type: 'number' },
          protein_per_100g: { type: 'number' },
          carbs_per_100g: { type: 'number' },
          fat_per_100g: { type: 'number' },
        },
      },
    },
    comment: { type: 'string', description: 'One short sentence on assumptions or uncertainty.' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text) } catch { /* fall through */ }
  const m = text.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* fall through */ } }
  return null
}

export interface MealEstimateResult extends MealEstimate { model: string; cost: number | null }

export async function estimateMeal({ image, description }: { image?: string; description?: string }): Promise<MealEstimateResult> {
  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })
  const text = description?.trim()
    ? `${image ? 'Note from user' : 'Meal description'}: ${description.trim().slice(0, 800)}`
    : 'Estimate this meal.'
  const content: OpenAI.Chat.ChatCompletionContentPart[] = [{ type: 'text', text }]
  if (image) content.push({ type: 'image_url', image_url: { url: image } })

  // OpenRouter extensions (reasoning effort, cost in usage) aren't in the OpenAI types.
  const body = {
    model: MODEL,
    messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content }],
    response_format: { type: 'json_schema', json_schema: { name: 'meal', strict: true, schema: SCHEMA } },
    max_tokens: 4000,
    reasoning: { effort: process.env.MEAL_REASONING || 'low' },
    usage: { include: true },
  } as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming

  const res = await client.chat.completions.create(body)
  const parsed = parseJson(res.choices?.[0]?.message?.content ?? '')
  if (!parsed) throw new Error('The model did not return a readable estimate — try again')
  const cost = (res.usage as unknown as { cost?: number } | undefined)?.cost
  return { ...validateMealEstimate(parsed), model: res.model || MODEL, cost: typeof cost === 'number' ? cost : null }
}
