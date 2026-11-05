import { requireUser, checkAndRecordAIUse } from '@/lib/server/requireUser'
import { estimateMeal, mealEstimateConfigured } from '@/lib/server/mealEstimate'

export const maxDuration = 60

// POST { image?: "data:image/jpeg;base64,…", description?: string } → MealEstimateResult
export async function POST(req: Request) {
  if (!mealEstimateConfigured()) {
    return new Response('OPENROUTER_API_KEY is not configured', { status: 500 })
  }

  const auth = await requireUser(req)
  if ('error' in auth) return auth.error

  const { image, description } = await req.json().catch(() => ({}))
  const hasImage = typeof image === 'string' && image.startsWith('data:image/')
  const hasText = typeof description === 'string' && description.trim().length > 0
  if (!hasImage && !hasText) {
    return new Response('Send a photo or a description of the meal', { status: 400 })
  }

  const limitError = await checkAndRecordAIUse(auth.user.id)
  if (limitError) return limitError

  try {
    const result = await estimateMeal({ image: hasImage ? image : undefined, description: hasText ? description : undefined })
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Meal estimate error:', message)
    return new Response(`Meal estimate failed: ${message}`, { status: 502 })
  }
}
