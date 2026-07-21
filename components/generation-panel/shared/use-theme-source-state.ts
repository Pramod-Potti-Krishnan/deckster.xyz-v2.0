'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ThemeSourceSelection } from '@/types/textlabs'
import { resolveDraftThemeSource } from '@/lib/visual-form-draft'

export function useThemeSourceState(
  presentationId?: string | null,
  initialSelection?: ThemeSourceSelection | null,
) {
  const [touched, setTouched] = useState(Boolean(initialSelection))
  const [themeSource, setThemeSource] = useState<ThemeSourceSelection>(() =>
    initialSelection || resolveDraftThemeSource(presentationId),
  )

  useEffect(() => {
    if (touched) return
    setThemeSource(resolveDraftThemeSource(presentationId))
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
