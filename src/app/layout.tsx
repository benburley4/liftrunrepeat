import type { Metadata } from 'next'
import { Montserrat, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AuthWrapper from '@/components/layout/AuthWrapper'
import { Analytics } from '@vercel/analytics/next'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-montserrat',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains-mono',
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ),
  title: 'LiftRunRepeat — Train Both. Peak Together.',
  description: 'The only platform built for hybrid athletes. Lift, run, repeat. Log both. Track both. Peak at both.',
  icons: { icon: '/logo.svg' },
  openGraph: {
    title: 'LiftRunRepeat — Train Both. Peak Together.',
    description: 'The only platform built for hybrid athletes. Log both. Track both. Peak at both.',
    siteName: 'LiftRunRepeat',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`h-full ${montserrat.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body
        className="min-h-full flex flex-col"
        style={{ background: '#0D0D0D', color: '#F5F5F5', fontFamily: 'var(--font-sans)' }}
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
