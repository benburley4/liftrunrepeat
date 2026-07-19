'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 to `end` when it enters the viewport.
 * Non-numeric prefix/suffix around the number is preserved (e.g. "14.2t", "612").
 * Respects prefers-reduced-motion (renders the final value immediately).
 */
export default function CountUp({ value, duration = 1200 }: { value: string | number; duration?: number }) {
  const raw = String(value)
  const match = raw.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/)
  const ref = useRef<HTMLSpanElement>(null)
  const [display, setDisplay] = useState(raw)

  useEffect(() => {
    if (!match) return
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const [, prefix, numStr, suffix] = match
    const end = parseFloat(numStr)
    const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        function tick(now: number) {
          const t = Math.min((now - start) / duration, 1)
          const eased = 1 - Math.pow(1 - t, 3)
          setDisplay(`${prefix}${(end * eased).toFixed(decimals)}${suffix}`)
          if (t < 1) requestAnimationFrame(tick)
        }
        setDisplay(`${prefix}${(0).toFixed(decimals)}${suffix}`)
        requestAnimationFrame(tick)
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, duration])

  return <span ref={ref}>{display}</span>
}
