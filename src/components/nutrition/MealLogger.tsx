'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Camera, ImageIcon, PenLine, Loader2, Mic, Square } from 'lucide-react'
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

// Minimal Web Speech API types (Safari / Chrome ship it as webkitSpeechRecognition).
interface SpeechRec {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void; stop(): void
}
type SpeechRecCtor = new () => SpeechRec
function speechCtor(): SpeechRecCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechRecCtor; webkitSpeechRecognition?: SpeechRecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const noopSubscribe = () => () => {}

/** Dictate into a text field: appends final phrases to `value`, shows the live phrase meanwhile. */
function useDictation(value: string, setValue: (v: string) => void) {
  // false on the server / first paint, real value after hydration — no mismatch.
  const supported = useSyncExternalStore(noopSubscribe, () => !!speechCtor(), () => false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [micError, setMicError] = useState('')
  const recRef = useRef<SpeechRec | null>(null)
  const baseRef = useRef('')

  useEffect(() => () => recRef.current?.stop(), [])

  function start() {
    const Ctor = speechCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = navigator.language || 'en-GB'
    rec.continuous = true
    rec.interimResults = true
    baseRef.current = value.trim()
    rec.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript.trim()
        if (e.results[i].isFinal) baseRef.current = [baseRef.current, text].filter(Boolean).join(' ')
        else live += ` ${text}`
      }
      setValue(baseRef.current)
      setInterim(live.trim())
    }
    rec.onerror = (e) => {
      setMicError(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone blocked — allow it for this site in Settings, or use the mic on your keyboard.'
        : `Dictation stopped (${e.error}).`)
    }
    rec.onend = () => { setListening(false); setInterim('') }
    recRef.current = rec
    setMicError('')
    try { rec.start(); setListening(true) } catch { setMicError('Could not start dictation.') }
  }
  function stop() { recRef.current?.stop() }

  return { supported, listening, interim, micError, start, stop }
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
  const dictation = useDictation(text, setText)

  function reset() {
    dictation.stop()
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
      dictation.stop()
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

  // Text box with a mic button — used for the photo note and the description (both edit `text`).
  const dictField = (rows: number, placeholder: string, hint: string) => (
    <div className="space-y-1.5">
      <div className="relative">
        <textarea
          value={dictation.interim ? `${text} ${dictation.interim}`.trim() : text}
          onChange={e => setText(e.target.value)} rows={rows}
          readOnly={dictation.listening}
          placeholder={placeholder}
          className="w-full rounded-lg pl-3 pr-14 py-2 text-base sm:text-sm block"
          style={{ background: '#1E1E1E', border: `1px solid ${dictation.listening ? '#C8102E' : '#2E2E2E'}`, color: '#F5F5F5' }}
        />
        {dictation.supported && (
          <button
            type="button"
            onClick={dictation.listening ? dictation.stop : dictation.start}
            aria-label={dictation.listening ? 'Stop dictation' : 'Dictate'}
            aria-pressed={dictation.listening}
            className={`absolute right-2 top-2 w-10 h-10 rounded-full flex items-center justify-center ${dictation.listening ? 'animate-pulse' : ''}`}
            style={{ background: dictation.listening ? '#C8102E' : 'rgba(0,191,165,0.12)', color: dictation.listening ? '#F5F5F5' : '#00BFA5' }}
          >
            {dictation.listening ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
          </button>
        )}
      </div>
      <p className="text-xs" style={{ color: dictation.micError ? '#E5484D' : 'var(--color-text-subtle)' }}>
        {dictation.micError
          || (dictation.listening ? 'Listening… tap ■ when you’re done.'
            : dictation.supported ? hint : 'Tip: tap the mic on your keyboard to dictate.')}
      </p>
    </div>
  )

  const tab = (m: Mode, label: string, Icon: typeof Camera) => (
    <button
      type="button"
      onClick={() => { setMode(m); reset() }}
      aria-pressed={mode === m}
      className="flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-2 rounded-lg text-sm font-bold"
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
              <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-2">
                {/* Big thumb-sized camera target on phones */}
                <button
                  type="button" onClick={() => camRef.current?.click()} disabled={busy}
                  className="flex flex-col sm:flex-row items-center justify-center gap-2 rounded-xl py-6 sm:py-3 font-bold transition-all active:scale-[0.98]"
                  style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'var(--font-sans)' }}
                >
                  <Camera size={28} className="sm:w-4 sm:h-4" /> Take photo
                </button>
                <Button variant="subtle" onClick={() => libRef.current?.click()} disabled={busy} fullWidth>
                  <ImageIcon size={16} /> Choose from library
                </Button>
              </div>
            )}
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          <input ref={libRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          {dictField(2, 'Optional note, e.g. “fried in butter”, “about 200 g rice”',
            image ? 'Tap the mic to add a note, then Estimate again.' : 'Add a note first (or after, then Estimate again) — e.g. “cooked in butter”.')}
          {image && !busy && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button variant="subtle" onClick={reset}>Retake</Button>
              <Button onClick={() => { dictation.stop(); estimate(image, text.trim()) }}>Estimate again</Button>
            </div>
          )}
        </div>
      )}

      {mode === 'text' && !draft && (
        <div className="space-y-3">
          {dictField(4, 'e.g. “2 slices of sourdough with peanut butter and a banana”',
            'Tap the mic and say what you ate — amounts help (“two eggs”, “a large bowl”).')}
          <div className="flex justify-end">
            <Button onClick={() => { dictation.stop(); estimate(null, text.trim()) }} disabled={busy || !text.trim()} className="w-full sm:w-auto">Estimate calories</Button>
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
