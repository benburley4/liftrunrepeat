'use client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HikeSettings {
  pace:       'slow' | 'normal' | 'fast' | 'run'
  surface:    'easy' | 'good' | 'rough' | 'tough'
  packWeight: 'light' | 'regular' | 'heavy' | 'very-heavy'
}

export interface HikeData {
  distanceKm:    string
  elevationGainM: string
  settings:      HikeSettings
}

// ─── Naismith's Rule (metric) ─────────────────────────────────────────────────
// Base:    12 min/km  (5 km/hr)
// Ascent:  +1 min per 10 m elevation gain
// Book:    18.64 min/km (30 min/mile) + 1 min per 10 m elevation gain

// TrailsNH correction multipliers
const PACE_MULT:    Record<HikeSettings['pace'],       number> = { slow: 1.25, normal: 1.0, fast: 0.82, run: 0.65 }
const SURFACE_MULT: Record<HikeSettings['surface'],    number> = { easy: 1.0, good: 1.08, rough: 1.22, tough: 1.48 }
const PACK_MULT:    Record<HikeSettings['packWeight'], number> = { light: 1.0, regular: 1.04, heavy: 1.14, 'very-heavy': 1.28 }

function naismith(km: number, elevM: number): number {
  return km * 12 + (elevM / 10)
}

function correctionFactor(settings: HikeSettings): number {
  return PACE_MULT[settings.pace] * SURFACE_MULT[settings.surface] * PACK_MULT[settings.packWeight]
}

function fmtMins(mins: number): string {
  if (mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m`
}

function fmtSpeed(km: number, mins: number): string {
  if (mins <= 0 || km <= 0) return '—'
  return (km / (mins / 60)).toFixed(1) + ' km/h'
}

function fmtPace(km: number, mins: number): string {
  if (mins <= 0 || km <= 0) return '—'
  const minsPerKm = mins / km
  const m = Math.floor(minsPerKm)
  const s = Math.round((minsPerKm - m) * 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ToggleGroup<T extends string>({
  label, options, value, onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
        {label}
      </label>
      <div className="flex gap-1.5 flex-wrap">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: value === opt.value ? '#84CC1625' : '#242424',
              color:      value === opt.value ? '#84CC16'   : '#606060',
              border:     value === opt.value ? '1px solid #84CC1655' : '1px solid #2E2E2E',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HikeBuilderProps {
  data: HikeData
  onChange: (d: HikeData) => void
}

export default function HikeBuilder({ data, onChange }: HikeBuilderProps) {
  const km   = parseFloat(data.distanceKm) || 0
  const elev = parseFloat(data.elevationGainM) || 0

  const naismithMins = naismith(km, elev)
  const factor       = correctionFactor(data.settings)
  const correctedMins = naismithMins * factor
  const correctionPct   = Math.round((factor - 1) * 100)
  const correctionLabel = correctionPct >= 0 ? `+${correctionPct}%` : `${correctionPct}%`

  const hasData = km > 0 || elev > 0

  function updateSettings(patch: Partial<HikeSettings>) {
    onChange({ ...data, settings: { ...data.settings, ...patch } })
  }

  const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm outline-none"
  const inputSty: React.CSSProperties = {
    background: '#242424', border: '1px solid #2E2E2E',
    color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace',
  }

  return (
    <div className="space-y-5">

      {/* ── Distance & Elevation inputs ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
            Distance
          </label>
          <div className="relative">
            <input
              type="number" inputMode="decimal" placeholder="0" min="0" step="0.1"
              value={data.distanceKm}
              onChange={e => onChange({ ...data, distanceKm: e.target.value })}
              className={inputCls}
              style={{ ...inputSty, paddingRight: '40px' }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>km</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
            Elevation Gain
          </label>
          <div className="relative">
            <input
              type="number" inputMode="numeric" placeholder="0" min="0"
              value={data.elevationGainM}
              onChange={e => onChange({ ...data, elevationGainM: e.target.value })}
              className={inputCls}
              style={{ ...inputSty, paddingRight: '36px' }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>m</span>
          </div>
        </div>
      </div>

      {/* ── TrailsNH-style settings ── */}
      <div className="space-y-3 p-4 rounded-xl" style={{ background: '#1E1E1E', border: '1px solid #2E2E2E' }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#84CC16', fontFamily: 'Inter, sans-serif' }}>
          TrailsNH Correction
        </p>
        <ToggleGroup
          label="Intended Pace"
          value={data.settings.pace}
          onChange={v => updateSettings({ pace: v })}
          options={[
            { value: 'slow',   label: 'Slow'   },
            { value: 'normal', label: 'Normal' },
            { value: 'fast',   label: 'Fast'   },
            { value: 'run',    label: 'Run'    },
          ]}
        />
        <ToggleGroup
          label="Trail Surface"
          value={data.settings.surface}
          onChange={v => updateSettings({ surface: v })}
          options={[
            { value: 'easy',  label: 'Easy'  },
            { value: 'good',  label: 'Good'  },
            { value: 'rough', label: 'Rough' },
            { value: 'tough', label: 'Tough' },
          ]}
        />
        <ToggleGroup
          label="Pack Weight"
          value={data.settings.packWeight}
          onChange={v => updateSettings({ packWeight: v })}
          options={[
            { value: 'light',      label: 'Light'      },
            { value: 'regular',    label: 'Regular'    },
            { value: 'heavy',      label: 'Heavy'      },
            { value: 'very-heavy', label: 'Very Heavy' },
          ]}
        />
        <p className="text-xs" style={{ color: '#84CC16', fontFamily: 'Inter, sans-serif' }}>
          Correction Factor: <strong>{correctionLabel}</strong>
        </p>
      </div>

      {/* ── Estimates ── */}
      {hasData && (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#F5F5F5', fontFamily: 'Montserrat, sans-serif' }}>
            Estimates
          </p>
          <p className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
            Hike: <strong style={{ color: '#A0A0A0' }}>{data.distanceKm || '0'} km</strong>,{' '}
            <strong style={{ color: '#A0A0A0' }}>{data.elevationGainM || '0'} m</strong> vertical gain
          </p>

          {/* Naismith */}
          <div className="p-4 rounded-xl space-y-1" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#00BFA5' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: '#00BFA5', fontFamily: 'Inter, sans-serif' }}>Naismith&apos;s Rule</span>
              <span className="text-lg font-black ml-auto" style={{ color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace' }}>{fmtMins(correctedMins)}</span>
            </div>
            <p className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Pace: <span style={{ color: '#A0A0A0' }}>{fmtPace(km, correctedMins)}</span></p>
            <p className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Speed: <span style={{ color: '#A0A0A0' }}>{fmtSpeed(km, correctedMins)}</span></p>
          </div>
        </div>
      )}
    </div>
  )
}
