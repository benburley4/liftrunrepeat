// Renders the weekly summary as a 1080×1080 PNG (canvas, no libraries) for
// saving or sharing to social apps.

import type { WeekSummary, ActivityKind } from '@/lib/progressData'
import { ACTIVITY_COLORS, ACTIVITY_LABELS, fmtTonnes } from './progressStyle'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function fontFamily(varName: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return v ? `${v}, ${fallback}` : fallback
}

export async function renderWeekImage(week: WeekSummary, title: string): Promise<Blob> {
  const S = 1080
  const canvas = document.createElement('canvas')
  canvas.width = S; canvas.height = S
  const ctx = canvas.getContext('2d')!
  const heading = fontFamily('--font-montserrat', 'Arial Black, sans-serif')
  const sans = fontFamily('--font-inter', 'Arial, sans-serif')
  const mono = fontFamily('--font-jetbrains-mono', 'Courier New, monospace')
  await document.fonts?.ready

  ctx.fillStyle = '#0D0D0D'; ctx.fillRect(0, 0, S, S)
  const glow = ctx.createRadialGradient(S * 0.85, S * 0.1, 10, S * 0.85, S * 0.1, S * 0.7)
  glow.addColorStop(0, 'rgba(0,191,165,0.18)'); glow.addColorStop(1, 'rgba(0,191,165,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, S, S)

  // Wordmark
  ctx.textBaseline = 'alphabetic'
  ctx.font = `900 40px ${heading}`
  let x = 80
  for (const [word, color] of [['LIFT', ACTIVITY_COLORS.lift], ['RUN', ACTIVITY_COLORS.run], ['REPEAT', '#F5F5F5']] as const) {
    ctx.fillStyle = color; ctx.fillText(word, x, 130); x += ctx.measureText(word).width + 6
  }
  ctx.fillStyle = '#8A8A8A'; ctx.font = `600 28px ${sans}`
  ctx.fillText('WEEKLY SUMMARY', 80, 180)
  ctx.fillStyle = '#F5F5F5'; ctx.font = `900 72px ${heading}`
  ctx.fillText(title.toUpperCase(), 80, 270)

  // Stat tiles
  const tiles = [
    { label: 'SESSIONS', value: String(week.sessions), color: '#F5F5F5' },
    { label: 'LIFTED', value: week.liftKg ? fmtTonnes(week.liftKg) : '–', color: ACTIVITY_COLORS.lift },
    { label: 'ON FOOT', value: week.km ? `${week.km} km` : '–', color: ACTIVITY_COLORS.run },
    { label: 'CLIMBED', value: week.climb ? `${week.climb} m` : '–', color: ACTIVITY_COLORS.hike },
  ]
  const tw = (S - 160 - 3 * 24) / 4
  tiles.forEach((t, i) => {
    const tx = 80 + i * (tw + 24), ty = 330
    ctx.fillStyle = '#1A1A1A'; roundRect(ctx, tx, ty, tw, 170, 24); ctx.fill()
    ctx.strokeStyle = '#2E2E2E'; ctx.lineWidth = 2; ctx.stroke()
    ctx.fillStyle = '#8A8A8A'; ctx.font = `600 22px ${sans}`; ctx.fillText(t.label, tx + 24, ty + 50)
    ctx.fillStyle = t.color; ctx.font = `700 ${t.value.length > 6 ? 40 : 52}px ${mono}`; ctx.fillText(t.value, tx + 24, ty + 125)
  })

  // Day dots
  ctx.fillStyle = '#8A8A8A'; ctx.font = `600 22px ${sans}`; ctx.fillText('THE WEEK', 80, 590)
  const dw = (S - 160) / 7
  week.days.forEach((k, i) => {
    const cx = 80 + dw * i + dw / 2, cy = 680
    ctx.beginPath(); ctx.arc(cx, cy, 46, 0, Math.PI * 2)
    ctx.fillStyle = k ? ACTIVITY_COLORS[k] : '#1F1F1F'; ctx.fill()
    if (!k) { ctx.strokeStyle = '#2E2E2E'; ctx.lineWidth = 2; ctx.stroke() }
    ctx.fillStyle = k ? '#0D0D0D' : '#5A5A5A'; ctx.font = `800 22px ${sans}`; ctx.textAlign = 'center'
    ctx.fillText(DAYS[i], cx, cy + 8)
    ctx.textAlign = 'left'
  })

  // Legend for kinds present
  const kinds = [...new Set(week.days.filter((k): k is ActivityKind => !!k))]
  let lx = 80
  ctx.font = `500 22px ${sans}`
  for (const k of kinds) {
    ctx.fillStyle = ACTIVITY_COLORS[k]; ctx.beginPath(); ctx.arc(lx + 9, 780, 9, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#A0A0A0'; ctx.fillText(ACTIVITY_LABELS[k], lx + 26, 788)
    lx += 40 + ctx.measureText(ACTIVITY_LABELS[k]).width + 24
  }

  // Records
  ctx.fillStyle = '#8A8A8A'; ctx.font = `600 22px ${sans}`; ctx.fillText('NEW RECORDS', 80, 860)
  if (!week.records.length) {
    ctx.fillStyle = '#5A5A5A'; ctx.font = `500 28px ${sans}`; ctx.fillText('Banked the work. Records come next.', 80, 905)
  } else {
    week.records.slice(0, 2).forEach((r, i) => {
      ctx.fillStyle = r.kind === 'lift' ? ACTIVITY_COLORS.lift : ACTIVITY_COLORS.run
      ctx.font = `700 30px ${sans}`; ctx.fillText(`${r.name}`, 80, 905 + i * 46)
      const w = ctx.measureText(`${r.name}`).width
      ctx.fillStyle = '#F5F5F5'; ctx.font = `500 28px ${mono}`; ctx.fillText(`  ${r.value}  +${r.pct}%`, 80 + w, 905 + i * 46)
    })
    if (week.records.length > 2) { ctx.fillStyle = '#8A8A8A'; ctx.font = `500 24px ${sans}`; ctx.fillText(`+${week.records.length - 2} more`, 80, 995) }
  }

  ctx.fillStyle = '#5A5A5A'; ctx.font = `500 22px ${sans}`; ctx.textAlign = 'right'
  ctx.fillText('liftrunrepeat.org', S - 80, S - 50)

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png'))
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Share the PNG with the OS share sheet when supported, else download it. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], title: 'My training week' }); return 'shared' }
    catch (e) { if ((e as Error).name === 'AbortError') return 'shared' /* user closed the sheet */ }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
