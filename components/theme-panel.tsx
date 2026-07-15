"use client"

import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  Palette,
  RotateCcw,
  Wand2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  CANONICAL_THEME_PRESET_IDS,
  FALLBACK_THEME_PRESETS,
  isCanonicalThemePresetId,
  isValidThemeHex,
  normalizeThemePanelSelection,
  normalizeThemePresetId,
  selectCanonicalThemePreset,
  type BuildThemeSelection,
  type CanonicalThemePresetId,
} from '@/lib/theme-builder'
import type { ThemeSyncState, ThemeSyncStatus } from '@/lib/theme-sync'

type ThemeMode = 'preset' | 'custom'

type PreviewPalette = {
  background: string
  surface: string
  primary: string
  accent: string
  text: string
}

const PREVIEW_PALETTES: Record<CanonicalThemePresetId, PreviewPalette> = {
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

const THEME_PREVIEWS = CANONICAL_THEME_PRESET_IDS.map(id => ({
  id,
  ...FALLBACK_THEME_PRESETS.find(preset => preset.preset_id === id)!,
  colors: PREVIEW_PALETTES[id],
}))

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
  onBuildThemeChange?: (selection: BuildThemeSelection) => void
}

function selectionFingerprint(selection: BuildThemeSelection): string {
  const normalized = normalizeThemePanelSelection(selection)
  const overrides = normalized.color_overrides
    ? Object.fromEntries(Object.entries(normalized.color_overrides).sort(([a], [b]) => a.localeCompare(b)))
    : undefined
  return JSON.stringify({ ...normalized, color_overrides: overrides })
}

function resolvedPresetId(selection: BuildThemeSelection): CanonicalThemePresetId {
  const normalized = normalizeThemePresetId(selection.preset_id)
  return isCanonicalThemePresetId(normalized) ? normalized : 'corporate_light'
}

function SyncBadge({ status }: { status: ThemeSyncStatus }) {
  if (status === 'syncing') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-700">
        <Loader2 className="h-3 w-3 animate-spin" /> Syncing
      </span>
    )
  }
  if (status === 'applied') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> Applied
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[10px] font-medium text-rose-700">
        <AlertCircle className="h-3 w-3" /> Failed
      </span>
    )
  }
  return <span className="text-[10px] text-gray-400">Not synced</span>
}

function HexField({
  label,
  value,
  fallback,
  linkedLabel,
  onChange,
  onReset,
}: {
  label: string
  value?: string
  fallback: string
  linkedLabel?: string
  onChange: (value: string) => void
  onReset?: () => void
}) {
  const validValue = isValidThemeHex(value) ? value : fallback
  const isExplicit = value !== undefined

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-gray-700">{label}</span>
        {isExplicit ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800"
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
          className="h-8 w-9 rounded border border-gray-200 bg-white p-0.5"
          aria-label={`${label} color`}
        />
        <input
          value={value || ''}
          onChange={event => onChange(event.target.value)}
          className={cn(
            'h-8 min-w-0 flex-1 rounded-md border bg-white px-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-200',
            value && !isValidThemeHex(value) ? 'border-rose-400 text-rose-700' : 'border-gray-200 text-gray-700',
          )}
          placeholder={isExplicit ? '#000000' : `Theme (${fallback})`}
          aria-label={`${label} hex value`}
        />
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
  onBuildThemeChange,
}: ThemePanelProps) {
  const [draft, setDraft] = useState<BuildThemeSelection>(() => (
    normalizeThemePanelSelection(buildThemeSelection)
  ))
  const [submittedFromRequestId, setSubmittedFromRequestId] = useState<string | null | undefined>()

  useEffect(() => {
    if (!isOpen) return
    setDraft(normalizeThemePanelSelection(buildThemeSelection))
    setSubmittedFromRequestId(undefined)
  }, [buildThemeSelection, isOpen])

  useEffect(() => {
    if (submittedFromRequestId === undefined) return
    if (themeSync.requestId !== submittedFromRequestId || themeSync.status === 'failed') {
      setSubmittedFromRequestId(undefined)
    }
  }, [submittedFromRequestId, themeSync.requestId, themeSync.status])

  const mode: ThemeMode = draft.mode === 'custom' ? 'custom' : 'preset'
  const selectedPresetId = resolvedPresetId(draft)
  const selectedPreview = PREVIEW_PALETTES[selectedPresetId]
  const hasChanges = selectionFingerprint(draft) !== selectionFingerprint(buildThemeSelection)
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
    updateDraft({
      mode: 'custom',
      preset_id: selectedPresetId,
      primary_hex: draft.color_overrides?.primary || selectedPreview.primary,
      secondary_hex: draft.color_overrides?.secondary || selectedPreview.accent,
      tertiary_hex: draft.color_overrides?.tertiary,
      neutral_hex: draft.color_overrides?.neutral,
      harmony_preference: draft.harmony_preference || 'auto',
      palette_mode: draft.palette_mode || 'both',
      color_overrides: draft.color_overrides ? { ...draft.color_overrides } : undefined,
    })
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
    if (!canApply || !onBuildThemeChange) return
    const next = normalizeThemePanelSelection(draft)
    setSubmittedFromRequestId(themeSync.requestId)
    onBuildThemeChange(next)
  }

  return (
    <div className="fixed inset-y-0 left-0 z-50 flex w-96 flex-col border-r border-gray-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-gray-900">Deck theme</h2>
          <SyncBadge status={visibleSyncStatus} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 transition-colors hover:bg-gray-200"
          title="Close panel"
        >
          <X className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {visibleSyncStatus === 'failed' && themeSync.error && (
        <div className="border-b border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
          {themeSync.error}
        </div>
      )}

      <div className="border-b border-gray-200 px-3 py-2">
        <div className="flex rounded-lg bg-gray-100 p-0.5">
          <button
            type="button"
            onClick={() => {
              if (draft.mode === 'custom') selectPreset(selectedPresetId)
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all',
              mode === 'preset' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
            )}
          >
            <Palette className="h-3 w-3" /> Preset themes
          </button>
          <button
            type="button"
            onClick={selectCustomMode}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-all',
              mode === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900',
            )}
          >
            <Wand2 className="h-3 w-3" /> Build custom
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {draft.mode === 'auto' ? (
          <div className="rounded-lg border border-sky-100 bg-sky-50 p-2.5 text-[10px] leading-4 text-sky-700">
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
                onClick={selectAuto}
                className={cn(
                  'col-span-2 rounded-lg border-2 px-3 py-2 text-left transition-colors',
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
                return (
                  <button
                    type="button"
                    key={theme.id}
                    onClick={() => selectPreset(theme.id)}
                    className={cn(
                      'relative rounded-lg border-2 p-2 text-left transition-colors',
                      selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                    )}
                  >
                    <div className="mb-2 flex h-9 gap-1 rounded p-1" style={{ background: theme.colors.background }}>
                      <span className="flex-1 rounded" style={{ background: theme.colors.primary }} />
                      <span className="w-7 rounded" style={{ background: theme.colors.accent }} />
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
                onClick={() => updateDraft({ ...draft, color_overrides: undefined })}
                className="inline-flex shrink-0 items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800"
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

      <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
        {(invalidCustomColor || invalidOverride) && (
          <p className="mb-2 text-[10px] text-rose-600">Custom themes require a primary six-digit hex color, such as #1e40af.</p>
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
