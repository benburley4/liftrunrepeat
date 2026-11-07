// Renpho scale readings: raw cloud record → renpho_body row. Dependency-free so
// scripts/renpho-sync.mjs can import it directly.

export interface BodyReading {
  reading_id: string
  measured_at: string
  date: string                       // local date of the weigh-in
  weight_kg: number
  bmi: number | null
  body_fat_pct: number | null
  water_pct: number | null
  muscle_pct: number | null
  bone_kg: number | null
  bmr_kcal: number | null
  visceral_fat: number | null
  subcutaneous_fat_pct: number | null
  protein_pct: number | null
  body_age: number | null
  lean_mass_kg: number | null
  fat_free_kg: number | null
}

const DEFAULT_OFFSET_MIN = 8 * 60   // Hong Kong

/** "+8:00" → 480. Falls back to Hong Kong if the record has no usable zone. */
export function offsetMinutes(zone: unknown): number {
  const m = typeof zone === 'string' ? zone.match(/^([+-])(\d{1,2}):(\d{2})$/) : null
  if (!m) return DEFAULT_OFFSET_MIN
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
}

/** The scale sends 0 for anything it didn't measure, so 0 means missing. */
function measured(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

/**
 * One raw record → a reading, or null if it belongs to another profile on the
 * account (other people can share the scale) or has no usable weight.
 */
export function toBodyReading(raw: Record<string, unknown>, profileId: string): BodyReading | null {
  if (String(raw.bUserId ?? raw.userId) !== profileId) return null
  const weight = measured(raw.weight)
  const seconds = Number(raw.timeStamp)
  if (raw.id == null || weight == null || !(seconds > 0)) return null
  const ms = seconds * 1000
  return {
    reading_id: String(raw.id),
    measured_at: new Date(ms).toISOString(),
    date: new Date(ms + offsetMinutes(raw.timeZone) * 60_000).toISOString().slice(0, 10),
    weight_kg: weight,
    bmi: measured(raw.bmi),
    body_fat_pct: measured(raw.bodyfat),
    water_pct: measured(raw.water),
    muscle_pct: measured(raw.muscle),
    bone_kg: measured(raw.bone),
    bmr_kcal: measured(raw.bmr),
    visceral_fat: measured(raw.visfat),
    subcutaneous_fat_pct: measured(raw.subfat),
    protein_pct: measured(raw.protein),
    body_age: measured(raw.bodyage),
    lean_mass_kg: measured(raw.sinew),
    fat_free_kg: measured(raw.fatFreeWeight),
  }
}
