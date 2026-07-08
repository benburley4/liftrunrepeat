'use client'

import { ReactNode, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * Shared modal shell: blurred backdrop, Escape / backdrop-click to close,
 * focus trap, aria-modal. Header takes the standard eyebrow + black-caps
 * title; body scrolls; `footer` renders in a bordered bottom bar.
 */
export default function Modal({
  onClose,
  eyebrow,
  eyebrowColor = '#606060',
  title,
  headerExtra,
  footer,
  maxWidth = 520,
  children,
}: {
  onClose: () => void
  eyebrow?: string
  eyebrowColor?: string
  title: string
  headerExtra?: ReactNode
  footer?: ReactNode
  maxWidth?: number
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-card w-full flex flex-col rounded-2xl overflow-hidden outline-none"
        style={{ maxWidth: `${maxWidth}px`, maxHeight: '90vh', background: '#141414', border: '1px solid #2E2E2E' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4" style={{ borderBottom: '1px solid #2E2E2E' }}>
          <div>
            {eyebrow && (
              <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: eyebrowColor, fontFamily: 'var(--font-sans)' }}>
                {eyebrow}
              </p>
            )}
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: 'var(--font-heading)', color: '#F5F5F5' }}>
              {title}
            </h2>
            {headerExtra}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="transition-colors hover:text-white"
            style={{ background: 'none', border: 'none', color: '#8A8A8A', cursor: 'pointer', flexShrink: 0, marginLeft: '16px', marginTop: '4px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid #2E2E2E' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
