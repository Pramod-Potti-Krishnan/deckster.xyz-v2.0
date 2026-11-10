'use client'

import './studio-generation-context.css'
import './studio-theme-source-status.css'
import { useEffect, useMemo, useState } from 'react'
import { Palette } from 'lucide-react'
import { features } from '@/lib/config'
import { useDeckThemePalette } from '@/hooks/use-deck-theme-palette'
import { useThemeProfiles, type SavedThemeProfile } from '@/hooks/use-theme-profiles'
import type { ThemePalette, ThemeSourceSelection } from '@/types/textlabs'

const STUDIO_GENERATION_CONTEXT = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

function isHex(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

function profileToPalette(profile: SavedThemeProfile): ThemePalette | null {
  const payload = profile.theme_payload
  const overrides = payload.color_overrides || {}
  const accents = [payload.tertiary_hex, overrides.accent, overrides.accent_1, overrides.accent_2]
    .filter(isHex)

  const palette: ThemePalette = {
    primary: isHex(payload.primary_hex) ? payload.primary_hex : undefined,
    secondary: isHex(payload.secondary_hex) ? payload.secondary_hex : undefined,
    surface: isHex(overrides.surface)
      ? overrides.surface
      : (isHex(payload.secondary_hex) ? payload.secondary_hex : undefined),
    border: isHex(overrides.border)
      ? overrides.border
      : (isHex(payload.secondary_hex) ? payload.secondary_hex : undefined),
    accents,
    text: isHex(payload.neutral_hex) ? payload.neutral_hex : undefined,
    background: isHex(overrides.background) ? overrides.background : undefined,
    mode: payload.palette_mode === 'dark' ? 'dark' : 'light',
  }

  return palette.primary || palette.secondary || palette.text || palette.background || accents.length > 0
    ? palette
    : null
}

function PaletteSwatches({ palette }: { palette: ThemePalette | null }) {
  const colors = useMemo(() => [
    palette?.primary,
    palette?.secondary,
    ...(palette?.accents || []),
    palette?.text,
    palette?.background,
  ].filter(isHex).slice(0, 5), [palette])

  if (colors.length === 0) return null

  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {colors.map((color, index) => (
        <span
          key={`${color}-${index}`}
          className="h-4 w-4 rounded-full border border-white/70 shadow-sm"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

export function ThemeSourceSelector({
  presentationId,
  value,
  onChange,
}: {
  presentationId?: string | null
  value: ThemeSourceSelection
  onChange: (selection: ThemeSourceSelection) => void
}) {
  const { palette, loading: deckThemeLoading, error: deckThemeError } = useDeckThemePalette(presentationId)
  const { listThemes, loading: savedThemesLoading, error: savedThemesError } = useThemeProfiles()
  const [profiles, setProfiles] = useState<SavedThemeProfile[]>([])
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const anotherThemeEnabled = features.enableElementAnotherTheme
  const deckAvailable = Boolean(presentationId)

  useEffect(() => {
    if (!anotherThemeEnabled) return
    let cancelled = false
    listThemes().then(response => {
      if (!cancelled) setProfiles(response?.themes || [])
    })
    return () => {
      cancelled = true
    }
  }, [anotherThemeEnabled, listThemes])

  const mappedProfiles = useMemo(() => profiles
    .map(profile => ({ profile, palette: profileToPalette(profile) }))
    .filter((item): item is { profile: SavedThemeProfile; palette: ThemePalette } => Boolean(item.palette)),
  [profiles])

  const chooseMode = (mode: ThemeSourceSelection['mode']) => {
    if (mode === 'deck') {
      onChange({ mode: 'deck', overrides: null })
    } else if (mode === 'none') {
      onChange({ mode: 'none', overrides: null })
    } else if (anotherThemeEnabled) {
      const selected = mappedProfiles.find(item => item.profile.id === selectedProfileId) || mappedProfiles[0]
      setSelectedProfileId(selected?.profile.id || '')
      onChange({ mode: 'another', overrides: selected?.palette || null })
    }
  }

  return (
    <div data-studio-generation-context={STUDIO_GENERATION_CONTEXT ? 'theme' : undefined} className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-slate-300">
          <Palette className="h-3.5 w-3.5" />
          Theme Source
        </label>
        {value.mode === 'deck' && <PaletteSwatches palette={palette} />}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          disabled={!deckAvailable}
          data-studio-generation-control={STUDIO_GENERATION_CONTEXT ? 'theme-mode' : undefined}
          aria-pressed={STUDIO_GENERATION_CONTEXT ? value.mode === 'deck' : undefined}
          onClick={() => chooseMode('deck')}
          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
            value.mode === 'deck'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
          } ${!deckAvailable ? 'opacity-50' : ''}`}
        >
          Deck theme
        </button>
        <button
          type="button"
          data-studio-generation-control={STUDIO_GENERATION_CONTEXT ? 'theme-mode' : undefined}
          aria-pressed={STUDIO_GENERATION_CONTEXT ? value.mode === 'none' : undefined}
          onClick={() => chooseMode('none')}
          className={`rounded-md border px-2 py-1 text-xs transition-colors ${
            value.mode === 'none'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          No theme
        </button>
      </div>
      {STUDIO_GENERATION_CONTEXT && (
        <>
          {deckAvailable && deckThemeLoading && (
            <p data-studio-theme-source-status="deck-loading" role="status">Loading deck theme preview…</p>
          )}
          {deckAvailable && deckThemeError && (
            <details data-studio-theme-source-status="deck-error">
              <summary>Deck theme preview unavailable</summary>
              <div data-studio-theme-source-error="deck" role="region" aria-label="Deck theme preview error" tabIndex={0}>
                <p>{deckThemeError}</p>
              </div>
            </details>
          )}
          {anotherThemeEnabled && savedThemesLoading && (
            <p data-studio-theme-source-status="saved-loading" role="status">Loading saved themes…</p>
          )}
          {anotherThemeEnabled && savedThemesError && (
            <details data-studio-theme-source-status="saved-error">
              <summary>Saved themes unavailable</summary>
              <div data-studio-theme-source-error="saved" role="region" aria-label="Saved themes error" tabIndex={0}>
                <p>{savedThemesError.message}</p>
              </div>
            </details>
          )}
        </>
      )}
      {anotherThemeEnabled && mappedProfiles.length > 0 && (
        <select
          aria-label={STUDIO_GENERATION_CONTEXT ? 'Element saved theme' : undefined}
          value={selectedProfileId}
          onChange={(event) => {
            const selected = mappedProfiles.find(item => item.profile.id === event.target.value)
            setSelectedProfileId(event.target.value)
            onChange({ mode: 'another', overrides: selected?.palette || null })
          }}
          className="w-full px-2 py-1 rounded-md bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-600 text-xs text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Another theme...</option>
          {mappedProfiles.map(({ profile }) => (
            <option key={profile.id} value={profile.id}>{profile.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
