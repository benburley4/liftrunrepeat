'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HikeSectionType = 'ascent' | 'descent' | 'flat' | 'rest'

export interface HikeSection {
  id: string
  type: HikeSectionType
  name: string
  distanceKm: string   // km — used for ascent, descent, flat
  elevationM: string   // metres gain (ascent) or loss (descent)
  restMins: string     // minutes — used for rest only
}

export interface HikeSettings {
  pace:       'slow' | 'normal' | 'fast'
  surface:    'easy' | 'good' | 'rough' | 'tough'
  packWeight: 'light' | 'regular' | 'heavy' | 'very-heavy'
}

// ─── Naismith's Rule (metric) ─────────────────────────────────────────────────
// Base: 12 min/km (5 km/hr)
// Ascent: +1 min per 10 m elevation gain
// Descent: +0.5 min per 10 m elevation loss (Tranter's correction for steep ground)

const PACE_MULT:    Record<HikeSettings['pace'],       number> = { slow: 1.35, normal: 1.0, fast: 0.8 }
const SURFACE_MULT: Record<HikeSettings['surface'],    number> = { easy: 1.0, good: 1.1, rough: 1.25, tough: 1.5 }
const PACK_MULT:    Record<HikeSettings['packWeight'], number> = { light: 1.0, regular: 1.05, heavy: 1.15, 'very-heavy': 1.3 }

function calcSectionMins(section: HikeSection, settings: HikeSettings): number {
  const mult = PACE_MULT[settings.pace] * SURFACE_MULT[settings.surface] * PACK_MULT[settings.packWeight]
  if (section.type === 'rest') return parseFloat(section.restMins) || 0
  const km  = parseFloat(section.distanceKm) || 0
  const elv = parseFloat(section.elevationM) || 0
  const base = km * 12
  const elvMins = section.type === 'ascent'  ? (elv / 10)
                : section.type === 'descent' ? (elv / 20)
                : 0
  return (base + elvMins) * mult
}

function fmtMins(total: number): string {
  if (total <= 0) return '—'
  const h = Math.floor(total / 60)
  const m = Math.round(total % 60)
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m`
}

function uid() { return `${Date.now()}-${Math.random()}` }

function makeSection(type: HikeSectionType = 'ascent'): HikeSection {
  return { id: uid(), type, name: '', distanceKm: '', elevationM: '', restMins: '' }
}

// ─── Colours ──────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<HikeSectionType, { label: string; color: string }> = {
  ascent:  { label: 'Ascent',  color: '#EF4444' },
  descent: { label: 'Descent', color: '#3B82F6' },
  flat:    { label: 'Flat',    color: '#A0A0A0' },
  rest:    { label: 'Rest',    color: '#F59E0B' },
}

const inputStyle: React.CSSProperties = {
  background: '#0D0D0D', border: '1px solid #2E2E2E',
  color: '#F5F5F5', fontFamily: 'JetBrains Mono, monospace', outline: 'none',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: 'pointer',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface HikeBuilderProps {
  sections: HikeSection[]
  settings: HikeSettings
  onChangeSections: (s: HikeSection[]) => void
  onChangeSettings: (s: HikeSettings) => void
}

export default function HikeBuilder({ sections, settings, onChangeSections, onChangeSettings }: HikeBuilderProps) {
  function addSection(type: HikeSectionType) {
    onChangeSections([...sections, makeSection(type)])
  }

  function updateSection(id: string, patch: Partial<HikeSection>) {
    onChangeSections(sections.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  function removeSection(id: string) {
    onChangeSections(sections.filter(s => s.id !== id))
  }

  const totalMins = sections.reduce((sum, s) => sum + calcSectionMins(s, settings), 0)
  const totalKm   = sections.filter(s => s.type !== 'rest').reduce((sum, s) => sum + (parseFloat(s.distanceKm) || 0), 0)
  const totalGain = sections.filter(s => s.type === 'ascent').reduce((sum, s)  => sum + (parseFloat(s.elevationM) || 0), 0)
  const totalLoss = sections.filter(s => s.type === 'descent').reduce((sum, s) => sum + (parseFloat(s.elevationM) || 0), 0)

  return (
    <div className="space-y-3">

      {/* ── Settings ── */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-xl" style={{ background: '#242424', border: '1px solid #2E2E2E' }}>
        {([
          { key: 'pace' as const,       label: 'Pace',         opts: [['slow','Slow'],['normal','Normal'],['fast','Fast']] },
          { key: 'surface' as const,    label: 'Trail Surface', opts: [['easy','Easy'],['good','Good'],['rough','Rough'],['tough','Tough']] },
          { key: 'packWeight' as const, label: 'Pack Weight',   opts: [['light','Light'],['regular','Regular'],['heavy','Heavy'],['very-heavy','Very Heavy']] },
        ] as const).map(({ key, label, opts }) => (
          <div key={key}>
            <label className="text-xs block mb-1" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>{label}</label>
            <select
              value={settings[key]}
              onChange={e => onChangeSettings({ ...settings, [key]: e.target.value })}
              className="w-full px-2 py-1.5 rounded-lg text-xs"
              style={selectStyle}
            >
              {opts.map(([val, lbl]) => <option key={val} value={val}>{lbl}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* ── Sections ── */}
      {sections.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>
          Add sections below to build your hike
        </p>
      )}

      {sections.map(section => {
        const cfg     = TYPE_CONFIG[section.type]
        const mins    = calcSectionMins(section, settings)
        const isRest  = section.type === 'rest'
        const hasElev = section.type === 'ascent' || section.type === 'descent'

        return (
          <div key={section.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${cfg.color}33`, background: `${cfg.color}08` }}>
            {/* Header row */}
            <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${cfg.color}22` }}>
              <select
                value={section.type}
                onChange={e => updateSection(section.id, { type: e.target.value as HikeSectionType })}
                className="px-2 py-1 rounded text-xs font-bold"
                style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}44`, fontFamily: 'Inter, sans-serif', outline: 'none', cursor: 'pointer' }}
              >
                {Object.entries(TYPE_CONFIG).map(([val, { label }]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Section name (optional)"
                value={section.name}
                onChange={e => updateSection(section.id, { name: e.target.value })}
                className="flex-1 px-2 py-1 rounded text-xs"
                style={{ ...inputStyle, background: 'transparent', border: '1px solid #2E2E2E' }}
              />
              {mins > 0 && (
                <span className="text-xs font-bold flex-shrink-0" style={{ color: cfg.color, fontFamily: 'JetBrains Mono, monospace' }}>
                  {fmtMins(mins)}
                </span>
              )}
              <button onClick={() => removeSection(section.id)} className="p-1 rounded" style={{ color: '#606060' }}>
                <Trash2 size={12} />
              </button>
            </div>

            {/* Inputs */}
            <div className="flex flex-wrap gap-3 px-3 py-2.5">
              {isRest ? (
                <div className="flex items-center gap-1.5">
                  <label className="text-xs flex-shrink-0" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Duration</label>
                  <input
                    type="number" inputMode="numeric" placeholder="—" min="0"
                    value={section.restMins}
                    onChange={e => updateSection(section.id, { restMins: e.target.value })}
                    className="px-2 py-1.5 rounded-lg text-sm text-center"
                    style={{ ...inputStyle, width: '64px' }}
                  />
                  <span className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>min</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs flex-shrink-0" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>Distance</label>
                    <input
                      type="number" inputMode="decimal" placeholder="—" min="0" step="0.1"
                      value={section.distanceKm}
                      onChange={e => updateSection(section.id, { distanceKm: e.target.value })}
                      className="px-2 py-1.5 rounded-lg text-sm text-center"
                      style={{ ...inputStyle, width: '72px' }}
                    />
                    <span className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>km</span>
                  </div>
                  {hasElev && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs flex-shrink-0" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>
                        {section.type === 'ascent' ? 'Gain' : 'Loss'}
                      </label>
                      <input
                        type="number" inputMode="numeric" placeholder="—" min="0"
                        value={section.elevationM}
                        onChange={e => updateSection(section.id, { elevationM: e.target.value })}
                        className="px-2 py-1.5 rounded-lg text-sm text-center"
                        style={{ ...inputStyle, width: '72px' }}
                      />
                      <span className="text-xs" style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}>m</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}

      {/* ── Add buttons ── */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(TYPE_CONFIG) as [HikeSectionType, { label: string; color: string }][]).map(([type, { label, color }]) => (
          <button
            key={type}
            onClick={() => addSection(type)}
            className="flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
            style={{ background: `${color}15`, color, border: `1px dashed ${color}44`, fontFamily: 'Inter, sans-serif' }}
          >
            <Plus size={10} /> {label}
          </button>
        ))}
      </div>

      {/* ── Totals ── */}
      {sections.length > 0 && (
        <div className="grid grid-cols-4 gap-2 px-1 pt-1" style={{ borderTop: '1px solid #2E2E2E' }}>
          {[
            { label: 'Est. Time',  value: fmtMins(totalMins), color: totalMins > 0 ? '#C8102E' : '#3E3E3E' },
            { label: 'Distance',   value: totalKm > 0 ? `${totalKm % 1 === 0 ? totalKm : totalKm.toFixed(1)} km` : '—', color: totalKm > 0 ? '#C8102E' : '#3E3E3E' },
            { label: 'Elev Gain',  value: totalGain > 0 ? `${totalGain} m` : '—', color: totalGain > 0 ? '#EF4444' : '#3E3E3E' },
            { label: 'Elev Loss',  value: totalLoss > 0 ? `${totalLoss} m` : '—', color: totalLoss > 0 ? '#3B82F6' : '#3E3E3E' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <span className="text-xs" style={{ color: '#3E3E3E', fontFamily: 'Inter, sans-serif' }}>{label}</span>
              <span className="text-xs font-bold" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
