'use client'

import { CSSProperties, ReactNode } from 'react'

/**
 * Standard surface card. `tint` renders the translucent accent-glow variant
 * (pass a hex accent like '#00BFA5'); otherwise a plain dark surface.
 */
export default function Card({
  children,
  tint,
  elevated = false,
  padding = 'md',
  className = '',
  style,
}: {
  children: ReactNode
  tint?: string
  elevated?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  className?: string
  style?: CSSProperties
}) {
  const pad = { none: '', sm: 'p-3', md: 'p-5', lg: 'p-8' }[padding]
  const base: CSSProperties = tint
    ? { background: `${tint}0F`, border: `1px solid ${tint}26` }
    : {
        background: elevated ? '#1E1E1E' : '#141414',
        border: '1px solid #2E2E2E',
      }
  return (
    <div className={`rounded-2xl ${pad} ${className}`} style={{ ...base, ...style }}>
      {children}
    </div>
  )
}
