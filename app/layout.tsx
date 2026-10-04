import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { SessionProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { V3_CONTENT } from '@/lib/marketing/v3-content'

const inter = Inter({ subsets: ['latin'] })

// Share text for every page without its own: the same title and description as the home page.
const { title, description } = V3_CONTENT.metadata

export const metadata: Metadata = {
  title: {
    default: title,
    template: '%s | Deckster'
  },
  description,
  keywords: ['presentation builder', 'AI presentations', 'slide deck creator', 'Deckster', 'presentation software'],
  authors: [{ name: 'Deckster Team' }],
  creator: 'Deckster',
  publisher: 'Deckster',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://deckster.xyz'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title,
    description,
    url: 'https://deckster.xyz',
    siteName: 'Deckster',
    // og:image / twitter:image come from app/opengraph-image.tsx and
    // app/twitter-image.tsx (Next file-convention metadata routes).
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    creator: '@deckster',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add these when you have them
    // google: 'google-site-verification-code',
    // bing: 'bing-verification-code',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
