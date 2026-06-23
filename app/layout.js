import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  title: 'PropManager — Property management, simplified',
  description:
    'Lease renewals, e-signature sending, automated tenant reminders, and maintenance — all in one clean, modern property management platform.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
