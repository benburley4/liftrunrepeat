'use client'

import { useState, useEffect } from 'react'

const runTypes = ['Easy', 'Tempo', 'Intervals', 'Long', 'Recovery', 'Hills']
const terrainOptions = ['Road', 'Trail', 'Track', 'Treadmill']

function parseTime(timeStr: string): number | null {
  const parts = timeStr.split(':')
  if (parts.length === 2) {
    const m = parseInt(parts[0])
    const s = parseInt(parts[1])
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s
  }
  return null
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function calcVdot(distanceMiles: number, timeSeconds: number): number {
  // Simplified Daniel's VDOT estimation
  const velocity = distanceMiles * 1609.34 / timeSeconds // meters per second
  const pct = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeSeconds / 60) +
    0.2989558 * Math.exp(-0.1932605 * timeSeconds / 60)
  const vo2 = -4.60 + 0.182258 * velocity * 60 + 0.000104 * Math.pow(velocity * 60, 2)
  return Math.round(vo2 / pct * 10) / 10
}

export default function RunLogger() {
  const [runType, setRunType] = useState('Easy')
  const [distance, setDistance] = useState('')
  const [time, setTime] = useState('')
  const [hr, setHr] = useState('')
  const [terrain, setTerrain] = useState('Road')
  const [effort, setEffort] = useState(5)
  const [unit, setUnit] = useState<'mi' | 'km'>('km')

  const distanceVal = parseFloat(distance)
  const timeVal = parseTime(time)
  const distanceMiles = unit === 'km' ? distanceVal / 1.60934 : distanceVal

  let pace = ''
  if (!isNaN(distanceMiles) && distanceMiles > 0 && timeVal !== null && timeVal > 0) {
    const secPerMile = timeVal / distanceMiles
    const secPerKm = timeVal / (distanceMiles * 1.60934)
    const paceVal = unit === 'km' ? secPerKm : secPerMile
    pace = formatTime(Math.round(paceVal))
  }

  const vdot =
    !isNaN(distanceMiles) && distanceMiles >= 1 && timeVal !== null && timeVal > 60
      ? calcVdot(distanceMiles, timeVal)
      : null

  const effortColors = [
    '#606060', '#4CAF50', '#4CAF50', '#8BC34A', '#CDDC39',
    '#FFEB3B', '#FFC107', '#FF9800', '#C8102E', '#F44336', '#E91E63',
  ]

  return (
    <div className="space-y-5">
      {/* Run type */}
      <div>
        <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#606060' }}>
          Run Type
        </label>
        <div className="flex flex-wrap gap-2">
          {runTypes.map(rt => (
            <button
              key={rt}
              onClick={() => setRunType(rt)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: runType === rt ? 'rgba(255,107,53,0.15)' : '#242424',
                color: runType === rt ? '#C8102E' : '#A0A0A0',
                border: runType === rt ? '1px solid rgba(255,107,53,0.4)' : '1px solid #2E2E2E',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {rt}
            </button>
          ))}
        </div>
      </div>

      {/* Unit toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs" style={{ color: '#606060' }}>Unit:</span>
        <div className="flex rounded overflow-hidden" style={{ border: '1px solid #2E2E2E' }}>
          {(['mi', 'km'] as const).map(u => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className="px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: unit === u ? '#C8102E' : '#1A1A1A',
                color: unit === u ? '#0D0D0D' : '#A0A0A0',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Distance / Time / Pace */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>
            Distance ({unit})
          </label>
          <input
            type="number"
            step="0.1"
            value={distance}
            onChange={e => setDistance(e.target.value)}
            placeholder="6.2"
            className="w-full px-3 py-2.5 rounded text-sm outline-none text-center"
            style={{
              background: '#242424',
              color: '#F5F5F5',
              border: '1px solid #2E2E2E',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>
            Time (mm:ss)
          </label>
          <input
            type="text"
            value={time}
            onChange={e => setTime(e.target.value)}
            placeholder="55:20"
            className="w-full px-3 py-2.5 rounded text-sm outline-none text-center"
            style={{
              background: '#242424',
              color: '#F5F5F5',
              border: '1px solid #2E2E2E',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>
            Avg Pace
          </label>
          <div
            className="w-full px-3 py-2.5 rounded text-sm text-center"
            style={{
              background: '#1A1A1A',
              color: pace ? '#C8102E' : '#606060',
              border: '1px solid #2E2E2E',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {pace || '—'}<span className="text-xs ml-1" style={{ color: '#606060' }}>/{ unit}</span>
          </div>
        </div>
      </div>

      {/* HR + Terrain */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>
            Avg HR (optional)
          </label>
          <input
            type="number"
            value={hr}
            onChange={e => setHr(e.target.value)}
            placeholder="148"
            className="w-full px-3 py-2.5 rounded text-sm outline-none"
            style={{
              background: '#242424',
              color: '#F5F5F5',
              border: '1px solid #2E2E2E',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: '#606060' }}>
            Terrain
          </label>
          <div className="flex gap-1 flex-wrap">
            {terrainOptions.map(t => (
              <button
                key={t}
                onClick={() => setTerrain(t)}
                className="px-2.5 py-2 rounded text-xs font-medium flex-1"
                style={{
                  background: terrain === t ? 'rgba(255,107,53,0.15)' : '#242424',
                  color: terrain === t ? '#C8102E' : '#A0A0A0',
                  border: terrain === t ? '1px solid rgba(255,107,53,0.3)' : '1px solid #2E2E2E',
                  fontFamily: 'Inter, sans-serif',
                  minWidth: '50px',
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Perceived effort */}
      <div>
        <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#606060' }}>
          Perceived Effort — <span style={{ color: effortColors[effort], fontFamily: 'JetBrains Mono, monospace' }}>{effort}/10</span>
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={effort}
          onChange={e => setEffort(parseInt(e.target.value))}
          className="w-full accent-orange"
          style={{ accentColor: '#C8102E' }}
        />
        <div className="flex justify-between text-xs mt-1" style={{ color: '#606060' }}>
          <span>Easy</span>
          <span>Moderate</span>
          <span>Max Effort</span>
        </div>
      </div>

      {/* VDOT estimate */}
      {vdot && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider" style={{ color: '#606060' }}>VDOT Estimate</p>
              <p className="text-3xl font-bold" style={{ color: '#C8102E', fontFamily: 'JetBrains Mono, monospace' }}>
                {vdot}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={{ color: '#A0A0A0' }}>Based on {distance} {unit} @ {pace}/{unit}</p>
              <p className="text-xs mt-1" style={{ color: '#606060' }}>
                {vdot >= 55 ? 'Elite / Sub-elite' : vdot >= 45 ? 'Advanced' : vdot >= 38 ? 'Intermediate' : 'Developing'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
