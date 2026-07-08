'use client'

import { ReactNode } from 'react'

/**
 * Standard section heading: coloured eyebrow label + fluid black-caps title
 * (+ optional supporting copy). Sizes via the .section-title clamp classes.
 */
export default function SectionHeading({
  eyebrow,
  eyebrowColor = '#00BFA5',
  title,
  sub,
  align = 'left',
  large = false,
  className = '',
}: {
  eyebrow?: string
  eyebrowColor?: string
  title: ReactNode
  sub?: ReactNode
  align?: 'left' | 'center'
  large?: boolean
  className?: string
}) {
  const centered = align === 'center'
  return (
    <div className={`${centered ? 'text-center' : ''} ${className}`}>
      {eyebrow && (
        <p
          className="text-xs uppercase tracking-widest mb-2"
          style={{ color: eyebrowColor, fontFamily: 'var(--font-sans)' }}
        >
          {eyebrow}
        </p>
      )}
      <h2 className={`section-title ${large ? 'section-title-lg' : ''} mb-4`}>{title}</h2>
      {sub && (
        <p
          className={`text-lg ${centered ? 'max-w-2xl mx-auto' : 'max-w-2xl'}`}
          style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}
        >
          {sub}
        </p>
      )}
    </div>
  )
}
