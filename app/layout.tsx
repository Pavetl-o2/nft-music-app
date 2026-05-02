import type { Metadata } from 'next'
import { Bebas_Neue, Space_Mono, DM_Sans } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
})

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'SOUNDFORGE — NFT Music Game',
  description: 'Combina tus NFTs para crear música con IA',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${bebasNeue.variable} ${dmSans.variable} ${spaceMono.variable} bg-void text-bone antialiased`}>
        {children}
      </body>
    </html>
  )
}
