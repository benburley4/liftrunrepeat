'use client'

import { useEffect, useRef, useState } from 'react'

const WEEKS = 12
const KM = [22, 26, 30, 36, 42, 47, 55, 61, 58, 44, 36, 28] // weekly km bars
const RM = [128, 132, 136, 140, 145, 149, 149, 147, 149, 154, 158, 161] // squat 1RM line
const ZONE: [number, number] = [7, 9] // interference weeks (1-based, inclusive)

const W = 480
const H = 190
const PAD_L = 34
const PAD_R = 34
const PAD_T = 10
const PAD_B = 22
const plotW = W - PAD_L - PAD_R
const plotH = H - PAD_T - PAD_B

const kmMax = 70
const rmMin = 120
const rmMax = 170

function xCenter(i: number) {
  return PAD_L + (plotW / WEEKS) * (i + 0.5)
}
function yKm(v: number) {
  return PAD_T + plotH * (1 - v / kmMax)
}
function yRm(v: number) {
  return PAD_T + plotH * (1 - (v - rmMin) / (rmMax - rmMin))
}

/**
 * The signature "interference" chart: weekly running km (crimson bars) vs
 * squat 1RM (teal line) on a shared 12-week axis, with the interference
 * window highlighted. Animates in when scrolled into view.
 */
export default function InterferenceChart({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimate(true)
          observer.disconnect()
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const barW = (plotW / WEEKS) * 0.55
  const linePoints = RM.map((v, i) => `${xCenter(i)},${yRm(v)}`).join(' ')
  const zoneX = PAD_L + (plotW / WEEKS) * (ZONE[0] - 1)
  const zoneW = (plotW / WEEKS) * (ZONE[1] - ZONE[0] + 1)
  const gridKm = [20, 40, 60]

  return (
    <div ref={ref} className={`${animate ? 'chart-animate' : ''} ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img"
        aria-label="12-week trend: squat 1RM rises from 128 to 161 kg but stalls in weeks 7 to 9 while weekly running peaks at 61 km">
        {/* Interference zone band */}
        <rect x={zoneX} y={PAD_T} width={zoneW} height={plotH} fill="rgba(200,16,46,0.09)" />
        <line x1={zoneX} y1={PAD_T} x2={zoneX} y2={PAD_T + plotH} stroke="rgba(200,16,46,0.35)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1={zoneX + zoneW} y1={PAD_T} x2={zoneX + zoneW} y2={PAD_T + plotH} stroke="rgba(200,16,46,0.35)" strokeWidth="1" strokeDasharray="3 3" />
        <text x={zoneX + zoneW / 2} y={PAD_T + 12} textAnchor="middle" fontSize="8" fill="#C8102E" fontFamily="var(--font-mono)" letterSpacing="0.08em">
          INTERFERENCE
        </text>

        {/* Gridlines + left axis (km) */}
        {gridKm.map(v => (
          <g key={v}>
            <line x1={PAD_L} y1={yKm(v)} x2={W - PAD_R} y2={yKm(v)} stroke="#242424" strokeWidth="1" />
            <text x={PAD_L - 6} y={yKm(v) + 3} textAnchor="end" fontSize="8" fill="#8A8A8A" fontFamily="var(--font-mono)">{v}km</text>
          </g>
        ))}

        {/* Right axis (kg) */}
        {[130, 145, 160].map(v => (
          <text key={v} x={W - PAD_R + 6} y={yRm(v) + 3} textAnchor="start" fontSize="8" fill="#8A8A8A" fontFamily="var(--font-mono)">{v}kg</text>
        ))}

        {/* Baseline */}
        <line x1={PAD_L} y1={PAD_T + plotH} x2={W - PAD_R} y2={PAD_T + plotH} stroke="#2E2E2E" strokeWidth="1" />

        {/* Km bars */}
        {KM.map((v, i) => (
          <rect
            key={i}
            className="chart-bar"
            x={xCenter(i) - barW / 2}
            y={yKm(v)}
            width={barW}
            height={PAD_T + plotH - yKm(v)}
            rx="1.5"
            fill="#C8102E"
            opacity="0.45"
            style={{ animationDelay: `${i * 60}ms`, transformBox: 'fill-box' }}
          />
        ))}

        {/* 1RM line */}
        <polyline
          className="chart-line"
          points={linePoints}
          fill="none"
          stroke="#00BFA5"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {RM.map((v, i) => (
          <circle
            key={i}
            className="chart-dot"
            cx={xCenter(i)}
            cy={yRm(v)}
            r="2.5"
            fill="#0D0D0D"
            stroke="#00BFA5"
            strokeWidth="1.5"
            style={{ animationDelay: `${300 + i * 110}ms` }}
          />
        ))}

        {/* Week labels */}
        {Array.from({ length: WEEKS }, (_, i) => (
          <text key={i} x={xCenter(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="#606060" fontFamily="var(--font-mono)">
            W{i + 1}
          </text>
        ))}
      </svg>
    </div>
  )
}
