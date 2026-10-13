"use client"

import "./studio-theme-dropdown.css"

import { useEffect, useId, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { isValidThemeHex } from '@/lib/theme-builder'
import { ensureThemeFontStylesheet, themeFontCss, themeFontFields } from '@/lib/theme-fonts'

// PASS2-PK-FOUR item 3 (flag NEXT_PUBLIC_STUDIO_THEME_DROPDOWN, exact "true", default off; Studio shell only): the preset choice of the
// theme picker as a searchable dropdown, with a preview of the selected theme underneath. Presentation and UI state only (open, the
// filter text, the highlighted row): ThemePanel keeps the draft, the handlers, Apply and the lock rule, and passes them in. Nothing
// here fetches anything or touches the deck; the preview is drawn from the colours the panel already holds.

export type ThemeDropdownOption = {
  /** 'auto', or a preset id. */
  id: string
  name: string
  /** Tooltip. */
  hint: string
  /** 4-5 hex colours; none for Auto. */
  swatches: string[]
  /** The theme the deck has now: pinned to the top of the list. */
  current: boolean
  /** PASS2-COMPOSER-POPUPS: a second line in place of the swatches ('' draws nothing). Absent: the default wording for an option without swatches. */
  sub?: string
  /** PASS2-COMPOSER-POPUPS: the text a search matches (default: the name). */
  search?: string
  /** PASS2-COMPOSER-POPUPS: drawn quieter (an option that is listed but cannot be used yet). */
  muted?: boolean
}

/**
 * The wording and extras of one dropdown. The theme picker uses the defaults, so its markup is unchanged; the composer's popups
 * (PASS2-COMPOSER-POPUPS) pass their own (a "Deckster templates" or "My templates" list, no preview, no group headings).
 */
export type ThemeDropdownCopy = {
  label: string
  /** The line beside the label. null: none. */
  help: string | null
  placeholder: string
  /** For the empty list ("No {plural} match") and the screen-reader count. */
  singular: string
  plural: string
  /** false: the options are listed without group headings. */
  groups: boolean
  /** What an empty list says when nothing was typed ("No saved themes yet."). Absent: the same "No {plural} match" line as a search with no hits. */
  none?: string
}
export const THEME_DROPDOWN_COPY: ThemeDropdownCopy = {
  label: 'Theme',
  help: 'Type to search',
  placeholder: 'Search themes',
  singular: 'theme',
  plural: 'themes',
  groups: true,
}

export type ThemeDropdownPreviewData =
  | { kind: 'auto' }
  | {
      kind: 'theme'
      name: string
      description: string
      hero: string
      heroInk: string
      heroRule: string
      canvas: string
      surface: string
      surfaceInk: string
      lead: string
      leadInk: string
      accent: string
      accentInk: string
      text: string
      body: string
      headingFont?: string
      bodyFont?: string
    }

// ── colour helpers (pure) ──────────────────────────────────────────────────────────────────────────────────────────────

function relativeLuminance(hex: string): number {
  if (!isValidThemeHex(hex)) return 1
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

const DARK_INK = '#1b2430'
const LIGHT_INK = '#f8fafc'

/** Whichever of the dark and light ink reads better on `ground` (dark ink for anything that is not a six-digit hex). */
export function inkFor(ground: string): string {
  if (!isValidThemeHex(ground)) return DARK_INK
  return contrastRatio(ground, DARK_INK) >= contrastRatio(ground, LIGHT_INK) ? DARK_INK : LIGHT_INK
}

/** Up to five distinct colours for a row, in the order the eye reads a theme: title ground, brand, accent, text, then the light grounds. */
export function themeDropdownSwatches(colors: {
  hero?: string
  primary: string
  accent: string
  text: string
  surface: string
  background: string
}): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const hex of [colors.hero ?? colors.primary, colors.primary, colors.accent, colors.text, colors.surface, colors.background]) {
    const key = hex.toLowerCase()
    if (!isValidThemeHex(hex) || seen.has(key)) continue
    seen.add(key)
    out.push(hex)
  }
  return out.slice(0, 5)
}

/**
 * What the preview draws for a preset: the title ground, the content ground, the lead and accent colours and the text colours, with the
 * deck's own explicit colour overrides applied (a valid hex only) so the preview follows "Fine-tune individual colours".
 * `colors` is the panel's palette for the preset; `swatch` is present when Theme Builder's own contract answered.
 */
export function themeDropdownPreview({
  name,
  description,
  colors,
  overrides,
  fontSource,
}: {
  name: string
  description: string
  colors: {
    background: string
    surface: string
    primary: string
    accent: string
    text: string
    swatch?: { canvas: string; hero: string; lead: string }
  }
  overrides?: Record<string, string>
  /** The deck's theme selection: it names fonts only when theme fonts are enabled (themeFontFields drops them otherwise). */
  fontSource?: unknown
}): Extract<ThemeDropdownPreviewData, { kind: 'theme' }> {
  const override = (token: string, fallback: string) => {
    const value = overrides?.[token]
    return isValidThemeHex(value) ? value : fallback
  }
  const swatch = colors.swatch
  const fonts = themeFontFields(fontSource)
  const hero = swatch?.hero ?? override('primary', colors.primary)
  const canvas = override('background', swatch?.canvas ?? colors.background)
  const surface = override('surface', colors.surface)
  const lead = override('primary', swatch?.lead ?? colors.primary)
  const accent = override('accent', colors.accent)
  // A theme's text colour can belong to its dark slides; on this light ground fall back to a readable ink unless the user chose one.
  const themeText = contrastRatio(colors.text, canvas) >= 3 ? colors.text : inkFor(canvas)
  const text = override('text_primary', themeText)
  const body = override('text_body', themeText)
  return {
    kind: 'theme',
    name,
    description,
    hero,
    heroInk: inkFor(hero),
    heroRule: contrastRatio(accent, hero) >= 1.8 ? accent : inkFor(hero),
    canvas,
    surface,
    surfaceInk: inkFor(surface),
    lead,
    leadInk: inkFor(lead),
    accent,
    accentInk: inkFor(accent),
    text,
    body,
    ...(fonts.font_family_heading ? { headingFont: fonts.font_family_heading } : {}),
    ...(fonts.font_family ? { bodyFont: fonts.font_family } : {}),
  }
}

/**
 * The closed field shows the chosen theme's name. Text typed into it (the name not selected, a paste, a phone keyboard) arrives with the
 * name still attached; this returns only what was typed.
 */
export function themeDropdownTypedText(value: string, chosenName: string): string {
  if (!chosenName) return value
  if (value === chosenName) return ''
  if (value.startsWith(chosenName)) return value.slice(chosenName.length)
  if (value.endsWith(chosenName)) return value.slice(0, value.length - chosenName.length)
  return value
}

/** Every word typed must appear in the name, in any order, any case. */
export function themeDropdownMatches(name: string, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = name.toLowerCase()
  return words.every(word => haystack.includes(word))
}

// ── the picker ───────────────────────────────────────────────────────────────────────────────────────────────────────────

function Swatches({ colors }: { colors: string[] }) {
  return (
    <span className="stpdd-swatches" aria-hidden="true">
      {colors.map((hex, index) => <i key={`${hex}-${index}`} style={{ background: hex }} />)}
    </span>
  )
}

function ThemeDropdownPreview({ preview, locked }: { preview: ThemeDropdownPreviewData; locked: boolean }) {
  if (preview.kind === 'auto') {
    return (
      <section className="stpdd-preview" data-studio-theme-preview="auto" aria-label="Preview of the selected theme">
        <div className="stpdd-auto">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <p>
            {locked
              ? 'Director chose this deck’s theme when it built the deck, so there is no preview to show here.'
              : 'Director picks a theme when it builds your deck, so there is nothing to preview yet.'}
          </p>
        </div>
      </section>
    )
  }
  const headingFont = preview.headingFont ? { fontFamily: themeFontCss(preview.headingFont) } : undefined
  const bodyFont = preview.bodyFont ? { fontFamily: themeFontCss(preview.bodyFont) } : undefined
  return (
    <section className="stpdd-preview" data-studio-theme-preview="theme" aria-label="Preview of the selected theme">
      <div className="stpdd-preview-head">
        <strong>{preview.name}</strong>
        <span>{preview.description}</span>
      </div>
      <div className="stpdd-slides" aria-hidden="true">
        <figure className="stpdd-slide-wrap">
          <div className="stpdd-slide stpdd-slide-title" data-studio-preview-ground="title" style={{ background: preview.hero, color: preview.heroInk }}>
            <span className="stpdd-slide-rule" style={{ background: preview.heroRule }} />
            <span className="stpdd-slide-h1" style={headingFont}>Q3 business review</span>
            <span className="stpdd-slide-sub" style={bodyFont}>Prepared for the leadership team</span>
          </div>
          <figcaption>Title slide</figcaption>
        </figure>
        <figure className="stpdd-slide-wrap">
          <div className="stpdd-slide stpdd-slide-content" data-studio-preview-ground="content" style={{ background: preview.canvas, color: preview.text }}>
            <span className="stpdd-slide-h2" style={headingFont}>Revenue grew 18%</span>
            <span className="stpdd-slide-rule" style={{ background: preview.lead }} />
            <span className="stpdd-slide-body" style={{ color: preview.body, ...bodyFont }}>Three drivers explain most of the gain, and two of them will repeat.</span>
            <span className="stpdd-slide-chips">
              <span className="stpdd-chip" style={{ background: preview.lead, color: preview.leadInk }}>Growth</span>
              <span className="stpdd-chip" style={{ background: preview.accent, color: preview.accentInk }}>Focus</span>
              <span className="stpdd-chip stpdd-chip-surface" style={{ background: preview.surface, color: preview.surfaceInk }}>+18%</span>
            </span>
          </div>
          <figcaption>Content slide</figcaption>
        </figure>
      </div>
      <p className="stpdd-preview-note">
        {preview.headingFont || preview.bodyFont
          ? `Fonts: ${[preview.headingFont && `${preview.headingFont} for headings`, preview.bodyFont && `${preview.bodyFont} for body text`].filter(Boolean).join(', ')}. `
          : 'Fonts: the theme’s own. '}
        A preview only: your deck changes when you apply the theme.
      </p>
    </section>
  )
}

export function ThemeDropdownPicker({
  options,
  selectedId,
  locked,
  preview,
  onSelect,
  copy = THEME_DROPDOWN_COPY,
  labelAccessory,
}: {
  options: ThemeDropdownOption[]
  /** 'auto', a preset id, or null (nothing in the list is chosen). */
  selectedId: string | null
  locked: boolean
  /** Absent (the composer's popups): no preview under the dropdown. */
  preview?: ThemeDropdownPreviewData
  onSelect: (id: string) => void
  copy?: ThemeDropdownCopy
  /** Drawn in the label row in place of the help line (the composer's "Refresh"). */
  labelAccessory?: ReactNode
}) {
  const uid = useId()
  const inputId = `${uid}-input`
  const listId = `${uid}-list`
  const labelId = `${uid}-label`
  const hintId = `${uid}-hint`
  const optionId = (id: string) => `${uid}-opt-${id}`
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const selected = options.find(option => option.id === selectedId) ?? null
  const filtering = query.trim().length > 0
  const pinned = options.filter(option => option.current && themeDropdownMatches(option.search ?? option.name, query))
  const rest = options.filter(option => !option.current && themeDropdownMatches(option.search ?? option.name, query))
  const visible = [...pinned, ...rest]
  const highlighted = visible.find(option => option.id === highlightId)
    ?? (filtering ? visible[0] : visible.find(option => option.id === selectedId) ?? visible[0])
    ?? null
  const isOpen = open && !locked

  const wantsFonts = preview?.kind === 'theme' && Boolean(preview.headingFont || preview.bodyFont)
  useEffect(() => {
    if (wantsFonts) ensureThemeFontStylesheet()
  }, [wantsFonts])

  const highlightedDomId = highlighted ? optionId(highlighted.id) : null
  useEffect(() => {
    if (!isOpen || !highlightedDomId || typeof document === 'undefined') return
    document.getElementById(highlightedDomId)?.scrollIntoView?.({ block: 'nearest' })
  }, [isOpen, highlightedDomId])

  const close = () => {
    setOpen(false)
    setQuery('')
    setHighlightId(null)
  }
  const choose = (id: string) => {
    close()
    onSelect(id)
  }
  const move = (step: 1 | -1) => {
    if (visible.length === 0) return
    const at = Math.max(0, visible.findIndex(option => option.id === highlighted?.id))
    setHighlightId(visible[(at + step + visible.length) % visible.length].id)
  }

  const renderOption = (option: ThemeDropdownOption): ReactNode => (
    <div
      key={option.id}
      id={optionId(option.id)}
      role="option"
      aria-selected={option.id === selectedId}
      data-active={option.id === highlighted?.id ? 'true' : undefined}
      {...(option.muted ? { 'data-muted': 'true' } : {})}
      data-studio-theme-preset={option.id}
      title={option.hint}
      className="stpdd-option"
      onMouseMove={() => { if (option.id !== highlighted?.id) setHighlightId(option.id) }}
      onClick={() => choose(option.id)}
    >
      <span className="stpdd-option-name">
        <span className="stpdd-option-label">{option.name}</span>
        {option.current && <span className="stpv2-current-pill">Current</span>}
      </span>
      {option.swatches.length > 0
        ? option.sub ? <><Swatches colors={option.swatches} /><span className="stpdd-option-sub">{option.sub}</span></> : <Swatches colors={option.swatches} />
        : option.sub === undefined
          ? <span className="stpdd-option-sub">Director picks for you</span>
          : option.sub ? <span className="stpdd-option-sub">{option.sub}</span> : null}
      <span className="stpdd-check" aria-hidden="true">{option.id === selectedId && <Check className="h-3 w-3" />}</span>
    </div>
  )

  return (
    <div className="stpdd" data-studio-theme-dropdown-root="true">
      <div className="stpdd-label-row">
        <label id={labelId} htmlFor={inputId} className="stpdd-label">{copy.label}</label>
        {labelAccessory ?? (!locked && copy.help !== null && <span id={hintId} className="stpdd-help">{copy.help}</span>)}
      </div>
      <div
        className="stpdd-combo"
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close()
        }}
      >
        <div className="stpdd-field" data-disabled={locked ? 'true' : undefined}>
          {selected?.id === 'auto' && !(isOpen && filtering) && <Sparkles className="stpdd-field-icon" aria-hidden="true" />}
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={isOpen && highlighted ? optionId(highlighted.id) : undefined}
            aria-describedby={locked || copy.help === null || labelAccessory ? undefined : hintId}
            autoComplete="off"
            spellCheck={false}
            disabled={locked}
            placeholder={selected?.name ?? copy.placeholder}
            value={isOpen ? query : selected?.name ?? ''}
            className="stpdd-input"
            onFocus={event => event.currentTarget.select()}
            onClick={event => {
              if (locked) return
              if (!isOpen) {
                event.currentTarget.select()
                setOpen(true)
              }
            }}
            onChange={event => {
              setQuery(isOpen ? event.target.value : themeDropdownTypedText(event.target.value, selected?.name ?? ''))
              setOpen(true)
              setHighlightId(null)
            }}
            onKeyDown={event => {
              if (locked) return
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (!isOpen) {
                  setOpen(true)
                  setHighlightId(null)
                } else {
                  move(event.key === 'ArrowDown' ? 1 : -1)
                }
              } else if (event.key === 'Enter') {
                event.preventDefault()
                if (!isOpen) setOpen(true)
                else if (highlighted) choose(highlighted.id)
              } else if (event.key === 'Escape' && isOpen) {
                // The first Escape only closes the list; the next one (list closed) reaches the dialog and cancels it.
                event.preventDefault()
                event.stopPropagation()
                close()
              }
            }}
          />
          {selected && selected.swatches.length > 0 && <Swatches colors={selected.swatches} />}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            disabled={locked}
            className="stpdd-chevron"
            data-open={isOpen ? 'true' : undefined}
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              if (isOpen) close()
              else {
                setOpen(true)
                setHighlightId(null)
                if (typeof document !== 'undefined') document.getElementById(inputId)?.focus()
              }
            }}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        {isOpen && (
          <div id={listId} role="listbox" aria-labelledby={labelId} tabIndex={-1} className="stpdd-list" onMouseDown={event => event.preventDefault()}>
            {visible.length === 0 ? (
              <div className="stpdd-empty" data-studio-theme-empty="true">{!filtering && copy.none ? copy.none : `No ${copy.plural} match “${query.trim()}”.`}</div>
            ) : (
              <>
                {pinned.length > 0 && (
                  <div role="group" aria-label="Current theme" className="stpdd-group">
                    <div className="stpdd-group-label" aria-hidden="true">Current theme</div>
                    {pinned.map(renderOption)}
                  </div>
                )}
                {rest.length > 0 && (
                  <div role="group" aria-label={copy.groups ? (pinned.length > 0 ? 'Other themes' : 'All themes') : copy.label} className="stpdd-group">
                    {copy.groups && <div className="stpdd-group-label" aria-hidden="true">{pinned.length > 0 ? 'Other themes' : 'All themes'}</div>}
                    {rest.map(renderOption)}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <div className="sr-only" role="status">
          {isOpen ? (visible.length === 0 ? `No ${copy.plural} match.` : `${visible.length} ${visible.length === 1 ? copy.singular : copy.plural} available.`) : ''}
        </div>
      </div>
      {preview && <ThemeDropdownPreview preview={preview} locked={locked} />}
    </div>
  )
}
