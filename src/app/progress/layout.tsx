import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Progress — LiftRunRepeat',
  description: 'See your lifting, running and hiking progress in one place: records, trends, readiness and hybrid balance. Try the live demo.',
}

export default function ProgressLayout({ children }: { children: React.ReactNode }) {
  return children
}
