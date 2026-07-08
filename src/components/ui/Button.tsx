'use client'

import Link from 'next/link'
import { CSSProperties, MouseEventHandler, ReactNode } from 'react'

type Variant = 'solid' | 'ghost' | 'subtle'
type Size = 'sm' | 'md' | 'lg'

/**
 * Shared button. Renders a Next <Link> when `href` is given, otherwise a
 * <button>. All variants get consistent hover/active feedback.
 */
export default function Button({
  children,
  href,
  onClick,
  variant = 'solid',
  accent = '#00BFA5',
  size = 'md',
  disabled = false,
  fullWidth = false,
  className = '',
  ariaLabel,
}: {
  children: ReactNode
  href?: string
  onClick?: MouseEventHandler
  variant?: Variant
  accent?: string
  size?: Size
  disabled?: boolean
  fullWidth?: boolean
  className?: string
  ariaLabel?: string
}) {
  const sizes: Record<Size, string> = {
    sm: 'px-4 py-2 text-xs rounded-lg',
    md: 'px-6 py-3 text-sm rounded-xl',
    lg: 'px-7 py-4 text-base rounded-xl',
  }
  const styles: Record<Variant, CSSProperties> = {
    solid: { background: accent, color: '#0D0D0D', border: 'none' },
    ghost: { background: 'transparent', color: accent, border: `2px solid ${accent}` },
    subtle: { background: '#242424', color: '#F5F5F5', border: '1px solid #2E2E2E' },
  }
  const style: CSSProperties = {
    ...styles[variant],
    fontFamily: 'var(--font-sans)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...(disabled ? { background: '#1A1A1A', color: '#606060', border: '1px solid #2E2E2E' } : {}),
  }
  const cls = `inline-flex items-center justify-center gap-2 font-bold transition-all hover:opacity-85 active:opacity-70 ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`

  if (href && !disabled) {
    return (
      <Link href={href} onClick={onClick} className={cls} style={style} aria-label={ariaLabel}>
        {children}
      </Link>
    )
  }
  return (
    <button onClick={onClick} disabled={disabled} className={cls} style={style} aria-label={ariaLabel}>
      {children}
    </button>
  )
}
