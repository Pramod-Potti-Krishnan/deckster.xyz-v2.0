"use client"

import { useEffect, useState } from 'react'
import { getThemeBuilderUrl } from '@/lib/config'
import { STUDIO_THEME_PREVIEW_CANON_ENABLED } from '@/lib/studio-theme-preview-canon'
import { CANONICAL_THEME_PRESET_IDS, CANON_ONLY_THEME_PRESET_IDS } from '@/lib/theme-builder'
import { loadPresetSwatchPalettes, type PresetSwatchPalette } from '@/lib/theme-preset-swatches'

// PASS2D 5 (flag NEXT_PUBLIC_STUDIO_THEME_PREVIEW_CANON, default off; Studio shell only): the canon palette of every Theme Builder preset, for the Themes & brand preview.
// The same read the deck Theme dialog makes (components/theme-panel.tsx useCanonPresetPalettes): lib/theme-preset-swatches.ts, one read-only GET per preset per page load,
// shared with the dialog through that module's cache. Flag off: no state of consequence, no request, and `undefined` back, so the preview is as it was. On: `{}` until Theme
// Builder answers, then the presets it answered for; an unreachable or unconfigured Theme Builder leaves `{}`.
const PRESET_IDS: readonly string[] = [...new Set([...CANONICAL_THEME_PRESET_IDS, ...CANON_ONLY_THEME_PRESET_IDS])]

export function useCanonPreviewPalettes(): Record<string, PresetSwatchPalette> | undefined {
  const [palettes, setPalettes] = useState<Record<string, PresetSwatchPalette>>({})
  useEffect(() => {
    if (!STUDIO_THEME_PREVIEW_CANON_ENABLED) return
    let baseUrl: string
    try {
      baseUrl = getThemeBuilderUrl()
    } catch {
      return
    }
    let cancelled = false
    loadPresetSwatchPalettes(baseUrl, PRESET_IDS).then(loaded => {
      if (!cancelled) setPalettes(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return STUDIO_THEME_PREVIEW_CANON_ENABLED ? palettes : undefined
}
