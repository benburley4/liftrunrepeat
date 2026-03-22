'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, LogOut } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { signOut, getUsername } from '@/lib/auth'

const navLinks = [
  { href: '/programmes', label: 'Programmes' },
  { href: '/templates', label: 'Templates' },
  { href: '/log/session', label: 'Today' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/running', label: 'Running' },
  { href: '/library', label: 'Library' },
  { href: '/tools', label: 'Tools' },
]

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { user } = useAuth()

  const username = getUsername(user)
  const initials = username.slice(0, 2).toUpperCase()

  async function handleSignOut() {
    await signOut()
    setUserMenuOpen(false)
  }

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #2E2E2E' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <span
              className="text-lg font-black tracking-wider uppercase"
              style={{ fontFamily: 'Montserrat, sans-serif', letterSpacing: '0.06em' }}
            >
              <span style={{ color: '#C8102E' }}>LIFT</span>
              <span style={{ color: '#00BFA5' }}>RUN</span>
              <span style={{ color: '#F5F5F5' }}>REPEAT</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-2 rounded text-sm font-medium transition-colors"
                  style={{
                    color: isActive ? '#00BFA5' : '#A0A0A0',
                    fontFamily: 'Inter, sans-serif',
                    background: isActive ? 'rgba(0,191,165,0.1)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/log/session"
                  className="px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ background: '#C8102E', color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}
                >
                  + Today
                </Link>

                {/* User avatar + dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <div
                      style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: '#00BFA520', color: '#00BFA5', border: '1px solid #00BFA540', fontFamily: 'Inter, sans-serif' }}
                    >
                      {initials}
                    </div>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setUserMenuOpen(false)} />
                      <div style={{ position: 'absolute', right: 0, top: '44px', zIndex: 50, minWidth: '180px', borderRadius: '12px', background: '#1A1A1A', border: '1px solid #2E2E2E', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid #2E2E2E' }}>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#F5F5F5', margin: 0, fontFamily: 'Inter, sans-serif' }}>{username}</p>
                          <p style={{ fontSize: '11px', color: '#606060', margin: '2px 0 0', fontFamily: 'Inter, sans-serif' }}>{user?.email}</p>
                        </div>
                        <button
                          onClick={handleSignOut}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#A0A0A0', fontSize: '13px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#2E2E2E'; e.currentTarget.style.color = '#F5F5F5' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A0A0A0' }}
                        >
                          <LogOut size={14} />
                          Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded text-sm font-semibold transition-opacity hover:opacity-90"
                style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'Inter, sans-serif' }}
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded"
            style={{ color: '#F5F5F5' }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t"
          style={{ background: '#1A1A1A', borderColor: '#2E2E2E' }}
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-3 rounded text-sm font-medium"
                  style={{
                    color: isActive ? '#00BFA5' : '#A0A0A0',
                    background: isActive ? 'rgba(0,191,165,0.08)' : 'transparent',
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #2E2E2E' }}>
              {user ? (
                <>
                  <Link
                    href="/log/session"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full text-center px-4 py-3 rounded text-sm font-semibold"
                    style={{ background: '#C8102E', color: '#F5F5F5' }}
                  >
                    + Today
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-4 py-3 rounded text-sm mt-2"
                    style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                  >
                    <LogOut size={14} />
                    Sign Out ({username})
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center px-4 py-3 rounded text-sm font-semibold"
                  style={{ background: '#00BFA5', color: '#0D0D0D' }}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
