import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { SessionProvider } from '@/components/providers/session-provider'
import { ThemeProvider } from '@/components/theme-provider'
import { StudioViewerThemeProvider } from '@/components/studio-viewer-theme-provider'
import { STUDIO_P2_PUBLISH_ENABLED } from '@/lib/studio-p2-publish'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })
const connectedLocal = process.env.STUDIO_V4_CONNECTED_LOCAL === 'true'

export const metadata: Metadata = {
  title: {
    default: `${connectedLocal ? 'LOCAL UAT — ' : ''}Deckster | AI-Powered Presentation Generator`,
    template: `${connectedLocal ? 'LOCAL UAT — ' : ''}%s | Deckster`
  },
  description: 'Create stunning presentations in minutes with Deckster. Our multi-agent AI system writes, designs, and visualizes your slides automatically.',
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
    title: 'Deckster - AI-Powered Presentation Builder',
    description: 'Create stunning presentations with AI. Build engaging, professional presentations in minutes.',
    url: 'https://deckster.xyz',
    siteName: 'Deckster',
    // og:image / twitter:image come from app/opengraph-image.tsx and
    // app/twitter-image.tsx (Next file-convention metadata routes).
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Deckster - AI-Powered Presentation Builder',
    description: 'Create stunning presentations with AI. Build engaging, professional presentations in minutes.',
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

// NEXT_PUBLIC_STUDIO_P2_PUBLISH (VIEW-04): the published viewer follows the visitor's system theme when nothing is stored. Off: the provider is as before.
const AppThemeProvider = STUDIO_P2_PUBLISH_ENABLED ? StudioViewerThemeProvider : ThemeProvider

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
          <AppThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </AppThemeProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  )
}
