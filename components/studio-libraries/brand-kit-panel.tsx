"use client"

import { useCallback, useEffect, useId, useReducer, useRef, useState } from 'react'
import { extractBrand, getBrandKit, saveBrandKit } from '@/hooks/use-brand-kit'
import { THEME_FONT_SELECTION_ENABLED } from '@/lib/theme-fonts'
import { customEntryPaletteMode, themeDarkModeEnabled } from '@/lib/studio-theme-dark-toggle'
import type { BuildThemeSelection } from '@/lib/theme-builder'
import {
  BRAND_COLOUR_KEYS,
  BRAND_COLOUR_LABELS,
  BRAND_COPY,
  BRAND_EXTRACT_WORDS,
  BRAND_SAVE_WORDS,
  BRAND_ROLE_KEYS,
  brandFormProblems,
  cleanBrandLogoUrl,
  failingContrast,
  isStudioBrandKitEnabled,
  sameHex,
  type BrandExtractResult,
  type BrandKitForm,
  type BrandRecord,
} from '@/lib/studio-brand-kit'
import {
  applyExtractedColours,
  applyExtractedFonts,
  brandFormBlocksSave,
  brandFormHasContent,
  initialBrandKitState,
  reduceBrandKit,
  runBrandRetry,
  runBrandSave,
  runExtraction,
  saveActionFor,
  type BrandKitState,
} from '@/lib/studio-brand-kit-state'
import { LibraryNotice } from './library-controls'
import { themePreviewPalette } from './theme-preview'
import './brand-kit.css'

// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, Studio caller half; BK-C1, BK-C7, BK-C13, BK-C14): the Brand Kit on the Themes page. Mounted only with NEXT_PUBLIC_STUDIO_BRAND_KIT "true" (components/studio-libraries/themes-workspace.tsx);
// off, none of this is drawn and the hook below does nothing (it holds an empty reducer and never starts a request).
//   extract (optional, one explicit click after the person agrees) -> a proposal in its OWN state, with the originals, the derived roles, every warning and every failing contrast row -> "Use these colours" copies ONLY the originals into
//   the draft -> the person edits the draft with the page's own colour fields -> Save reusable theme (the page's own save, which creates the theme) -> this file then PUTs the brand record once. Nothing is saved or applied before Save,
//   and nothing is ever applied to a deck that is open.

const THEME_DARK_MODE = themeDarkModeEnabled(process.env.NEXT_PUBLIC_THEME_DARK_MODE_ENABLED)

export interface BrandKitController {
  enabled: boolean
  state: BrandKitState
  /** The form has something the Save cannot send: the page keeps Save off. */
  blocksSave: boolean
  /** The form has a logo link, a footer or a confidentiality line (so the save will PUT a brand record). */
  hasContent: boolean
  pick: (file: File | null) => void
  agree: (agreed: boolean) => void
  cancel: () => void
  extract: () => Promise<void>
  markColoursUsed: (fontsApplied: boolean) => void
  markFontsUsed: () => void
  setForm: (patch: Partial<BrandKitForm>) => void
  /** After the page has created the theme row: PUT the brand record once (nothing when the form is empty). */
  saveAfterTheme: (theme: { id: string; name: string; theme_payload?: BuildThemeSelection | null }) => Promise<void>
  /** After a partial save: the same PUT, never a second theme. */
  retry: () => Promise<void>
  reset: () => void
}

export function useBrandKitDraft(enabled: boolean): BrandKitController {
  const [state, dispatch] = useReducer(reduceBrandKit, undefined, initialBrandKitState)
  const stateRef = useRef(state)
  stateRef.current = state
  const fileRef = useRef<File | null>(null)
  const extractInFlight = useRef(false)
  const saveInFlight = useRef(false)

  const pick = useCallback((file: File | null) => {
    if (!enabled || !file) return
    fileRef.current = file
    dispatch({ type: 'pick', file: { name: file.name, size: file.size, type: file.type } })
  }, [enabled])
  const agree = useCallback((agreed: boolean) => { if (enabled) dispatch({ type: 'agree', agreed }) }, [enabled])
  const cancel = useCallback(() => { fileRef.current = null; dispatch({ type: 'cancel' }) }, [])
  // one click is one call: the state machine and the in-flight ref both refuse a second start
  const extract = useCallback(async () => {
    if (!enabled) return
    await runExtraction({ extract: file => extractBrand(file as File), inFlight: extractInFlight }, stateRef.current, fileRef.current, dispatch)
  }, [enabled])
  const markColoursUsed = useCallback((fontsApplied: boolean) => dispatch({ type: 'accept_colours', fontsApplied }), [])
  const markFontsUsed = useCallback(() => dispatch({ type: 'accept_fonts' }), [])
  const setForm = useCallback((patch: Partial<BrandKitForm>) => dispatch({ type: 'form', patch }), [])
  const saveAfterTheme = useCallback(async (theme: { id: string; name: string; theme_payload?: BuildThemeSelection | null }) => {
    if (!enabled || saveInFlight.current) return
    const form = stateRef.current.form
    if (!brandFormHasContent(form)) return // nothing to say: no request, and never a clear
    saveInFlight.current = true
    dispatch({ type: 'save_start' })
    try {
      dispatch(saveActionFor(await runBrandSave(saveBrandKit, theme, form), theme))
    } finally {
      saveInFlight.current = false
    }
  }, [enabled])
  const retry = useCallback(async () => {
    const save = stateRef.current.save
    if (!enabled || save.phase !== 'partial' || !save.retryable || saveInFlight.current) return
    saveInFlight.current = true
    dispatch({ type: 'save_start' })
    try {
      dispatch(saveActionFor(await runBrandRetry(saveBrandKit, save.themeId, save.record), { id: save.themeId, name: save.themeName }))
    } finally {
      saveInFlight.current = false
    }
  }, [enabled])
  const reset = useCallback(() => { fileRef.current = null; dispatch({ type: 'reset' }) }, [])

  // a theme saved without its brand details is the one thing here the person can lose by leaving
  const partial = enabled && state.save.phase === 'partial'
  useEffect(() => {
    if (!partial) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [partial])

  return {
    enabled, state, pick, agree, cancel, extract, markColoursUsed, markFontsUsed, setForm, saveAfterTheme, retry, reset,
    blocksSave: enabled && brandFormBlocksSave(state.form),
    hasContent: enabled && brandFormHasContent(state.form),
  }
}

// ---- the pieces -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const swatch = (hex: string | undefined) => <i className="sl-bk-swatch" style={{ backgroundColor: hex }} aria-hidden="true" />
const roleWords = (role: string) => role.replace(/_hex$/, '').replace(/_/g, ' ')

/** The proposal: the originals, the derived roles, every warning and every failing contrast row. Reading only: nothing here touches the draft. */
export function BrandProposalView({ result, draft, confirmed, fontsApplied, onUseColours, onUseFonts }: {
  result: BrandExtractResult
  draft: BuildThemeSelection
  confirmed: boolean
  fontsApplied: boolean
  onUseColours: () => void
  onUseFonts: () => void
}) {
  const failing = failingContrast(result)
  const heading = result.brand.heading_font, body = result.brand.body_font
  const hasFonts = Boolean(heading || body)
  return <div className="sl-bk-proposal" data-brand-kit-proposal={confirmed ? 'confirmed' : 'preview'}>
    <h4>{BRAND_COPY.suggestedHeading}</h4>
    <p className="sl-helper">{BRAND_COPY.suggestedNote}</p>
    <ul className="sl-bk-list" aria-label={BRAND_COPY.suggestedHeading}>
      {BRAND_COLOUR_KEYS.filter(key => result.theme_payload[key]).map(key => {
        const original = result.theme_payload[key] as string
        const now = draft[key]
        const edited = confirmed && !sameHex(now, original)
        return <li key={key} data-brand-colour={key}>{swatch(original)}<span>{BRAND_COLOUR_LABELS[key]}</span><code>{original}</code>{confirmed && <>{swatch(now)}<code>{now ?? 'not set'}</code>{edited && <small className="sl-bk-edited">{BRAND_COPY.changedFrom(original)}</small>}</>}</li>
      })}
    </ul>
    <h4>{BRAND_COPY.derivedHeading}</h4>
    <p className="sl-helper">{BRAND_COPY.derivedNote}</p>
    <ul className="sl-bk-roles" aria-label={BRAND_COPY.derivedHeading} data-brand-derived="true">
      {BRAND_ROLE_KEYS.filter(role => result.preview.role_colors[role]).map(role => <li key={role}>{swatch(result.preview.role_colors[role])}<span>{roleWords(role)}</span><code>{result.preview.role_colors[role]}</code></li>)}
    </ul>
    <div role="status" className="sl-bk-warnings" data-brand-warnings="true">
      {result.preview.warnings.length === 0 && failing.length === 0 ? <p className="sl-helper">{BRAND_COPY.noWarnings}</p> : <ul>
        {result.preview.warnings.map(warning => <li key={warning}>{warning}</li>)}
        {failing.map(check => <li key={`${check.foreground_role}/${check.background_role}/${check.foreground_hex}`} data-brand-contrast="fail">{`${roleWords(check.foreground_role)} ${check.foreground_hex} on ${roleWords(check.background_role)} ${check.background_hex}: contrast ${check.ratio.toFixed(2)} (4.5 is the AA guide for normal text)`}</li>)}
      </ul>}
    </div>
    {hasFonts && <div className="sl-bk-fonts" data-brand-fonts="true"><p className="sl-helper">Suggested fonts: {[heading && `heading ${heading}`, body && `body ${body}`].filter(Boolean).join(', ')}. {BRAND_COPY.fontsNote}</p>
      {THEME_FONT_SELECTION_ENABLED ? <button type="button" className="sl-button" disabled={fontsApplied || !confirmed} onClick={onUseFonts}>{BRAND_COPY.useFonts}</button> : <p className="sl-helper">{BRAND_COPY.fontsOff}</p>}</div>}
    {confirmed ? <p className="sl-helper" role="status">{BRAND_COPY.confirmed}</p> : <button type="button" className="sl-primary" onClick={onUseColours}>{BRAND_COPY.useColours}</button>}
  </div>
}

/** A 16:9 sample as Layout draws the logo slot today: one box top right (150 by 50 of 1600 by 900), the footer along the bottom. Colours and fonts are the draft's. */
export function BrandKitSample({ selection, name, logoUrl, footer, confidentiality }: { selection: BuildThemeSelection; name: string; logoUrl: string; footer: string; confidentiality: string }) {
  const palette = themePreviewPalette(selection)
  const logo = cleanBrandLogoUrl(logoUrl)
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => { setLogoFailed(false) }, [logo])
  const heading = selection.font_family_heading ? `'${selection.font_family_heading}'` : undefined
  const body = selection.font_family ? `'${selection.font_family}'` : undefined
  return <figure className="sl-bk-sample" aria-label={BRAND_COPY.sampleHeading} data-brand-sample="true">
    <div className="sl-bk-slide" style={{ backgroundColor: palette.background, color: palette.text_body, fontFamily: body }}>
      <div className="sl-bk-logo" data-brand-logo-slot="top_right">{logo && !logoFailed ? <img src={logo} alt="" referrerPolicy="no-referrer" onError={() => setLogoFailed(true)} /> : null}</div>
      <strong style={{ color: palette.primary, fontFamily: heading }}>{name || 'Your presentation title'}</strong>
      <span style={{ backgroundColor: palette.surface }} aria-hidden="true" />
      <footer style={{ borderColor: palette.border }}><span>{footer.trim()}</span><span>{confidentiality.trim()}</span></footer>
    </div>
    <figcaption className="sl-helper">{logoFailed ? BRAND_COPY.logoNotLoaded : BRAND_COPY.sampleNote}</figcaption>
  </figure>
}

/** The whole section, drawn from the state and the handlers it is given (the connector below is the only thing with hooks, so a proof can draw every state). */
export function BrandKitSectionView({ state, draft, name, locked, onPick, onAgree, onCancel, onExtract, onUseColours, onUseFonts, onForm }: {
  state: BrandKitState
  draft: BuildThemeSelection
  name: string
  locked: boolean
  onPick: (file: File | null) => void
  onAgree: (agreed: boolean) => void
  onCancel: () => void
  onExtract: () => void
  onUseColours: (result: BrandExtractResult) => void
  onUseFonts: (result: BrandExtractResult) => void
  onForm: (patch: Partial<BrandKitForm>) => void
}) {
  const ids = { agree: useId(), logo: useId(), footer: useId(), conf: useId() }
  const ex = state.extract
  const problems = brandFormProblems(state.form)
  const picker = <label className="sl-field">{BRAND_COPY.pickFile}<input type="file" accept="image/png,image/jpeg" disabled={locked} data-brand-file="true" onChange={event => { onPick(event.target.files?.[0] ?? null); event.target.value = '' }} /></label>
  return <section className="sl-brand-kit" aria-label={BRAND_COPY.heading} data-brand-kit="true" data-brand-phase={ex.phase}>
    <h3>{BRAND_COPY.heading}</h3>
    <p className="sl-helper">{BRAND_COPY.intro}</p>
    <div className="sl-bk-extract" data-brand-extract={ex.phase}>
      <h4>{BRAND_COPY.extractHeading}</h4>
      {ex.phase !== 'unavailable' && <p className="sl-helper">{BRAND_COPY.extractIntro}</p>}
      {(ex.phase === 'idle' || ex.phase === 'error' || ex.phase === 'no_colors') && picker}
      {ex.phase === 'error' && <p className="sl-field-error" role="alert">{BRAND_EXTRACT_WORDS[ex.code]}</p>}
      {ex.phase === 'no_colors' && <p className="sl-field-error" role="alert">{BRAND_EXTRACT_WORDS.no_colors}</p>}
      {ex.phase === 'unavailable' && <p className="sl-helper" role="status">{BRAND_EXTRACT_WORDS.unavailable}</p>}
      {(ex.phase === 'consent' || ex.phase === 'extracting') && <div className="sl-bk-consent">
        <p className="sl-helper">{ex.file.name} · {(ex.file.size / 1024).toFixed(0)} KB</p>
        <label className="sl-bk-check" htmlFor={ids.agree}><input id={ids.agree} type="checkbox" checked={ex.phase === 'extracting' || ex.agreed} disabled={locked || ex.phase === 'extracting'} onChange={event => onAgree(event.target.checked)} data-brand-consent="true" /><span>{BRAND_COPY.consent}</span></label>
        <div className="sl-bk-actions"><button type="button" className="sl-primary" disabled={locked || ex.phase === 'extracting' || !ex.agreed} onClick={onExtract} data-brand-extract-button="true">{ex.phase === 'extracting' ? BRAND_COPY.extracting : BRAND_COPY.extractButton}</button>{ex.phase === 'consent' && <button type="button" className="sl-button" onClick={onCancel}>{BRAND_COPY.cancel}</button>}</div>
      </div>}
      {(ex.phase === 'preview' || ex.phase === 'confirmed') && <BrandProposalView result={ex.result} draft={draft} confirmed={ex.phase === 'confirmed'} fontsApplied={ex.phase === 'confirmed' && ex.fontsApplied} onUseColours={() => onUseColours(ex.result)} onUseFonts={() => onUseFonts(ex.result)} />}
    </div>
    <label className="sl-field" htmlFor={ids.logo}>{BRAND_COPY.logoLinkLabel}<input id={ids.logo} value={state.form.logoUrl} placeholder="https://example.com/logo.png" inputMode="url" spellCheck={false} maxLength={2100} aria-invalid={Boolean(problems.logoUrl)} onChange={event => onForm({ logoUrl: event.target.value })} data-brand-field="logo" /></label>
    {problems.logoUrl ? <p className="sl-field-error" role="alert">{problems.logoUrl}</p> : <p className="sl-helper">{BRAND_COPY.logoLinkHelp}</p>}
    <label className="sl-field" htmlFor={ids.footer}>{BRAND_COPY.footerLabel}<input id={ids.footer} value={state.form.footer} placeholder="e.g. Acme Corp" maxLength={400} aria-invalid={Boolean(problems.footer)} onChange={event => onForm({ footer: event.target.value })} data-brand-field="footer" /></label>
    {problems.footer ? <p className="sl-field-error" role="alert">{problems.footer}</p> : <p className="sl-helper">{BRAND_COPY.footerHelp}</p>}
    <label className="sl-field" htmlFor={ids.conf}>{BRAND_COPY.confidentialityLabel}<input id={ids.conf} value={state.form.confidentiality} placeholder="e.g. Confidential" maxLength={240} aria-invalid={Boolean(problems.confidentiality)} onChange={event => onForm({ confidentiality: event.target.value })} data-brand-field="confidentiality" /></label>
    {problems.confidentiality && <p className="sl-field-error" role="alert">{problems.confidentiality}</p>}
    <BrandKitSample selection={draft} name={name} logoUrl={state.form.logoUrl} footer={state.form.footer} confidentiality={state.form.confidentiality} />
  </section>
}

/** The connector: hooks and handlers only. "Use these colours" and "Use suggested fonts" are the only places the draft is written. */
export function BrandKitSection({ kit, draft, name, patchDraft, locked }: { kit: BrandKitController; draft: BuildThemeSelection; name: string; patchDraft: (next: BuildThemeSelection) => void; locked: boolean }) {
  return <BrandKitSectionView state={kit.state} draft={draft} name={name} locked={locked}
    onPick={kit.pick} onAgree={kit.agree} onCancel={kit.cancel} onExtract={() => { void kit.extract() }}
    onUseColours={result => {
      const next = applyExtractedColours(draft, result, customEntryPaletteMode(draft, THEME_DARK_MODE))
      patchDraft(next)
      kit.markColoursUsed(false)
    }}
    onUseFonts={result => { patchDraft(applyExtractedFonts(draft, result)); kit.markFontsUsed() }}
    onForm={kit.setForm} />
}

/** The save's own status line (BK-C13): saving, saved and where it applies, or "theme saved, brand details not saved" with a retry that repeats only the PUT. */
export function BrandKitStatusView({ state, standardId, selectedId, busy, onRetry, onSetStandard }: { state: BrandKitState; standardId?: string | null; selectedId?: string | null; busy: boolean; onRetry: () => void; onSetStandard: () => void }) {
  const save = state.save
  if (save.phase === 'idle') return null
  if (save.phase === 'saving') return <LibraryNotice>{BRAND_COPY.saving}</LibraryNotice>
  if (save.phase === 'unavailable') return <LibraryNotice>{BRAND_COPY.notSwitchedOn(save.themeName)}</LibraryNotice>
  if (save.phase === 'partial') {
    return <LibraryNotice error>{BRAND_COPY.partial(save.themeName, BRAND_SAVE_WORDS[save.code])}{save.retryable && <> <button type="button" className="sl-button" disabled={busy} onClick={onRetry} data-brand-retry="true">{BRAND_COPY.retry}</button></>}</LibraryNotice>
  }
  const isStandard = standardId === save.themeId
  return <LibraryNotice>{isStandard ? BRAND_COPY.savedStandard(save.themeName) : BRAND_COPY.savedNotStandard(save.themeName)}{save.kept ? '' : ` ${BRAND_COPY.savedDropped}`}{!isStandard && selectedId === save.themeId && <> <button type="button" className="sl-button" disabled={busy} onClick={onSetStandard} data-brand-set-standard="true">{BRAND_COPY.setStandard}</button></>}</LibraryNotice>
}

export function BrandKitStatus({ kit, standardId, selectedId, busy, onSetStandard }: { kit: BrandKitController; standardId?: string | null; selectedId?: string | null; busy: boolean; onSetStandard: () => void }) {
  return <BrandKitStatusView state={kit.state} standardId={standardId} selectedId={selectedId} busy={busy} onRetry={() => { void kit.retry() }} onSetStandard={onSetStandard} />
}

/** A saved theme's brand details, read once for the SELECTED theme (BK-C14: never one call per row). Mount it with key={themeId}. A kit that is off draws nothing. */
export function BrandKitSavedDetails({ themeId, isStandard }: { themeId: string; isStandard: boolean }) {
  const [view, setView] = useState<{ status: 'loading' | 'none' | 'unavailable' | 'off' | 'ok'; brand?: BrandRecord }>({ status: 'loading' })
  useEffect(() => {
    let live = true
    const controller = new AbortController()
    void getBrandKit(themeId, { signal: controller.signal }).then(res => {
      if (!live) return
      if (res.ok) setView(res.value && Object.keys(res.value).length ? { status: 'ok', brand: res.value } : { status: 'none' })
      else setView({ status: res.code === 'kit_unavailable' ? 'off' : 'unavailable' })
    })
    return () => { live = false; controller.abort() }
  }, [themeId])
  if (view.status === 'off') return null
  const brand = view.brand
  return <div className="sl-bk-saved" data-brand-saved={view.status}>
    <h4>{BRAND_COPY.savedDetailsHeading}</h4>
    {view.status === 'loading' && <p className="sl-helper" role="status">{BRAND_COPY.savedDetailsLoading}</p>}
    {view.status === 'none' && <p className="sl-helper">{BRAND_COPY.savedDetailsNone}</p>}
    {view.status === 'unavailable' && <p className="sl-helper" role="status">{BRAND_COPY.savedDetailsUnavailable}</p>}
    {view.status === 'ok' && brand && <dl className="sl-bk-saved-list">
      {brand.logo_url && <><dt>Logo link</dt><dd>{brand.logo_url}</dd></>}
      {brand.footer && <><dt>Footer</dt><dd>{brand.footer}</dd></>}
      {brand.confidentiality && <><dt>Confidentiality</dt><dd>{brand.confidentiality}</dd></>}
      {brand.heading_font && <><dt>Heading font</dt><dd>{brand.heading_font}</dd></>}
      {brand.body_font && <><dt>Body font</dt><dd>{brand.body_font}</dd></>}
    </dl>}
    {view.status === 'ok' && !isStandard && <p className="sl-helper">{BRAND_COPY.notStandardHint}</p>}
  </div>
}

export const BRAND_KIT_ENABLED = isStudioBrandKitEnabled()
