import type { Metadata } from 'next'
import { Manrope, Orbitron } from 'next/font/google'
import './globals.css'

const display = Orbitron({
  subsets: ['latin'],
  variable: '--font-display',
})

const body = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: 'Vibe Calendar',
  description: 'A planning calendar with solar/lunar conversion, AI task generation, and calendar export.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${display.variable} ${body.variable} font-body antialiased`}>{children}</body>
    </html>
  )
}
