'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ThemeSourceSelection } from '@/types/textlabs'

export function useThemeSourceState(presentationId?: string | null) {
  const [touched, setTouched] = useState(false)
  const [themeSource, setThemeSource] = useState<ThemeSourceSelection>({
    mode: presentationId ? 'deck' : 'none',
    overrides: null,
  })

  useEffect(() => {
    if (touched) return
    setThemeSource({ mode: presentationId ? 'deck' : 'none', overrides: null })
  }, [presentationId, touched])

  const updateThemeSource = useCallback((selection: ThemeSourceSelection) => {
    setThemeSource(selection)
    setTouched(true)
  }, [])

  return {
    themeSource,
    updateThemeSource,
    useDeckTheme: themeSource.mode === 'deck' && Boolean(presentationId),
    themeOverrides: themeSource.mode === 'another' ? themeSource.overrides || null : null,
  }
}
