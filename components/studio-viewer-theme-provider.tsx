'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'
import { viewerDefaultTheme, isPublishedViewerPath } from '@/lib/studio-p2-publish'

/**
 * VIEW-04 (NEXT_PUBLIC_STUDIO_P2_PUBLISH, chosen in app/layout.tsx; with the flag off this file is not used).
 *
 * The root provider's default is "light", so a first-time visitor to a published deck always got light mode and dark only if their browser had
 * already stored it. On /p/* the default becomes "system", which next-themes resolves from the visitor's own setting before first paint; a stored
 * choice still wins, and nothing is written to storage. Every other page keeps the root default.
 *
 * Keyed by "viewer or not" so a client-side move from a published deck to the rest of the app (the "Made with Deckster" link) re-reads the default
 * for the page it lands on instead of carrying "system" across.
 */
export function StudioViewerThemeProvider({ children, defaultTheme, ...props }: ThemeProviderProps) {
  const pathname = usePathname()
  return (
    <NextThemesProvider
      key={isPublishedViewerPath(pathname) ? 'published-viewer' : 'app'}
      {...props}
      defaultTheme={viewerDefaultTheme(pathname, true, defaultTheme)}
    >
      {children}
    </NextThemesProvider>
  )
}
