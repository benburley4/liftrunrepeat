import Link from 'next/link'
import Image from 'next/image'
import { Twitter, Instagram, Github } from 'lucide-react'

const footerLinks = {
  Platform: [
    { href: '/programmes', label: 'Programmes' },
    { href: '/templates', label: 'Templates' },
    { href: '/log/session', label: 'Today' },
    { href: '/analytics', label: 'Analytics' },
  ],
  Tools: [
    { href: '/tools', label: 'Calculator Hub' },
    { href: '/running', label: 'Running Tools' },
    { href: '/tools#wilks', label: 'Wilks Score' },
    { href: '/tools#macro', label: 'Macro Calculator' },
  ],
  Community: [
    { href: '#', label: 'Discord' },
    { href: '#', label: 'Reddit' },
    { href: '#', label: 'Newsletter' },
    { href: '#', label: 'Events' },
  ],
  Resources: [
    { href: '/library', label: 'Exercise Library' },
    { href: '/running', label: 'Run Type Guide' },
    { href: '#', label: 'Blog' },
    { href: '#', label: 'About' },
  ],
}

export default function Footer() {
  return (
    <footer style={{ background: '#111111', borderTop: '1px solid #2E2E2E' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
          {/* Brand column */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <Image src="/logo.png" alt="LiftRunRepeat" width={32} height={32} className="object-contain" />
              <span
                className="text-sm font-black tracking-wider uppercase"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                <span style={{ color: '#C8102E' }}>LIFT</span>
                <span style={{ color: '#00BFA5' }}>RUN</span>
                <span style={{ color: '#F5F5F5' }}>REPEAT</span>
              </span>
            </Link>
            <p
              className="text-xs leading-relaxed mb-6"
              style={{ color: '#606060', fontStyle: 'italic' }}
            >
              &ldquo;Lift heavy. Run far. Repeat stronger.&rdquo;
            </p>
            <div className="flex gap-3">
              {[Twitter, Instagram, Github].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded flex items-center justify-center transition-colors"
                  style={{ background: '#242424', color: '#606060', border: '1px solid #2E2E2E' }}
                >
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4
                className="text-xs font-bold uppercase tracking-widest mb-4"
                style={{ color: '#606060', fontFamily: 'Inter, sans-serif' }}
              >
                {category}
              </h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors hover:text-white"
                      style={{ color: '#A0A0A0' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid #2E2E2E' }}
        >
          <p className="text-xs" style={{ color: '#606060' }}>
            © 2026 LiftRunRepeat. Built for hybrid athletes.
          </p>
          <div className="flex gap-4 text-xs" style={{ color: '#606060' }}>
            <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
