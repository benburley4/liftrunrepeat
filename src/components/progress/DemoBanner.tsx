'use client'

import Link from 'next/link'
import { Eye } from 'lucide-react'

/** Shown above the Progress dashboard when a signed-out visitor sees the sample athlete. */
export default function DemoBanner() {
  return (
    <div className="rounded-xl px-5 py-4 mb-6 flex flex-wrap items-center gap-4 lrr-reveal"
      style={{ background: 'linear-gradient(90deg, rgba(0,191,165,0.12), rgba(200,16,46,0.10))', border: '1px solid rgba(0,191,165,0.3)' }}>
      <Eye size={20} style={{ color: '#00BFA5', flexShrink: 0 }} aria-hidden="true" />
      <div className="flex-1 min-w-[220px]">
        <p className="text-sm font-black uppercase" style={{ color: '#F5F5F5', fontFamily: 'var(--font-heading)' }}>You&apos;re looking at a demo</p>
        <p className="text-xs mt-0.5" style={{ color: '#A0A0A0' }}>
          This is a sample hybrid athlete&apos;s year of lifting, running and hiking. Everything is clickable. Sign up free to track your own.
        </p>
      </div>
      <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-bold shrink-0" style={{ background: '#00BFA5', color: '#0D0D0D' }}>
        Start tracking free
      </Link>
    </div>
  )
}
