"use client"

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeDropdownPicker, type ThemeDropdownCopy, type ThemeDropdownOption } from '@/components/theme-dropdown-picker'
import type { SavedThemeProfile } from '@/hooks/use-theme-profiles'
import { getThemeBuilderUrl } from '@/lib/config'
import { savedThemeChips, savedThemePresetId } from '@/lib/studio-theme-saved-chips'
import { loadPresetSwatchPalettes, type PresetSwatchPalette } from '@/lib/theme-preset-swatches'

// PASS2D 6a (flag NEXT_PUBLIC_STUDIO_THEME_SAVED_CHIPS, default off; Studio shell only): the composer's "My themes" dropdown with a colour chip strip on every saved theme.
// Presentation only: the list, the selection and the handlers are the menu's own (`options` are the rows it built; this only fills in `swatches`). A theme saved on a preset takes the
// preset's chips from Theme Builder's own contract (lib/theme-preset-swatches.ts, one read-only GET per preset per page load, the call the deck Theme dialog makes); until it
// answers, or if it cannot, a row keeps the chip it had. Nothing here writes anything.
export function SavedThemePicker({ themes, options, selectedId, locked, onSelect, copy, labelAccessory }: {
  themes: SavedThemeProfile[]
  options: ThemeDropdownOption[]
  selectedId: string | null
  locked: boolean
  onSelect: (id: string) => void
  copy: ThemeDropdownCopy
  labelAccessory?: ReactNode
}) {
  const presetKey = useMemo(() => [...new Set(themes.map(theme => savedThemePresetId(theme.theme_payload)).filter((id): id is string => id !== null))].sort().join('|'), [themes])
  const [palettes, setPalettes] = useState<Record<string, PresetSwatchPalette>>({})
  useEffect(() => {
    if (!presetKey) return
    let baseUrl: string
    try {
      baseUrl = getThemeBuilderUrl()
    } catch {
      return
    }
    let cancelled = false
    loadPresetSwatchPalettes(baseUrl, presetKey.split('|')).then(loaded => {
      if (!cancelled) setPalettes(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [presetKey])
  const withChips = options.map(option => {
    const theme = themes.find(item => item.id === option.id)
    if (!theme) return option
    const presetId = savedThemePresetId(theme.theme_payload)
    const chips = savedThemeChips(theme.theme_payload, presetId ? palettes[presetId] : null)
    return chips.length > 0 ? { ...option, swatches: chips } : option
  })
  return <ThemeDropdownPicker options={withChips} selectedId={selectedId} locked={locked} onSelect={onSelect} copy={copy} labelAccessory={labelAccessory} />
}
