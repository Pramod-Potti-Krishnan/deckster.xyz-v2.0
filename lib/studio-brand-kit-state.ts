// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, Studio caller half; BK-C7, BK-C9, BK-C13, section 6 "Studio states"): the Brand Kit's state machine and its two flows, pure and async-with-injected-deps so a proof can run them
// without a browser. The component and the hook (components/studio-libraries/brand-kit-panel.tsx, hooks/use-brand-kit.ts) only wire these to React and to fetch.
//
// The rules the machine holds (each has a check in the proof):
//   - the proposal lives in its own state; the draft is touched only by an explicit "Use these colours" / "Use suggested fonts" (applyExtractedColours / applyExtractedFonts);
//   - one click is one paid call: extraction starts only from the consent state, and a second start while one is in flight is refused; a failed call is never retried by the machine;
//   - nothing is saved until Save; the theme is created first (the page's own save), then the brand record is PUT; if the PUT fails the theme stays saved and only the PUT is repeated (never a second theme);
//   - role colours are display only: they are never copied anywhere.

import type { BuildThemeSelection } from '@/lib/theme-builder'
import { THEME_FONT_SELECTION_ENABLED, setThemeFont } from '@/lib/theme-fonts'
import {
  BRAND_COLOUR_KEYS,
  EMPTY_BRAND_FORM,
  brandFormProblems,
  brandRecordFromForm,
  brandRecordIsEmpty,
  brandRecordKept,
  checkBrandExtractFile,
  type BrandApiCode,
  type BrandExtractCode,
  type BrandExtractMime,
  type BrandExtractResult,
  type BrandKitForm,
  type BrandRecord,
} from '@/lib/studio-brand-kit'

export type ApiResult<T, C extends string = BrandExtractCode | BrandApiCode> = { ok: true; value: T } | { ok: false; status: number; code: C; retryable?: boolean }

export interface BrandFileInfo { name: string; size: number; type: BrandExtractMime }

export type ExtractSlice =
  | { phase: 'idle' }
  | { phase: 'consent'; file: BrandFileInfo; agreed: boolean }
  | { phase: 'extracting'; file: BrandFileInfo }
  | { phase: 'preview'; file: BrandFileInfo; result: BrandExtractResult }
  | { phase: 'confirmed'; file: BrandFileInfo; result: BrandExtractResult; fontsApplied: boolean }
  | { phase: 'no_colors' }
  | { phase: 'error'; code: BrandExtractCode }
  | { phase: 'unavailable' }

export type SaveSlice =
  | { phase: 'idle' }
  | { phase: 'saving' }
  | { phase: 'partial'; themeId: string; themeName: string; record: BrandRecord; code: BrandApiCode; retryable: boolean }
  | { phase: 'saved'; themeId: string; themeName: string; kept: boolean }
  | { phase: 'unavailable'; themeName: string }

export interface BrandKitState { extract: ExtractSlice; form: BrandKitForm; save: SaveSlice }
export const initialBrandKitState = (): BrandKitState => ({ extract: { phase: 'idle' }, form: { ...EMPTY_BRAND_FORM }, save: { phase: 'idle' } })

export type BrandKitAction =
  | { type: 'pick'; file: { name?: unknown; size?: unknown; type?: unknown } }
  | { type: 'cancel' }
  | { type: 'agree'; agreed: boolean }
  | { type: 'extract_start' }
  | { type: 'extract_done'; result: BrandExtractResult }
  | { type: 'extract_fail'; code: BrandExtractCode }
  | { type: 'accept_colours'; fontsApplied?: boolean }
  | { type: 'accept_fonts' }
  | { type: 'form'; patch: Partial<BrandKitForm> }
  | { type: 'save_start' }
  | { type: 'save_saved'; themeId: string; themeName: string; kept: boolean }
  | { type: 'save_partial'; themeId: string; themeName: string; record: BrandRecord; code: BrandApiCode; retryable: boolean }
  | { type: 'save_unavailable'; themeName: string }
  | { type: 'save_clear' }
  | { type: 'reset' }

export function reduceBrandKit(state: BrandKitState, action: BrandKitAction): BrandKitState {
  const ex = state.extract
  switch (action.type) {
    case 'pick': {
      // a pick is refused while a call is in flight: the picker cannot start a second one
      if (ex.phase === 'extracting') return state
      const checked = checkBrandExtractFile(action.file)
      if (!checked.ok) return { ...state, extract: { phase: 'error', code: checked.code } }
      return { ...state, extract: { phase: 'consent', file: { name: String(action.file.name ?? 'logo').slice(0, 120), size: action.file.size as number, type: checked.mime }, agreed: false } }
    }
    case 'cancel': return ex.phase === 'extracting' ? state : { ...state, extract: { phase: 'idle' } }
    case 'agree': return ex.phase === 'consent' ? { ...state, extract: { ...ex, agreed: action.agreed === true } } : state
    // no consent, no call: the machine does not start an extraction the person has not agreed to
    case 'extract_start': return ex.phase === 'consent' && ex.agreed ? { ...state, extract: { phase: 'extracting', file: ex.file } } : state
    case 'extract_done': return ex.phase === 'extracting' ? { ...state, extract: { phase: 'preview', file: ex.file, result: action.result } } : state
    case 'extract_fail': {
      if (ex.phase !== 'extracting') return state
      if (action.code === 'no_colors') return { ...state, extract: { phase: 'no_colors' } }
      if (action.code === 'unavailable' || action.code === 'unconfigured') return { ...state, extract: { phase: 'unavailable' } }
      return { ...state, extract: { phase: 'error', code: action.code } }
    }
    case 'accept_colours': return ex.phase === 'preview' ? { ...state, extract: { phase: 'confirmed', file: ex.file, result: ex.result, fontsApplied: Boolean(action.fontsApplied) } } : state
    case 'accept_fonts': return ex.phase === 'confirmed' ? { ...state, extract: { ...ex, fontsApplied: true } } : state
    case 'form': return { ...state, form: { ...state.form, ...action.patch }, save: state.save.phase === 'saved' || state.save.phase === 'unavailable' ? { phase: 'idle' } : state.save }
    case 'save_start': return { ...state, save: { phase: 'saving' } }
    case 'save_saved': return { ...state, save: { phase: 'saved', themeId: action.themeId, themeName: action.themeName, kept: action.kept } }
    case 'save_partial': return { ...state, save: { phase: 'partial', themeId: action.themeId, themeName: action.themeName, record: action.record, code: action.code, retryable: action.retryable } }
    case 'save_unavailable': return { ...state, save: { phase: 'unavailable', themeName: action.themeName } }
    case 'save_clear': return { ...state, save: { phase: 'idle' } }
    // a new draft starts with an empty kit, but a theme saved without its brand details keeps its retry (it is the one thing the person can lose by starting over)
    case 'reset': return { ...initialBrandKitState(), save: state.save.phase === 'partial' ? state.save : { phase: 'idle' } }
    default: return state
  }
}

/** The form has something to save: a logo link, a footer or a confidentiality line (fonts alone are not a kit). */
export const brandFormHasContent = (form: BrandKitForm): boolean => Boolean(form.logoUrl.trim() || form.footer.trim() || form.confidentiality.trim())
/** The form cannot be saved as it stands: Save stays off until the words under the field are dealt with. */
export const brandFormBlocksSave = (form: BrandKitForm): boolean => Object.keys(brandFormProblems(form)).length > 0

// ---- the draft is changed only by these two, and only when called from a click ---------------------------------------------------------------------------------------------------------------------
/**
 * "Use these colours": the draft becomes a custom palette of EXACTLY the suggested hexes (the originals, lowercased by Theme Builder and nothing else changed). A colour the suggestion does not have is absent (never invented, never left over
 * from an earlier palette). color_overrides and everything else on the draft stay as they were. The derived role colours are not read here.
 */
export function applyExtractedColours(draft: BuildThemeSelection, result: BrandExtractResult, paletteMode: BuildThemeSelection['palette_mode']): BuildThemeSelection {
  const next: BuildThemeSelection = { ...draft, mode: 'custom', harmony_preference: draft.harmony_preference || 'auto', palette_mode: paletteMode }
  for (const key of BRAND_COLOUR_KEYS) next[key] = result.theme_payload[key]
  return next
}

/** "Use suggested fonts": the two catalog fonts the suggestion has, through the same setter the font pickers use (so with the theme-font switch off nothing is set). */
export function applyExtractedFonts(draft: BuildThemeSelection, result: BrandExtractResult): BuildThemeSelection {
  let next = draft
  if (result.brand.heading_font) next = setThemeFont(next, 'font_family_heading', result.brand.heading_font)
  if (result.brand.body_font) next = setThemeFont(next, 'font_family', result.brand.body_font)
  return next
}

// ---- the extraction flow: one click, one call --------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Run ONE extraction for the file the consent state holds. `inFlight` is the caller's own flag (a ref): a second call while one is out answers null and sends nothing, so a double click is one call. The machine is told
 * the outcome; nothing is retried, and an edit, a render or a reconnect never gets here (only the button does).
 */
export async function runExtraction(
  deps: { extract: (file: unknown) => Promise<ApiResult<BrandExtractResult, BrandExtractCode>>; inFlight: { current: boolean } },
  state: BrandKitState,
  file: unknown,
  dispatch: (action: BrandKitAction) => void,
): Promise<'done' | 'failed' | 'refused'> {
  if (state.extract.phase !== 'consent' || !state.extract.agreed || deps.inFlight.current) return 'refused'
  deps.inFlight.current = true
  dispatch({ type: 'extract_start' })
  try {
    const res = await deps.extract(file)
    if (res.ok) { dispatch({ type: 'extract_done', result: res.value }); return 'done' }
    dispatch({ type: 'extract_fail', code: res.code })
    return 'failed'
  } catch {
    dispatch({ type: 'extract_fail', code: 'network' })
    return 'failed'
  } finally {
    deps.inFlight.current = false
  }
}

// ---- the save flow: the theme first (the page's own save), then the brand record ---------------------------------------------------------------------------------------------------------------------
export type BrandSaveOutcome =
  | { kind: 'skipped' }
  | { kind: 'saved'; brand: BrandRecord | null; kept: boolean }
  | { kind: 'unavailable' }
  | { kind: 'partial'; record: BrandRecord; code: BrandApiCode; retryable: boolean }

/** Whether a failed PUT may be tried again by the person (a fresh click): Director's own word when it gave one, else by code. A refused session (401, 403: reload), a refused record, a feature that is off and a theme that is gone do not get better by repeating. */
const NOT_RETRYABLE: readonly string[] = ['kit_unavailable', 'theme_not_found', 'entitlement', 'invalid_brand', 'bad_request', 'too_large', 'clear_refused', 'unconfigured', 'signin']
const retryableCode = (code: string, flag?: boolean): boolean => flag ?? !NOT_RETRYABLE.includes(code)

/** The brand record the form makes for a SAVED theme: its fonts are the saved theme's own (what the server kept), only with the theme-font switch on, and only with something to say besides fonts. */
export function brandRecordForSave(form: BrandKitForm, saved: { theme_payload?: BuildThemeSelection | null } | null | undefined): { ok: true; record: BrandRecord } | { ok: false } {
  if (!brandFormHasContent(form)) return { ok: true, record: {} }
  const fonts = THEME_FONT_SELECTION_ENABLED ? { heading: saved?.theme_payload?.font_family_heading, body: saved?.theme_payload?.font_family } : {}
  const checked = brandRecordFromForm(form, fonts)
  return checked.ok ? { ok: true, record: checked.record } : { ok: false }
}

/** After the theme row exists: PUT the brand record once. Never creates a theme. A form with nothing in it sends nothing (and so can never clear a kit). */
export async function runBrandSave(
  save: (themeId: string, record: BrandRecord) => Promise<ApiResult<BrandRecord | null, BrandApiCode>>,
  theme: { id: string; theme_payload?: BuildThemeSelection | null },
  form: BrandKitForm,
): Promise<BrandSaveOutcome> {
  const made = brandRecordForSave(form, theme)
  if (!made.ok) return { kind: 'partial', record: {}, code: 'invalid_brand', retryable: false }
  if (brandRecordIsEmpty(made.record)) return { kind: 'skipped' }
  return sendBrand(save, theme.id, made.record)
}

/** The retry after a partial save: the same record, the same theme id, a PUT and nothing else. */
export const runBrandRetry = (save: Parameters<typeof runBrandSave>[0], themeId: string, record: BrandRecord): Promise<BrandSaveOutcome> => sendBrand(save, themeId, record)

async function sendBrand(save: Parameters<typeof runBrandSave>[0], themeId: string, record: BrandRecord): Promise<BrandSaveOutcome> {
  try {
    const res = await save(themeId, record)
    if (res.ok) return { kind: 'saved', brand: res.value, kept: brandRecordKept(record, res.value) }
    if (res.code === 'kit_unavailable') return { kind: 'unavailable' }
    return { kind: 'partial', record, code: res.code, retryable: retryableCode(res.code, res.retryable) }
  } catch {
    return { kind: 'partial', record, code: 'director_unreachable', retryable: true }
  }
}

/** The outcome as the machine's action. */
export function saveActionFor(outcome: BrandSaveOutcome, theme: { id: string; name: string }): BrandKitAction {
  switch (outcome.kind) {
    case 'saved': return { type: 'save_saved', themeId: theme.id, themeName: theme.name, kept: outcome.kept }
    case 'unavailable': return { type: 'save_unavailable', themeName: theme.name }
    case 'partial': return { type: 'save_partial', themeId: theme.id, themeName: theme.name, record: outcome.record, code: outcome.code, retryable: outcome.retryable }
    default: return { type: 'save_clear' }
  }
}
