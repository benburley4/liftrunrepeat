'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { signOut, getUsername } from '@/lib/auth'

type NavItem = { href: string; label: string }
type NavGroup = { label: string; items: NavItem[] }

const primaryLinks: NavItem[] = [
  { href: '/get-started', label: 'Get Started' },
  { href: '/programmes', label: 'Programmes' },
  { href: '/programme-review', label: 'AI Coach' },
]

const groups: NavGroup[] = [
  {
    label: 'Train',
    items: [
      { href: '/log/session', label: 'Today' },
      { href: '/templates', label: 'Templates' },
      { href: '/running', label: 'Running' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/progress', label: 'Progress' },
      { href: '/library', label: 'Library' },
      { href: '/tools', label: 'Tools' },
    ],
  },
]

/** Brand mark: barbell over a heartbeat pulse — teal/crimson split. */
function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="8" stroke="#2E2E2E" strokeWidth="1.5" fill="#141414" />
      {/* barbell */}
      <rect x="6" y="8.5" width="3" height="7" rx="1" fill="#00BFA5" />
      <rect x="23" y="8.5" width="3" height="7" rx="1" fill="#00BFA5" />
      <rect x="9" y="11" width="14" height="2" rx="1" fill="#00BFA5" />
      {/* pulse */}
      <path d="M5 23h5l2.5-4 3 7 2.5-5.5L20 23h7" stroke="#C8102E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(href))
}

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const { user } = useAuth()

  const username = getUsername(user)
  const initials = username.slice(0, 2).toUpperCase()

  async function handleSignOut() {
    await signOut()
    setUserMenuOpen(false)
  }

  const linkStyle = (active: boolean): React.CSSProperties => ({
    color: active ? '#00BFA5' : '#A0A0A0',
    fontFamily: 'var(--font-sans)',
    background: active ? 'rgba(0,191,165,0.1)' : 'transparent',
  })

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{ background: 'rgba(15,15,15,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #2E2E2E' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <LogoMark />
            <span
              className="text-lg font-black tracking-wider uppercase"
              style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.06em' }}
            >
              <span style={{ color: '#C8102E' }}>LIFT</span>
              <span style={{ color: '#00BFA5' }}>RUN</span>
              <span style={{ color: '#F5F5F5' }}>REPEAT</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {primaryLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded text-sm font-medium transition-colors hover:text-white"
                style={linkStyle(isActive(pathname, link.href))}
              >
                {link.label}
              </Link>
            ))}

            {groups.map(group => {
              const groupActive = group.items.some(i => isActive(pathname, i.href))
              const open = openGroup === group.label
              return (
                <div key={group.label} className="relative">
                  <button
                    onClick={() => setOpenGroup(open ? null : group.label)}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    className="flex items-center gap-1 px-3 py-2 rounded text-sm font-medium transition-colors hover:text-white"
                    style={{ ...linkStyle(groupActive), border: 'none', cursor: 'pointer' }}
                  >
                    {group.label}
                    <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                  </button>

                  {open && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpenGroup(null)} />
                      <div
                        className="menu-pop card-depth"
                        style={{ position: 'absolute', left: 0, top: '42px', zIndex: 50, minWidth: '160px', borderRadius: '12px', background: '#1A1A1A', border: '1px solid #2E2E2E', overflow: 'hidden' }}
                        role="menu"
                      >
                        {group.items.map(item => {
                          const active = isActive(pathname, item.href)
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              role="menuitem"
                              onClick={() => setOpenGroup(null)}
                              className="block px-4 py-2.5 text-sm font-medium transition-colors"
                              style={{ color: active ? '#00BFA5' : '#A0A0A0', fontFamily: 'var(--font-sans)', background: active ? 'rgba(0,191,165,0.08)' : 'transparent' }}
                              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = '#242424'; e.currentTarget.style.color = '#F5F5F5' } }}
                              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#A0A0A0' } }}
                            >
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/log/session"
                  className="px-4 py-2 rounded text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: '#C8102E', color: '#F5F5F5', fontFamily: 'var(--font-sans)' }}
                >
                  + Today
                </Link>

                {/* User avatar + dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <div
                      style={{ width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, background: '#00BFA520', color: '#00BFA5', border: '1px solid #00BFA540', fontFamily: 'var(--font-sans)' }}
                    >
                      {initials}
                    </div>
                  </button>

                  {userMenuOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setUserMenuOpen(false)} />
                      <div className="menu-pop card-depth" style={{ position: 'absolute', right: 0, top: '44px', zIndex: 50, minWidth: '180px', borderRadius: '12px', background: '#1A1A1A', border: '1px solid #2E2E2E', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 14px', borderBottom: '1px solid #2E2E2E' }}>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: '#F5F5F5', margin: 0, fontFamily: 'var(--font-sans)' }}>{username}</p>
                          <p style={{ fontSize: '11px', color: '#606060', margin: '2px 0 0', fontFamily: 'var(--font-sans)' }}>{user?.email}</p>
                        </div>
                        <Link
                          href="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', color: '#A0A0A0', fontSize: '13px', fontFamily: 'var(--font-sans)', textDecoration: 'none', borderBottom: '1px solid #2E2E2E' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#2E2E2E'; e.currentTarget.style.color = '#F5F5F5' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#A0A0A0' }}
                        >
                          <UserIcon size={14} />
                          Athlete Profile
                        </Link>
                        <button
                          onClick={handleSignOut}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', color: '#A0A0A0', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
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
                className="px-4 py-2 rounded text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: '#00BFA5', color: '#0D0D0D', fontFamily: 'var(--font-sans)' }}
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded"
            style={{ color: '#F5F5F5', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="md:hidden border-t menu-pop"
          style={{ background: '#1A1A1A', borderColor: '#2E2E2E', maxHeight: 'calc(100vh - 64px)', overflowY: 'auto' }}
        >
          <div className="px-4 py-4 flex flex-col gap-1">
            {primaryLinks.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-3 rounded text-sm font-medium"
                style={linkStyle(isActive(pathname, link.href))}
              >
                {link.label}
              </Link>
            ))}

            {groups.map(group => (
              <div key={group.label} className="mt-2">
                <p className="px-3 mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: '#606060', fontFamily: 'var(--font-heading)' }}>
                  {group.label}
                </p>
                {group.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-3 rounded text-sm font-medium"
                    style={linkStyle(isActive(pathname, item.href))}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}

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
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 w-full px-4 py-3 rounded text-sm mt-2"
                    style={{ color: '#A0A0A0', fontFamily: 'var(--font-sans)' }}
                  >
                    <UserIcon size={14} />
                    Athlete Profile
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 w-full px-4 py-3 rounded text-sm mt-2"
                    style={{ background: 'none', border: 'none', color: '#606060', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
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
