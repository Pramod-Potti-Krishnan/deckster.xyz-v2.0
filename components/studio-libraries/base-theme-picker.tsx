"use client"

import './base-theme-dropdown.css'

import { ThemeDropdownPicker, type ThemeDropdownCopy } from '@/components/theme-dropdown-picker'
import { FALLBACK_THEME_PRESETS, type BuildThemeSelection } from '@/lib/theme-builder'
import { baseThemeOptions, baseThemeSelectedId } from '@/lib/studio-theme-base-dropdown'

// PASS2D 6b (flag NEXT_PUBLIC_STUDIO_THEME_BASE_DROPDOWN, default off; Studio shell only): the Themes & brand page's "Base theme" as the searchable dropdown the deck dialog uses.
// Presentation only: the draft and its handler stay in ThemesWorkspace (`onSelect` is its `changePreset`); nothing here fetches anything or saves anything. No colour chips yet:
// the preview's palette for a preset is not the canon one (PASS2-J4-FINDINGS item 5), and a wrong chip is worse than none.
const COPY: ThemeDropdownCopy = { label: 'Base theme', help: 'Type to search', placeholder: 'Search themes', singular: 'theme', plural: 'themes', groups: false }

export function BaseThemePicker({ draft, locked, onSelect }: { draft: BuildThemeSelection; locked: boolean; onSelect: (id: string) => void }) {
  const options = baseThemeOptions(FALLBACK_THEME_PRESETS, draft)
  return (
    <div className="sl-base-dd" data-studio-library-dd="true">
      <ThemeDropdownPicker options={options} selectedId={baseThemeSelectedId(draft)} locked={locked} onSelect={onSelect} copy={COPY} />
    </div>
  )
}
