'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRight, GitCompare } from 'lucide-react'
import { RANGES, type RangeId } from '@/lib/progressRange'
import { TABS, type TabId } from './types'

/**
 * Sticky tab bar with the page-wide date range and "compare to previous
 * period" toggle. On narrow screens the tabs scroll sideways; a fade and
 * arrow show there is more, and the active tab scrolls into view.
 */
export default function TabBar({ active, onTab, range, onRange, compare, onCompare, showRange }: {
  active: TabId
  onTab: (t: TabId) => void
  range: RangeId
  onRange: (r: RangeId) => void
  compare: boolean
  onCompare: (v: boolean) => void
  showRange: boolean
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => setMore(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update) }
  }, [])

  useEffect(() => {
    scroller.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [active])

  return (
    <div className="sticky top-16 z-30" style={{ background: 'rgba(13,13,13,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1A1A1A' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="relative">
          <div ref={scroller} className="analytics-tabs" role="tablist" aria-label="Progress sections">
            {TABS.map(tab => {
              const on = active === tab.id
              return (
                <button key={tab.id} data-tab={tab.id} role="tab" aria-selected={on} id={`tab-${tab.id}`} aria-controls="progress-panel"
                  onClick={() => onTab(tab.id)}
                  className="px-4 py-4 text-sm font-medium transition-colors relative"
                  style={{ color: on ? '#F5F5F5' : '#8A8A8A', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  {tab.label}
                  {on && <span className="absolute bottom-0 left-0 right-0 h-0.5 lrr-underline" style={{ background: '#00BFA5' }} />}
                </button>
              )
            })}
          </div>
          {more && (
            <button type="button" aria-label="Scroll tabs right"
              onClick={() => scroller.current?.scrollBy({ left: 180, behavior: 'smooth' })}
              className="absolute right-0 top-0 bottom-0 flex items-center pl-8 pr-1"
              style={{ background: 'linear-gradient(90deg, rgba(13,13,13,0), rgba(13,13,13,0.95) 55%)', color: '#A0A0A0', cursor: 'pointer' }}>
              <ChevronRight size={16} className="lrr-nudge" />
            </button>
          )}
        </div>
        {showRange && (
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <div className="flex rounded-lg overflow-hidden" role="group" aria-label="Date range" style={{ border: '1px solid #2E2E2E' }}>
              {RANGES.map(r => {
                const on = r.id === range
                return (
                  <button key={r.id} type="button" aria-pressed={on} onClick={() => onRange(r.id)}
                    className="px-3 py-1.5 text-xs font-semibold transition-colors"
                    style={{ background: on ? '#00BFA5' : '#141414', color: on ? '#0D0D0D' : '#A0A0A0', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {r.label}
                  </button>
                )
              })}
            </div>
            <button type="button" aria-pressed={compare} disabled={range === 'all'} onClick={() => onCompare(!compare)}
              title={range === 'all' ? 'Not available for all time' : 'Show the previous period behind each chart'}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
              style={{
                background: compare && range !== 'all' ? 'rgba(167,139,250,0.15)' : '#141414',
                border: `1px solid ${compare && range !== 'all' ? 'rgba(167,139,250,0.5)' : '#2E2E2E'}`,
                color: range === 'all' ? '#5A5A5A' : compare ? '#A78BFA' : '#A0A0A0', cursor: range === 'all' ? 'not-allowed' : 'pointer',
              }}>
              <GitCompare size={13} aria-hidden="true" /> Compare to previous
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
