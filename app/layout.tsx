import type { Metadata } from 'next'
import { Onest, Outfit } from 'next/font/google'
import './globals.css'

const onest = Onest({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--f-onest' })
const outfit = Outfit({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-outfit' })

export const metadata: Metadata = {
  title: 'Material Depot for Partners',
  description:
    'Design, quote, procure and get paid — the workspace for architects and designers working with Material Depot.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${onest.variable} ${outfit.variable} antialiased`}>{children}</body>
    </html>
  )
}
