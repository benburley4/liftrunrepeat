import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AuthWrapper from '@/components/layout/AuthWrapper'
import { Analytics } from '@vercel/analytics/next'

export const metadata: Metadata = {
  title: 'LiftRunRepeat — Train Both. Peak Together.',
  description: 'The only platform built for hybrid athletes. Lift, run, repeat. Log both. Track both. Peak at both.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className="min-h-full flex flex-col"
        style={{ background: '#0D0D0D', color: '#F5F5F5', fontFamily: 'Inter, sans-serif' }}
      >
        <AuthWrapper>
          <Navbar />
          <main className="flex-1 pt-16">
            {children}
          </main>
          <Footer />
        </AuthWrapper>
        <Analytics />
      </body>
    </html>
  )
}
