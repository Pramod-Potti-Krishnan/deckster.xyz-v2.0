"use client"

import "./studio-editor-dialogs.css"
import "./studio-theme-panel.css"

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  Palette,
  RotateCcw,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getThemeBuilderUrl } from '@/lib/config'
import { cn } from '@/lib/utils'
import {
  CANONICAL_THEME_PRESET_IDS,
  FALLBACK_THEME_PRESETS,
  THEME_PICKER_CANON_ENABLED,
  carryThemeFonts,
  isCanonicalThemePresetId,
  isValidThemeHex,
  normalizeThemePanelSelection,
  normalizeThemePresetId,
  selectCanonicalThemePreset,
  themeSelectionFingerprint,
  type BuildThemeSelection,
  type CanonicalThemePresetId,
} from '@/lib/theme-builder'
import { loadPresetSwatchPalettes } from '@/lib/theme-preset-swatches'
import { clampDarkOnlyPaletteMode, customEntryPaletteMode, effectivePaletteMode, lightDisabledFor, themeDarkModeEnabled, withPaletteMode, type DeckPaletteMode } from '@/lib/studio-theme-dark-toggle'
import type { ThemeSyncState, ThemeSyncStatus } from '@/lib/theme-sync'
import { DeckModeControl } from './theme-deck-mode-control'
import {
  ThemeDropdownPicker,
  themeDropdownPreview,
  themeDropdownSwatches,
  type ThemeDropdownOption,
  type ThemeDropdownPreviewData,
} from './theme-dropdown-picker'

type ThemeMode = 'preset' | 'custom'

type PreviewPalette = {
  background: string
  surface: string
  primary: string
  accent: string
  text: string
  // T-06 (flag on): the built look from Theme Builder's contract (content canvas, hero ground, lead colour).
  swatch?: { canvas: string; hero: string; lead: string }
}

const PREVIEW_PALETTES: Partial<Record<CanonicalThemePresetId, PreviewPalette>> = {
  corporate_light: {
    background: '#ffffff',
    surface: '#eff6ff',
    primary: '#1e40af',
    accent: '#f59e0b',
    text: '#172033',
  },
  corporate_dark: {
    background: '#0f172a',
    surface: '#1e293b',
    primary: '#60a5fa',
    accent: '#fbbf24',
    text: '#f8fafc',
  },
  minimal: {
    background: '#ffffff',
    surface: '#f8fafc',
    primary: '#334155',
    accent: '#94a3b8',
    text: '#0f172a',
  },
  vibrant: {
    background: '#fff7ed',
    surface: '#f5f3ff',
    primary: '#6d28d9',
    accent: '#f97316',
    text: '#27203b',
  },
  executive: {
    background: '#f8fafc',
    surface: '#e2e8f0',
    primary: '#0f172a',
    accent: '#b45309',
    text: '#111827',
  },
  pastel: {
    background: '#fdf2f8',
    surface: '#ecfeff',
    primary: '#8b5cf6',
    accent: '#2dd4bf',
    text: '#3f3a52',
  },
}

// T-07 flag on, until Theme Builder answers (or if it cannot): the six keep
// today's guide palette; a canon-only preset gets this neutral swatch, never
// another preset's colours.
const PENDING_PREVIEW_PALETTE: PreviewPalette = {
  background: '#ffffff',
  surface: '#f3f4f6',
  primary: '#d1d5db',
  accent: '#e5e7eb',
  text: '#374151',
}

const THEME_PREVIEWS = CANONICAL_THEME_PRESET_IDS.map(id => ({
  id,
  ...FALLBACK_THEME_PRESETS.find(preset => preset.preset_id === id)!,
}))

/** T-06 flag on: swatches from Theme Builder's own preset contracts (GET /presets/{id}). */
function useCanonPresetPalettes(): Partial<Record<CanonicalThemePresetId, PreviewPalette>> {
  const [palettes, setPalettes] = useState<Partial<Record<CanonicalThemePresetId, PreviewPalette>>>({})
  useEffect(() => {
    if (!THEME_PICKER_CANON_ENABLED) return
    let baseUrl: string
    try {
      baseUrl = getThemeBuilderUrl()
    } catch {
      return
    }
    let cancelled = false
    loadPresetSwatchPalettes(baseUrl, CANONICAL_THEME_PRESET_IDS).then(loaded => {
      if (!cancelled) setPalettes(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return palettes
}

const CUSTOM_COLOR_FIELDS = [
  { key: 'primary_hex', label: 'Primary / brand' },
  { key: 'secondary_hex', label: 'Secondary' },
  { key: 'tertiary_hex', label: 'Tertiary' },
  { key: 'neutral_hex', label: 'Neutral' },
] as const

const OVERRIDE_TOKENS = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'tertiary', label: 'Tertiary' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text_primary', label: 'Heading text' },
  { key: 'text_body', label: 'Body text' },
  { key: 'border', label: 'Border' },
] as const

interface ThemePanelProps {
  isOpen: boolean
  onClose: () => void
  presentationId?: string | null
  buildThemeSelection: BuildThemeSelection
  themeSync: ThemeSyncState
  selectionLocked?: boolean
  onBuildThemeChange?: (selection: BuildThemeSelection) => void
  /** PASS2D A3 (NEXT_PUBLIC_STUDIO_THEME_BLANK_NOTE): the deck is the blank canvas, and what to say about it (lib/studio-theme-blank-note). The viewer
   *  passes it only with the flag on; absent, nothing differs. */
  blankNote?: { note: string; previewNote: string }
}

function resolvedPresetId(selection: BuildThemeSelection): CanonicalThemePresetId {
  const normalized = normalizeThemePresetId(selection.preset_id)
  return isCanonicalThemePresetId(normalized) ? normalized : 'corporate_light'
}

const STUDIO_THEME_PANEL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'
// PASS2 #7 (flag NEXT_PUBLIC_STUDIO_THEME_PICKER_V2, exact "true", default off; Studio shell only): the same panel, state and Apply
// as a lighter picker: clear preview tiles, the current theme marked, the lock note only when locked. Off: nothing below runs.
const STUDIO_THEME_PICKER_V2 = STUDIO_THEME_PANEL && process.env.NEXT_PUBLIC_STUDIO_THEME_PICKER_V2 === 'true'
// PASS2-PK-FOUR item 3 (flag NEXT_PUBLIC_STUDIO_THEME_DROPDOWN, exact "true", default off; Studio shell only): inside that same picker,
// the preset grid becomes a searchable dropdown (current theme pinned) with a preview of the selected theme. Same draft, handlers, Apply
// and lock rule. Off: nothing below runs and the picker (or plain panel) renders exactly as before.
const STUDIO_THEME_DROPDOWN = STUDIO_THEME_PANEL && process.env.NEXT_PUBLIC_STUDIO_THEME_DROPDOWN === 'true'
// P2C (flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED, exact "true", default off): a Light / Dark choice for the whole deck, before the build. It writes
// `palette_mode` onto the theme selection that already goes out (the build message and `set_theme`). On a built deck the same control only stages
// "Rebuild in dark / light" (nothing is sent). Off: no control, and every handler below computes what it did before.
const THEME_DARK_MODE = themeDarkModeEnabled(process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED)

function SyncBadge({ status }: { status: ThemeSyncStatus }) {
  if (status === 'syncing') {
    return (
      <span data-studio-theme-sync={STUDIO_THEME_PANEL ? 'syncing' : undefined} role={STUDIO_THEME_PANEL ? 'status' : undefined} className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700">
        <Loader2 className="h-3 w-3 animate-spin" /> Syncing
      </span>
    )
  }
  if (status === 'applied') {
    return (
      <span data-studio-theme-sync={STUDIO_THEME_PANEL ? 'applied' : undefined} role={STUDIO_THEME_PANEL ? 'status' : undefined} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Applied
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span data-studio-theme-sync={STUDIO_THEME_PANEL ? 'failed' : undefined} role={STUDIO_THEME_PANEL ? 'status' : undefined} className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700">
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    )
  }
  return <span data-studio-theme-sync={STUDIO_THEME_PANEL ? status : undefined} className="text-[10px] text-gray-400">Not synced</span>
}

function HexField({
  label,
  value,
  fallback,
  linkedLabel,
  disabled = false,
  onChange,
  onReset,
}: {
  label: string
  value?: string
  fallback: string
  linkedLabel?: string
  disabled?: boolean
  onChange: (value: string) => void
  onReset?: () => void
}) {
  const validValue = isValidThemeHex(value) ? value : fallback
  const isExplicit = value !== undefined

  return (
    <div data-studio-theme-color={STUDIO_THEME_PANEL ? label : undefined} className="rounded-lg border border-gray-200 bg-white px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-gray-700">{label}</span>
        {isExplicit ? (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Reset ${label} to theme`}
          >
            <RotateCcw className="h-3 w-3" /> Reset to theme
          </button>
        ) : (
          <span className="text-[10px] text-emerald-600">{linkedLabel || 'Theme-linked'}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={validValue}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
          className="h-8 w-9 rounded border border-gray-200 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label={`${label} color`}
        />
        <input
          value={value || ''}
          onChange={event => onChange(event.target.value)}
          disabled={disabled}
          className={cn(
            'h-8 min-w-0 flex-1 rounded-md border bg-white px-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60',
            value && !isValidThemeHex(value) ? 'border-rose-400 text-rose-700' : 'border-gray-200 text-gray-700',
          )}
          placeholder={isExplicit ? '#000000' : `Theme (${fallback})`}
          aria-label={`${label} hex value`}
          aria-invalid={STUDIO_THEME_PANEL ? Boolean(value && !isValidThemeHex(value)) : undefined}
        />
      </div>
    </div>
  )
}

// ── PASS2 #7: the lighter picker (flag NEXT_PUBLIC_STUDIO_THEME_PICKER_V2). Presentation only: ThemePanel keeps the draft, the
// handlers, Apply and the lock rule; this renders them. Same presets, same custom palette and overrides, same Apply payload. ──

type ThemePickerCard = {
  id: string
  name: string
  description: string
  selected: boolean
  current: boolean
  canvas: string
  hero: string
  lead: string
  ink: string
}

/** Dark text on a light tile, light text on a dark one. Anything that is not a six-digit hex gets the dark ink. */
function readableInk(hex: string): string {
  if (!isValidThemeHex(hex)) return '#1b2430'
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
  return luminance > 0.4 ? '#1b2430' : '#f8fafc'
}

function ThemePickerTile({ canvas, hero, lead, ink }: { canvas: string; hero: string; lead: string; ink: string }) {
  return (
    <span className="stpv2-tile" aria-hidden="true" style={{ background: canvas }}>
      <span className="stpv2-tile-content">
        <span className="stpv2-tile-aa" style={{ color: ink }}>Aa</span>
        <span className="stpv2-tile-rule" style={{ background: lead }} />
      </span>
      <span className="stpv2-tile-hero" style={{ background: hero }}>
        <span className="stpv2-tile-dot" style={{ background: lead }} />
      </span>
    </span>
  )
}

function ThemePickerV2({
  locked,
  syncStatus,
  syncError,
  currentLabel,
  selectedLabel,
  hasChanges,
  autoSelected,
  autoCurrent,
  cards,
  customMode,
  customEditor,
  advanced,
  presetPicker,
  modeControl,
  canApply,
  applyLabel,
  invalidColor,
  onSelectAuto,
  onSelectPreset,
  onBuildCustom,
  onBackToPresets,
  onApply,
  onClose,
  blankNote,
}: {
  locked: boolean
  syncStatus: ThemeSyncStatus
  syncError: string | null
  currentLabel: string
  selectedLabel: string
  hasChanges: boolean
  autoSelected: boolean
  autoCurrent: boolean
  cards: ThemePickerCard[]
  customMode: boolean
  customEditor: ReactNode
  advanced: ReactNode
  /** The searchable dropdown (flag NEXT_PUBLIC_STUDIO_THEME_DROPDOWN). Absent: the grid below. */
  presetPicker?: ReactNode
  /** The Light | Dark control (flag NEXT_PUBLIC_THEME_DARK_MODE_ENABLED). Absent: the body is as it was. */
  modeControl?: ReactNode
  canApply: boolean
  applyLabel: ReactNode
  invalidColor: boolean
  onSelectAuto: () => void
  onSelectPreset: (id: string) => void
  onBuildCustom: () => void
  onBackToPresets: () => void
  onApply: () => void
  onClose: () => void
  /** PASS2D A3: the note for a blank canvas (shown only while the choice is open). Absent: nothing is drawn. */
  blankNote?: string
}) {
  // The "Want your own colours?" row, as the base drew it (a const so the G35 link below can sit beside it without adding a child).
  const customRow = !locked && (
    <div className="stpv2-custom-row">
      <span>Want your own colours?</span>
      <button type="button" className="stpv2-link" onClick={onBuildCustom}>
        <Wand2 className="h-3.5 w-3.5" aria-hidden="true" /> Build a custom palette
      </button>
    </div>
  )
  // PASS2B G35 (NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK, default off, Studio shell only): the way on to Themes & brand, locked or not. Null with the flag
  // off, and then the body renders `customRow` alone in its old place, so the flag-off element tree has no extra child.
  const brandKitLink = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_THEME_BRAND_LINK === 'true' ? (
    <p className="stpv2-brandkit" data-studio-theme-part="brand-kit">
      <Link href="/studio/themes" prefetch={false} className="stpv2-link" data-studio-theme-action="brand-kit" onClick={onClose}>
        <Palette className="h-3.5 w-3.5" aria-hidden="true" /> Open themes &amp; brand kit <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </p>
  ) : null
  const hint = invalidColor
    ? 'Custom themes need a primary six-digit colour, such as #1e40af.'
    : syncStatus === 'failed' && !hasChanges
      ? 'That did not go through. Try again.'
      : hasChanges
        ? `Selected: ${selectedLabel}. Not applied yet.`
        : 'Pick a different theme to change it.'
  // The "Current theme" row as the base drew it (a const so the Light | Dark control can sit under it without adding a child when there is none).
  const currentRow = (
    <div className="stpv2-current" data-studio-theme-current="true">
      <span>Current theme</span>
      <strong>{currentLabel}</strong>
    </div>
  )
  return (
    <div
      data-studio-theme="true"
      data-studio-v4-dialog="theme"
      data-studio-theme-picker="v2"
      {...(presetPicker ? { 'data-studio-theme-dropdown': 'true' } : {})}
      role="dialog"
      aria-modal="false"
      aria-label="Theme for this presentation"
      onKeyDown={event => { if (event.key === 'Escape') onClose() }}
      className="stpv2 fixed z-50 flex flex-col"
    >
      <div data-studio-theme-part="header" className="stpv2-header">
        <div className="stpv2-heading">
          <h2>Theme for this presentation</h2>
          <p>Choose how the whole deck looks.</p>
        </div>
        <div className="stpv2-header-actions">
          {syncStatus !== 'idle' && <SyncBadge status={syncStatus} />}
          <button
            type="button"
            onClick={onClose}
            className="stpv2-close"
            title="Close"
            aria-label="Close deck theme panel"
            data-studio-theme-close="true"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {syncStatus === 'failed' && syncError && (
        <div data-studio-theme-notice="failed" role="alert" tabIndex={0} className="stpv2-notice">
          {syncError}
        </div>
      )}

      {/* The blank-canvas note (A3) shares the lock notice's slot, so this child list has the base's shape with the flag off. */}
      {locked ? (
        <div data-studio-theme-notice="locked" className="stpv2-notice stpv2-lock">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          <span>This deck is already building or built, so its theme is fixed. Start a new chat to pick a different one.</span>
        </div>
      ) : blankNote ? (
        <div data-studio-theme-notice="blank" role="note" className="stpv2-notice">
          <span>{blankNote}</span>
        </div>
      ) : false}

      {modeControl ? <>{currentRow}{modeControl}</> : currentRow}

      <div data-studio-theme-part="body" className="stpv2-body">
        {customMode ? (
          <div className="stpv2-custom">
            {!locked && (
              <button type="button" className="stpv2-link" onClick={onBackToPresets}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to preset themes
              </button>
            )}
            {customEditor}
          </div>
        ) : (
          <>
            {presetPicker ?? <div className="stpv2-grid">
              <button
                type="button"
                disabled={locked}
                onClick={onSelectAuto}
                data-studio-theme-preset="auto"
                aria-pressed={autoSelected}
                className="stpv2-card"
              >
                <span className="stpv2-tile stpv2-tile-auto" aria-hidden="true"><Sparkles className="h-5 w-5" /></span>
                <span className="stpv2-name">
                  Auto
                  {autoCurrent && <span className="stpv2-current-pill">Current</span>}
                </span>
                <span className="stpv2-sub">Director picks for you</span>
                {autoSelected && <span className="stpv2-check" aria-hidden="true"><Check className="h-3 w-3" /></span>}
              </button>
              {cards.map(card => (
                <button
                  type="button"
                  disabled={locked}
                  key={card.id}
                  onClick={() => onSelectPreset(card.id)}
                  data-studio-theme-preset={card.id}
                  aria-pressed={card.selected}
                  title={card.description}
                  className="stpv2-card"
                >
                  <ThemePickerTile canvas={card.canvas} hero={card.hero} lead={card.lead} ink={card.ink} />
                  <span className="stpv2-name">
                    {card.name}
                    {card.current && <span className="stpv2-current-pill">Current</span>}
                  </span>
                  <span className="sr-only">{card.description}</span>
                  {card.selected && <span className="stpv2-check" aria-hidden="true"><Check className="h-3 w-3" /></span>}
                </button>
              ))}
            </div>}
            {presetPicker ? null : <p className="stpv2-caption">Swatches show each theme’s main colours. The full theme also sets fonts and layout details.</p>}
            {brandKitLink ? <>{customRow}{brandKitLink}</> : customRow}
          </>
        )}
        {advanced}
      </div>

      <div data-studio-theme-part="footer" className="stpv2-footer">
        {locked ? (
          <>
            <Button variant="outline" onClick={onClose} className="stpv2-btn">Close</Button>
          </>
        ) : (
          <>
            <span className="stpv2-hint" role={invalidColor ? 'alert' : undefined} data-studio-theme-hint={invalidColor ? 'invalid' : 'info'}>{hint}</span>
            <Button variant="outline" onClick={onClose} className="stpv2-btn">Cancel</Button>
            <Button onClick={onApply} disabled={!canApply || syncStatus === 'syncing'} className="stpv2-btn stpv2-apply">
              {applyLabel}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export function ThemePanel({
  isOpen,
  onClose,
  presentationId,
  buildThemeSelection,
  themeSync,
  selectionLocked = false,
  onBuildThemeChange,
  blankNote: blankCopy,
}: ThemePanelProps) {
  const canonPalettes = useCanonPresetPalettes()
  const previewPaletteFor = (id: CanonicalThemePresetId): PreviewPalette => (
    canonPalettes[id] ?? PREVIEW_PALETTES[id] ?? PENDING_PREVIEW_PALETTE
  )
  const [draft, setDraft] = useState<BuildThemeSelection>(() => (
    normalizeThemePanelSelection(buildThemeSelection)
  ))
  const [submittedFromRequestId, setSubmittedFromRequestId] = useState<string | null | undefined>()
  // P2C: the mode staged for the next rebuild of this deck (flag on, built deck only). Panel state, scoped to the deck it was chosen on: it is never put in
  // the theme selection (a changed selection makes the page send `set_theme`), and nothing reads it to start a build.
  const [staged, setStaged] = useState<{ deckKey: string; mode: DeckPaletteMode } | null>(null)
  const deckKey = presentationId ?? ''
  const stagedMode = staged && staged.deckKey === deckKey ? staged.mode : null

  useEffect(() => {
    if (!isOpen) return
    setDraft(normalizeThemePanelSelection(buildThemeSelection))
    setSubmittedFromRequestId(undefined)
  }, [buildThemeSelection, isOpen, selectionLocked])

  useEffect(() => {
    if (submittedFromRequestId === undefined) return
    if (themeSync.requestId !== submittedFromRequestId || themeSync.status === 'failed') {
      setSubmittedFromRequestId(undefined)
    }
  }, [submittedFromRequestId, themeSync.requestId, themeSync.status])

  const mode: ThemeMode = draft.mode === 'custom' ? 'custom' : 'preset'
  const selectedPresetId = resolvedPresetId(draft)
  const selectedPreview = previewPaletteFor(selectedPresetId)
  const hasChanges = themeSelectionFingerprint(draft) !== themeSelectionFingerprint(buildThemeSelection)
  const syncBelongsToPresentation = !themeSync.presentationId
    || !presentationId
    || themeSync.presentationId === presentationId
  const visibleSyncStatus: ThemeSyncStatus = submittedFromRequestId !== undefined
    ? 'syncing'
    : syncBelongsToPresentation
      ? themeSync.status
      : 'idle'

  const invalidCustomColor = mode === 'custom' && (
    !isValidThemeHex(draft.primary_hex)
    || CUSTOM_COLOR_FIELDS.slice(1).some(({ key }) => {
      const value = draft[key]
      return Boolean(value && !isValidThemeHex(value))
    })
  )
  const invalidOverride = Object.values(draft.color_overrides || {}).some(value => !isValidThemeHex(value))
  const canApply = Boolean(
    onBuildThemeChange
    && !selectionLocked
    && !invalidCustomColor
    && !invalidOverride
    && (hasChanges || visibleSyncStatus === 'failed'),
  )

  const currentPalette = useMemo<PreviewPalette>(() => ({
    background: draft.color_overrides?.background || selectedPreview.background,
    surface: draft.color_overrides?.surface || selectedPreview.surface,
    primary: draft.primary_hex || draft.color_overrides?.primary || selectedPreview.primary,
    accent: draft.secondary_hex || draft.color_overrides?.accent || selectedPreview.accent,
    text: draft.color_overrides?.text_primary || selectedPreview.text,
  }), [draft, selectedPreview])

  if (!isOpen) return null

  const updateDraft = (next: BuildThemeSelection) => {
    if (selectionLocked) return
    setDraft(normalizeThemePanelSelection(next))
    setSubmittedFromRequestId(undefined)
  }

  const selectPreset = (presetId: string) => {
    updateDraft(selectCanonicalThemePreset(draft, presetId))
  }

  const selectAuto = () => {
    const retained = selectCanonicalThemePreset(draft, selectedPresetId)
    updateDraft({
      mode: 'auto',
      harmony_preference: draft.harmony_preference,
      palette_mode: draft.palette_mode,
      color_overrides: retained.color_overrides,
    })
  }

  const selectCustomMode = () => {
    if (draft.mode === 'custom') return
    updateDraft(carryThemeFonts(draft, {
      mode: 'custom',
      preset_id: selectedPresetId,
      primary_hex: draft.color_overrides?.primary || selectedPreview.primary,
      secondary_hex: draft.color_overrides?.secondary || selectedPreview.accent,
      tertiary_hex: draft.color_overrides?.tertiary,
      neutral_hex: draft.color_overrides?.neutral,
      harmony_preference: draft.harmony_preference || 'auto',
      palette_mode: customEntryPaletteMode(draft, THEME_DARK_MODE),
      color_overrides: draft.color_overrides ? { ...draft.color_overrides } : undefined,
    }))
  }

  const updateCustomColor = (
    key: typeof CUSTOM_COLOR_FIELDS[number]['key'],
    value: string,
  ) => {
    updateDraft({ ...draft, mode: 'custom', [key]: value || undefined })
  }

  const updateOverride = (key: string, value?: string) => {
    const nextOverrides = { ...(draft.color_overrides || {}) }
    if (value) nextOverrides[key] = value
    else delete nextOverrides[key]
    updateDraft({
      ...draft,
      color_overrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    })
  }

  const applyTheme = () => {
    if (selectionLocked || !canApply || !onBuildThemeChange) return
    const next = clampDarkOnlyPaletteMode(normalizeThemePanelSelection(draft), THEME_DARK_MODE)
    setSubmittedFromRequestId(themeSync.requestId)
    onBuildThemeChange(next)
  }

  // P2C: the Light | Dark control (flag on only). Before the build it edits the draft like any other control (Apply sends it); on a built deck
  // it stages "Rebuild in dark / light" in this panel and sends nothing.
  const deckModeControlFor = (variant: 'plain' | 'picker') => THEME_DARK_MODE ? (
    <DeckModeControl
      variant={variant}
      locked={selectionLocked}
      mode={effectivePaletteMode(draft, THEME_DARK_MODE)}
      staged={stagedMode}
      lightDisabled={lightDisabledFor(draft, THEME_DARK_MODE)}
      onChange={next => updateDraft(withPaletteMode(draft, next, THEME_DARK_MODE))}
      onStage={next => setStaged(next ? { deckKey, mode: next } : null)}
    />
  ) : null

  if (STUDIO_THEME_PICKER_V2 || STUDIO_THEME_DROPDOWN) {
    const currentSelection = normalizeThemePanelSelection(buildThemeSelection)
    const nameOf = (selection: BuildThemeSelection) => (
      selection.mode === 'auto'
        ? 'Auto (Director’s choice)'
        : selection.mode === 'custom'
          ? 'Custom colours'
          : THEME_PREVIEWS.find(theme => theme.id === resolvedPresetId(selection))?.name ?? 'Preset theme'
    )
    const currentPresetId = currentSelection.mode === 'preset' ? resolvedPresetId(currentSelection) : null
    // PASS2D A3: on the blank canvas (flag on, the viewer passes blankNote) an applied theme is not painted until Director builds slides; say so.
    const blankNote = blankCopy && !selectionLocked ? blankCopy : undefined
    const cards: ThemePickerCard[] = THEME_PREVIEWS.map(theme => {
      const colors = previewPaletteFor(theme.id)
      const swatch = colors.swatch ?? { canvas: colors.background, hero: colors.primary, lead: colors.accent }
      return {
        id: theme.id,
        name: theme.name,
        description: theme.description,
        selected: draft.mode === 'preset' && selectedPresetId === theme.id,
        current: currentPresetId === theme.id,
        ...swatch,
        ink: readableInk(swatch.canvas),
      }
    })
    // PASS2-PK-FOUR item 3: the dropdown takes the grid's place. The same presets in the same order (Auto first); it picks through the
    // same selectAuto / selectPreset, so the draft, the Apply payload and the lock rule are the grid's.
    let presetPicker: ReactNode
    if (STUDIO_THEME_DROPDOWN) {
      const options: ThemeDropdownOption[] = [
        { id: 'auto', name: 'Auto', hint: 'Director picks for you', swatches: [], current: currentSelection.mode === 'auto' },
        ...THEME_PREVIEWS.map(theme => {
          const colors = previewPaletteFor(theme.id)
          return {
            id: theme.id,
            name: theme.name,
            hint: theme.description,
            swatches: themeDropdownSwatches({
              hero: colors.swatch?.hero,
              primary: colors.primary,
              accent: colors.accent,
              text: colors.text,
              surface: colors.surface,
              background: colors.background,
            }),
            current: currentPresetId === theme.id,
          }
        }),
      ]
      const selectedTheme = THEME_PREVIEWS.find(theme => theme.id === selectedPresetId)
      const dropdownPreview: ThemeDropdownPreviewData = draft.mode === 'auto' || !selectedTheme
        ? { kind: 'auto' }
        : themeDropdownPreview({
          name: selectedTheme.name,
          description: selectedTheme.description,
          colors: selectedPreview,
          overrides: draft.color_overrides,
          fontSource: draft,
        })
      presetPicker = (
        <ThemeDropdownPicker
          options={options}
          selectedId={draft.mode === 'auto' ? 'auto' : draft.mode === 'preset' ? selectedPresetId : null}
          locked={selectionLocked}
          preview={blankNote && dropdownPreview.kind === 'theme' ? { ...dropdownPreview, applyNote: blankNote.previewNote } : dropdownPreview}
          onSelect={id => { if (id === 'auto') selectAuto(); else selectPreset(id) }}
        />
      )
    }
    const overrideCount = Object.keys(draft.color_overrides || {}).length
    // Same fields, seeds, labels and handlers as the "Build custom" tab and the token overrides below.
    const customEditor = (
      <>
        <div className="stpv2-palette" style={{ background: currentPalette.background, color: currentPalette.text }}>
          <span style={{ background: currentPalette.primary }} />
          <span style={{ background: currentPalette.accent }} />
          <span style={{ background: currentPalette.surface }} />
        </div>
        <p className="stpv2-caption">Palette guide only. Director applies the complete Theme Builder contract, including typography and component treatments.</p>
        <h3 className="stpv2-heading-small">Custom palette</h3>
        <p className="stpv2-caption">These values are explicit literals and stay fixed when a named theme changes.</p>
        {CUSTOM_COLOR_FIELDS.map(({ key, label }, index) => (
          <HexField
            key={key}
            label={label}
            value={draft[key]}
            fallback={index === 0 ? selectedPreview.primary : index === 1 ? selectedPreview.accent : selectedPreview.surface}
            linkedLabel="Generated from primary"
            disabled={selectionLocked}
            onChange={value => updateCustomColor(key, value)}
            onReset={() => updateCustomColor(key, '')}
          />
        ))}
      </>
    )
    const overrideFallbacks: Record<string, string> = {
      primary: currentPalette.primary,
      secondary: selectedPreview.accent,
      tertiary: selectedPreview.surface,
      neutral: selectedPreview.surface,
      accent: currentPalette.accent,
      background: currentPalette.background,
      surface: currentPalette.surface,
      text_primary: currentPalette.text,
      text_body: currentPalette.text,
      border: selectedPreview.surface,
    }
    const advanced = !selectionLocked || overrideCount > 0 ? (
      <details className="stpv2-advanced" data-studio-theme-advanced="true">
        <summary>Fine-tune individual colours{overrideCount > 0 ? ` (${overrideCount} set)` : ''}</summary>
        <div className="stpv2-advanced-body">
          <p className="stpv2-caption">Empty values stay linked to the selected theme.</p>
          {overrideCount > 0 && (
            <button
              type="button"
              className="stpv2-link"
              disabled={selectionLocked}
              onClick={() => updateDraft({ ...draft, color_overrides: undefined })}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset all
            </button>
          )}
          {OVERRIDE_TOKENS.map(({ key, label }) => (
            <HexField
              key={key}
              label={label}
              value={draft.color_overrides?.[key]}
              fallback={overrideFallbacks[key]}
              disabled={selectionLocked}
              onChange={value => updateOverride(key, value)}
              onReset={() => updateOverride(key)}
            />
          ))}
          {draft.color_overrides && Object.keys(draft.color_overrides).some(
            key => !OVERRIDE_TOKENS.some(token => token.key === key),
          ) && (
            <p className="stpv2-caption">Additional saved overrides are retained when you apply this theme.</p>
          )}
        </div>
      </details>
    ) : null
    return (
      <ThemePickerV2
        locked={selectionLocked}
        syncStatus={visibleSyncStatus}
        syncError={themeSync.error}
        currentLabel={nameOf(currentSelection)}
        selectedLabel={nameOf(draft)}
        hasChanges={hasChanges}
        autoSelected={draft.mode === 'auto'}
        autoCurrent={currentSelection.mode === 'auto'}
        cards={cards}
        customMode={mode === 'custom'}
        customEditor={customEditor}
        advanced={advanced}
        presetPicker={presetPicker}
        modeControl={deckModeControlFor('picker')}
        canApply={canApply}
        applyLabel={visibleSyncStatus === 'syncing'
          ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Applying</>
          : visibleSyncStatus === 'failed' && !hasChanges
            ? 'Try again'
            : 'Apply theme'}
        invalidColor={invalidCustomColor || invalidOverride}
        onSelectAuto={selectAuto}
        onSelectPreset={selectPreset}
        onBuildCustom={selectCustomMode}
        onBackToPresets={() => { if (draft.mode === 'custom') selectPreset(selectedPresetId) }}
        onApply={applyTheme}
        onClose={onClose}
        {...(blankNote ? { blankNote: blankNote.note } : {})}
      />
    )
  }

  const deckModeControl = deckModeControlFor('plain')
  // The lock note as the base drew it (a const so the Light | Dark control can follow it without adding a child when there is none).
  const lockedNotice = selectionLocked && (
    <div data-studio-theme-notice={STUDIO_THEME_PANEL ? 'locked' : undefined} tabIndex={STUDIO_THEME_PANEL ? 0 : undefined} className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
      Template and theme choices are locked once generation starts. Start a new chat to choose different build settings.
    </div>
  )
  return (
    <div data-studio-theme={STUDIO_THEME_PANEL ? 'true' : undefined} data-studio-v4-dialog={process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' ? 'theme' : undefined} role="dialog" aria-modal="false" aria-label="Deck theme" className="fixed inset-y-0 left-0 z-50 flex w-96 flex-col border-r border-gray-200 bg-white shadow-2xl">
      <div data-studio-theme-part={STUDIO_THEME_PANEL ? 'header' : undefined} className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-900">Deck theme</h2>
          <SyncBadge status={visibleSyncStatus} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 transition-colors hover:bg-gray-200"
          title="Close panel"
          aria-label={STUDIO_THEME_PANEL ? 'Close deck theme panel' : undefined}
          data-studio-theme-close={STUDIO_THEME_PANEL ? 'true' : undefined}
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {visibleSyncStatus === 'failed' && themeSync.error && (
        <div data-studio-theme-notice={STUDIO_THEME_PANEL ? 'failed' : undefined} role={STUDIO_THEME_PANEL ? 'alert' : undefined} tabIndex={STUDIO_THEME_PANEL ? 0 : undefined} className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {themeSync.error}
        </div>
      )}

      {deckModeControl ? <>{lockedNotice}{deckModeControl}</> : lockedNotice}

      <div className="border-b border-gray-200 px-3 py-2">
        <div className="flex rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            disabled={selectionLocked}
            data-studio-theme-mode={STUDIO_THEME_PANEL ? 'preset' : undefined}
            aria-pressed={STUDIO_THEME_PANEL ? mode === 'preset' : undefined}
            onClick={() => {
              if (draft.mode === 'custom') selectPreset(selectedPresetId)
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50',
              mode === 'preset' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
            )}
          >
            <Palette className="h-3 w-3" /> Preset themes
          </button>
          <button
            type="button"
            disabled={selectionLocked}
            onClick={selectCustomMode}
            data-studio-theme-mode={STUDIO_THEME_PANEL ? 'custom' : undefined}
            aria-pressed={STUDIO_THEME_PANEL ? mode === 'custom' : undefined}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50',
              mode === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
            )}
          >
            <Wand2 className="h-3 w-3" /> Build custom
          </button>
        </div>
      </div>

      <div data-studio-theme-part={STUDIO_THEME_PANEL ? 'body' : undefined} className="flex-1 space-y-4 overflow-y-auto p-3">
        {draft.mode === 'auto' ? (
          <div data-studio-theme-notice={STUDIO_THEME_PANEL ? 'auto' : undefined} className="rounded-lg border border-sky-100 bg-sky-50 p-2.5 text-[10px] leading-4 text-sky-700">
            Auto is resolved by Director from the session default. Apply it to see the authoritative Theme Builder result on the deck.
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 p-2.5">
            <div
              className="flex h-16 items-center justify-center gap-2 rounded-md"
              style={{ background: currentPalette.background, color: currentPalette.text }}
            >
              <div className="h-9 w-16 rounded" style={{ background: currentPalette.primary }} />
              <div className="h-9 w-10 rounded" style={{ background: currentPalette.accent }} />
              <div className="h-9 w-8 rounded border" style={{ background: currentPalette.surface }} />
            </div>
            <p className="mt-2 text-[10px] leading-4 text-gray-500">
              Palette guide only. Director applies the complete Theme Builder contract, including typography and component treatments.
            </p>
          </div>
        )}

        {mode === 'preset' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={selectionLocked}
                onClick={selectAuto}
                data-studio-theme-preset={STUDIO_THEME_PANEL ? 'auto' : undefined}
                aria-pressed={STUDIO_THEME_PANEL ? draft.mode === 'auto' : undefined}
                className={cn(
                  'col-span-2 rounded-lg border-2 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                  draft.mode === 'auto' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <span className="flex items-center justify-between text-[11px] font-medium text-gray-800">
                  Auto / session default
                  {draft.mode === 'auto' && <Check className="h-4 w-4 text-blue-500" />}
                </span>
                <span className="text-[10px] text-gray-500">Use the Director session’s resolved theme.</span>
              </button>
              {THEME_PREVIEWS.map(theme => {
                const selected = draft.mode === 'preset' && selectedPresetId === theme.id
                const colors = previewPaletteFor(theme.id)
                const swatch = colors.swatch ?? { canvas: colors.background, hero: colors.primary, lead: colors.accent }
                return (
                  <button
                    type="button"
                    disabled={selectionLocked}
                    key={theme.id}
                    onClick={() => selectPreset(theme.id)}
                    data-studio-theme-preset={STUDIO_THEME_PANEL ? theme.id : undefined}
                    aria-pressed={STUDIO_THEME_PANEL ? selected : undefined}
                    className={cn(
                      'relative rounded-lg border-2 p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="mb-2 flex h-9 gap-1 rounded p-1" style={{ background: swatch.canvas }}>
                      <span className="flex-1 rounded" style={{ background: swatch.hero }} />
                      <span className="w-7 rounded" style={{ background: swatch.lead }} />
                    </div>
                    <div className="pr-4 text-[11px] font-medium text-gray-900">{theme.name}</div>
                    <div className="mt-0.5 line-clamp-2 text-[9px] leading-3 text-gray-500">{theme.description}</div>
                    {selected && <Check className="absolute right-2 top-2 h-4 w-4 text-blue-500" />}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Custom palette</h3>
              <p className="mt-1 text-[10px] text-gray-500">These values are explicit literals and stay fixed when a named theme changes.</p>
            </div>
            {CUSTOM_COLOR_FIELDS.map(({ key, label }, index) => (
              <HexField
                key={key}
                label={label}
                value={draft[key]}
                fallback={index === 0 ? selectedPreview.primary : index === 1 ? selectedPreview.accent : selectedPreview.surface}
                linkedLabel="Generated from primary"
                disabled={selectionLocked}
                onChange={value => updateCustomColor(key, value)}
                onReset={() => updateCustomColor(key, '')}
              />
            ))}
          </div>
        )}

        <div className="space-y-2 border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Explicit token overrides</h3>
              <p className="mt-1 text-[10px] text-gray-500">Empty values remain linked to the selected theme.</p>
            </div>
            {draft.color_overrides && Object.keys(draft.color_overrides).length > 0 && (
              <button
                type="button"
                disabled={selectionLocked}
                onClick={() => updateDraft({ ...draft, color_overrides: undefined })}
                className="inline-flex shrink-0 items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" /> Reset all
              </button>
            )}
          </div>
          {OVERRIDE_TOKENS.map(({ key, label }) => {
            const fallbacks: Record<string, string> = {
              primary: currentPalette.primary,
              secondary: selectedPreview.accent,
              tertiary: selectedPreview.surface,
              neutral: selectedPreview.surface,
              accent: currentPalette.accent,
              background: currentPalette.background,
              surface: currentPalette.surface,
              text_primary: currentPalette.text,
              text_body: currentPalette.text,
              border: selectedPreview.surface,
            }
            return (
              <HexField
                key={key}
                label={label}
                value={draft.color_overrides?.[key]}
                fallback={fallbacks[key]}
                disabled={selectionLocked}
                onChange={value => updateOverride(key, value)}
                onReset={() => updateOverride(key)}
              />
            )
          })}
          {draft.color_overrides && Object.keys(draft.color_overrides).some(
            key => !OVERRIDE_TOKENS.some(token => token.key === key),
          ) && (
            <p className="rounded-md bg-gray-50 px-2 py-1.5 text-[10px] text-gray-500">
              Additional saved overrides are retained when you apply this theme.
            </p>
          )}
        </div>
      </div>

      <div data-studio-theme-part={STUDIO_THEME_PANEL ? 'footer' : undefined} className="border-t border-gray-200 bg-gray-50 px-3 py-2">
        {(invalidCustomColor || invalidOverride) && (
          <p role={STUDIO_THEME_PANEL ? 'alert' : undefined} className="mb-2 text-[10px] text-rose-600">Custom themes require a primary six-digit hex color, such as #1e40af.</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="h-7 flex-1 text-[11px]">
            Close
          </Button>
          <Button
            onClick={applyTheme}
            disabled={!canApply || visibleSyncStatus === 'syncing'}
            className="h-7 flex-1 text-[11px]"
          >
            {visibleSyncStatus === 'syncing' ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Syncing</>
            ) : visibleSyncStatus === 'failed' && !hasChanges ? (
              'Retry'
            ) : (
              'Apply through Director'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
