"use client"

import { ArrowRight, Check, ChevronLeft, Loader2, Palette, Sparkles, X } from 'lucide-react'
import { isValidThemeHex, type BuildThemeSelection, type ThemePresetSummary } from '@/lib/theme-builder'
import type { SavedThemeProfile } from '@/hooks/use-theme-profiles'
import './studio-theme-menu.css'

export type StudioThemeView = 'choices' | 'save' | 'manage'
export type StudioThemeMutationKind = 'save' | 'set-standard' | 'clear-standard' | 'delete'
export type StudioThemeMutationNotice = {
  kind: StudioThemeMutationKind
  phase: 'loading' | 'failed' | 'success' | 'uncertain'
  message: string
}

export interface StudioThemeMenuProps {
  view: StudioThemeView
  onView: (view: StudioThemeView) => void
  onClose: () => void
  selection: BuildThemeSelection
  presets: ThemePresetSummary[]
  presetsLoading: boolean
  presetsError: boolean
  themes: SavedThemeProfile[]
  selectedId: string | null
  currentProfile?: { id: string; name: string } | null
  activeTheme?: SavedThemeProfile
  standardTheme?: SavedThemeProfile
  onPreset: (id: string) => void
  onSaved: (id: string) => void
  hex: string
  onHex: (hex: string) => void
  locked: boolean
  lockReason: string | null
  readBusy: boolean
  readFailed: boolean
  readEmpty: boolean
  onRefresh: () => void
  requestedTheme?: SavedThemeProfile
  name: string
  onName: (name: string) => void
  asStandard: boolean
  onAsStandard: (checked: boolean) => void
  mutation: StudioThemeMutationNotice | null
  onSave: () => void
  onSetStandard: () => void
  onClearStandard: () => void
  onDelete: () => void
}

// Presentation only: all request ownership, acknowledgments and native callbacks
// remain in ChatInput. Saved chips use explicit primary colors only; unknown
// palettes retain the neutral glyph rather than implying generated colors.
function savedPrimaryColor(selection: BuildThemeSelection | null | undefined) {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return undefined
  const valid = (value: unknown): value is string => typeof value === 'string' && isValidThemeHex(value)
  const primaryOverride = selection.color_overrides?.primary
  if (valid(primaryOverride)) return primaryOverride
  if (selection.mode === 'custom' && valid(selection.primary_hex)) return selection.primary_hex
  return undefined
}
export function StudioThemeMenu(p: StudioThemeMenuProps) {
  const mutationBusy = p.mutation?.phase === 'loading'
  const busyProps = { 'aria-disabled': mutationBusy ? true : undefined, 'aria-busy': mutationBusy ? true : undefined }
  const notices = <>
    {p.lockReason && <p className="studio-theme-note">{p.lockReason}</p>}
    {p.presetsError && <p className="studio-theme-note">Using local preset list</p>}
    {p.readFailed && !p.readBusy && <p role="status" data-studio-theme-read-error="true" className="studio-theme-note">Could not refresh saved themes. Your current theme and unsent changes are kept. Retry to load My themes.</p>}
    {p.requestedTheme && <p data-studio-v4-saved-theme-request="true" className="studio-theme-note">From Themes: <strong>{p.requestedTheme.name}</strong>. Choose it in My themes to apply it.</p>}
    {p.mutation && <p role="status" data-studio-theme-mutation-state={p.mutation.phase} data-studio-theme-mutation-kind={p.mutation.kind} className="studio-theme-note">{mutationBusy && <Loader2 aria-hidden="true" className="studio-theme-spinner" />}{p.mutation.message}</p>}
  </>
  const libraryHeading = <div className="studio-theme-library-heading">
    <span>My themes</span>
    <button type="button" data-studio-theme-read-refresh="true" aria-label={p.readFailed ? 'Retry loading saved themes' : 'Refresh saved themes'} disabled={p.locked} aria-disabled={p.readBusy ? true : undefined} aria-busy={p.readBusy ? true : undefined} onClick={p.onRefresh}>
      {p.readBusy && <Loader2 aria-hidden="true" className="studio-theme-spinner" />}{p.readFailed ? 'Retry' : 'Refresh'}
    </button>
  </div>
  const empty = p.readEmpty && <p data-studio-theme-read-empty="true" className="studio-theme-empty">No saved themes yet.</p>
  const brand = <div className="studio-theme-brand" data-studio-theme-brand-selected={p.selection.mode === 'custom' && !p.selectedId ? 'true' : undefined}>
    <span>Brand color</span>
    <input type="color" aria-label="Brand color" value={isValidThemeHex(p.hex) ? p.hex : '#1e40af'} onChange={event => p.onHex(event.target.value)} disabled={p.locked} />
    <input aria-label="Brand hex color" placeholder="#1e40af" value={p.hex} onChange={event => p.onHex(event.target.value)} disabled={p.locked} />
  </div>
  const row = (id: string, name: string, chosen: boolean, choose: () => void, description?: string, auto = false, disabled = p.locked, color?: string) => <button type="button" key={id} data-studio-theme-choice={id} data-studio-theme-selected={chosen ? 'true' : 'false'} aria-pressed={chosen} aria-label={auto ? 'Auto / default' : `Choose ${name}`} title={description} disabled={disabled} onClick={choose} className="studio-theme-choice">
    <span className="studio-theme-glyph" data-studio-theme-color={color} style={color ? { backgroundColor: color } : undefined} aria-hidden="true">{color ? null : auto ? <Sparkles /> : <Palette />}</span>
    <span className="studio-theme-choice-name">{name}{auto && <small>{p.standardTheme ? `Your standard theme · ${p.standardTheme.name}` : 'Use the default theme'}</small>}</span>
    {chosen && <Check aria-hidden="true" className="studio-theme-check" />}
  </button>
  return <div data-studio-theme-view={p.view} data-studio-theme-selection={p.selectedId || ''} className="studio-theme-menu">
    <div className="studio-theme-heading">
      {p.view !== 'choices' && <button type="button" data-studio-theme-action="back" aria-label="Back to theme choices" onClick={() => p.onView('choices')}><ChevronLeft aria-hidden="true" /></button>}
      <strong>{p.view === 'choices' ? 'Build theme' : p.view === 'save' ? 'Save or set standard' : 'Manage themes'}</strong>
      <button type="button" data-studio-theme-action="close" aria-label="Close build theme" onClick={p.onClose}><X aria-hidden="true" /></button>
    </div>
    {p.view === 'choices' ? <>
      <div className="studio-theme-choices" aria-label="Build theme choices">
        {row('auto', 'Auto', p.selection.mode === 'auto' && !p.selectedId, () => p.onPreset('auto'), undefined, true, p.locked || p.presetsLoading)}
        {p.presets.map(preset => row(`preset:${preset.preset_id}`, preset.name, p.selection.mode === 'preset' && p.selection.preset_id === preset.preset_id && !p.selectedId, () => p.onPreset(preset.preset_id), preset.description, false, p.locked || p.presetsLoading))}
      </div>
      <div className="studio-theme-library">
        {libraryHeading}
        {p.themes.map(theme => row(`saved:${theme.id}`, theme.name, p.selectedId === theme.id, () => p.onSaved(theme.id), theme.is_standard ? 'Standard theme' : undefined, false, p.locked, savedPrimaryColor(theme.theme_payload)))}
        {empty}
        {p.currentProfile && p.selectedId === p.currentProfile.id && !p.themes.some(theme => theme.id === p.selectedId) && <p data-studio-theme-current="true" className="studio-theme-empty">Current theme: {p.currentProfile.name}</p>}
      </div>
      {brand}
      {notices}
      <div className="studio-theme-footer">
        <button type="button" data-studio-theme-action="save-entry" onClick={() => p.onView('save')}>Save or set standard…</button>
        <button type="button" data-studio-theme-action="manage-entry" onClick={() => p.onView('manage')}>Manage themes <ArrowRight aria-hidden="true" /></button>
      </div>
    </> : <>
      <div className="studio-theme-library">
        {libraryHeading}
        <select aria-label="Saved theme" value={p.selectedId || ''} onChange={event => p.onSaved(event.target.value)} disabled={p.locked}>
          <option value="">Select saved theme</option>
          {p.themes.map(theme => <option key={theme.id} value={theme.id}>{theme.is_standard ? '★ ' : ''}{theme.name}</option>)}
        </select>
        {empty}
        {p.activeTheme && <div className="studio-theme-management-actions">
          <button type="button" data-studio-theme-action="set-standard" aria-label="Set as standard" disabled={p.locked} {...busyProps} onClick={p.onSetStandard}>{p.activeTheme.is_standard ? 'Standard' : 'Set standard'}</button>
          <button type="button" data-studio-theme-action="delete" aria-label="Delete saved theme" disabled={p.locked} {...busyProps} onClick={p.onDelete}>Delete</button>
        </div>}
        {p.standardTheme && <div className="studio-theme-standard-line"><span>Standard: {p.standardTheme.name}</span><button type="button" data-studio-theme-action="clear-standard" aria-label="Clear standard theme" disabled={p.locked} {...busyProps} onClick={p.onClearStandard}>Clear</button></div>}
      </div>
      {p.view === 'save' && <div className="studio-theme-save-fields">
        <label htmlFor="studio-native-theme-name">Save current theme</label>
        <div className="studio-theme-save-row">
          <input id="studio-native-theme-name" aria-label="Theme name" placeholder="Theme name" value={p.name} disabled={p.locked} onChange={event => p.onName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); p.onSave() } }} />
          <button type="button" data-studio-theme-action="save" aria-label="Save current theme" disabled={p.locked} aria-disabled={mutationBusy || p.readBusy || p.selection.mode === 'auto' || !p.name.trim() ? true : undefined} aria-busy={mutationBusy ? true : undefined} onClick={p.onSave}>Save</button>
        </div>
        <label className="studio-theme-standard-checkbox"><input type="checkbox" checked={p.asStandard} disabled={p.locked} onChange={event => p.onAsStandard(event.target.checked)} />Set as standard</label>
        {p.selection.mode === 'auto' && <p className="studio-theme-empty">Choose a preset or brand color to save a theme.</p>}
      </div>}
      {notices}
    </>}
  </div>
}
