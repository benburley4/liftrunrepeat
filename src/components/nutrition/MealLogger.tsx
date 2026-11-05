'use client'

import { useRef, useState } from 'react'
import { Camera, ImageIcon, PenLine, Loader2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import MealEditor, { MealDraft } from './MealEditor'
import { authHeaders } from '@/lib/auth'
import type { MealEstimate } from '@/lib/nutrition'

type Mode = 'photo' | 'text'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((ok, bad) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error('Could not read that image')) }
    img.src = url
  })
}

/** Downscale before upload — keeps the request small and the AI call cheap. */
function toJpeg(img: HTMLImageElement, max: number, quality: number): string {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.round(img.naturalWidth * s)
  c.height = Math.round(img.naturalHeight * s)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

export interface LoggedMeal { draft: MealDraft; source: 'photo' | 'text'; note?: string; thumb?: string }

export default function MealLogger({ onSave }: { onSave: (meal: LoggedMeal, favourite: boolean) => Promise<void> }) {
  const [mode, setMode] = useState<Mode>('photo')
  const [image, setImage] = useState<string | null>(null)
  const [thumb, setThumb] = useState<string | undefined>()
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<MealDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const camRef = useRef<HTMLInputElement>(null)
  const libRef = useRef<HTMLInputElement>(null)

  function reset() {
    setImage(null); setThumb(undefined); setText(''); setDraft(null); setError('')
  }

  async function estimate(img: string | null, description: string) {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/meal-estimate', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ image: img ?? undefined, description: description || undefined }),
      })
      if (!res.ok) throw new Error((await res.text()) || `Error ${res.status}`)
      const d = await res.json() as MealEstimate & { model?: string; cost?: number | null }
      setDraft({
        title: d.title, items: d.items, share: draft?.share ?? 1, comment: d.comment, confidence: d.confidence,
        meta: [d.model, d.cost != null ? `$${d.cost.toFixed(4)}` : null].filter(Boolean).join(' · '),
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Estimate failed')
    } finally { setBusy(false) }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const img = await loadImage(file)
      const full = toJpeg(img, 1280, 0.82)
      setImage(full); setThumb(toJpeg(img, 112, 0.7)); setDraft(null)
      estimate(full, text.trim())
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not read that image') }
  }

  async function save(favourite: boolean) {
    if (!draft) return
    setSaving(true)
    try {
      await onSave({ draft, source: image ? 'photo' : 'text', note: text.trim() || undefined, thumb }, favourite)
      reset()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the meal')
    } finally { setSaving(false) }
  }

  const tab = (m: Mode, label: string, Icon: typeof Camera) => (
    <button
      type="button"
      onClick={() => { setMode(m); reset() }}
      aria-pressed={mode === m}
      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold"
      style={{ background: mode === m ? 'rgba(0,191,165,0.12)' : 'transparent', color: mode === m ? '#00BFA5' : '#A0A0A0', fontFamily: 'var(--font-sans)' }}
    >
      <Icon size={16} /> {label}
    </button>
  )

  return (
    <Card hover={false}>
      <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: '#1E1E1E' }}>
        {tab('photo', 'Photo', Camera)}
        {tab('text', 'Describe', PenLine)}
      </div>

      {mode === 'photo' && !draft && (
        <div className="space-y-3">
          {image
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            ? <img src={image} alt="Meal" className="w-full max-h-80 object-cover rounded-xl" />
            : (
              <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <Button onClick={() => camRef.current?.click()} disabled={busy}><Camera size={16} /> Take photo</Button>
                <Button variant="subtle" onClick={() => libRef.current?.click()} disabled={busy}><ImageIcon size={16} /> Library</Button>
              </div>
            )}
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          <input ref={libRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <textarea
            value={text} onChange={e => setText(e.target.value)} rows={2}
            placeholder="Optional note, e.g. “fried in butter”, “about 200 g rice”"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5' }}
          />
          {image && !busy && (
            <div className="flex gap-2 justify-end">
              <Button variant="subtle" size="sm" onClick={reset}>Retake</Button>
              <Button size="sm" onClick={() => estimate(image, text.trim())}>Estimate again</Button>
            </div>
          )}
        </div>
      )}

      {mode === 'text' && !draft && (
        <div className="space-y-3">
          <textarea
            value={text} onChange={e => setText(e.target.value)} rows={3}
            placeholder="Describe the meal, e.g. “2 slices of sourdough with peanut butter and a banana” or “chicken caesar salad, large”"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ background: '#1E1E1E', border: '1px solid #2E2E2E', color: '#F5F5F5' }}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => estimate(null, text.trim())} disabled={busy || !text.trim()}>Estimate calories</Button>
          </div>
        </div>
      )}

      {busy && (
        <p className="flex items-center gap-2 text-sm mt-3" style={{ color: '#A0A0A0' }}>
          <Loader2 size={16} className="animate-spin" /> Estimating… (about 10 s)
        </p>
      )}
      {error && <p className="text-sm mt-3" style={{ color: '#E5484D' }}>{error}</p>}

      {draft && (
        <div className="space-y-3">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
            <img src={image} alt="Meal" className="w-full max-h-56 object-cover rounded-xl" />
          )}
          <MealEditor draft={draft} onChange={setDraft} onSave={save} onDiscard={reset} saving={saving} />
        </div>
      )}
    </Card>
  )
}
