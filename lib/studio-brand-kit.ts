// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, the Studio caller half; spec streams/pass5/BRAND-KIT-CALLER.md, items BK-C1..BK-C19): the pure half. The flag, the limits, the shapes Theme Builder and Director speak, the checks every
// layer runs (the route and the browser say the same thing), the words. Nothing here reads a session, a database or a service, and nothing here fetches.
//
// Flag NEXT_PUBLIC_STUDIO_BRAND_KIT: the exact string "true", default off. Off, the two new routes answer 404 before anything is read, no Brand Kit UI is mounted, no request is made, and the eight existing theme proxy fetches are what they were.
//
// What the wire is (read from the pinned sources, never called):
//   - Theme Builder 1fe55d28 (api/brand_extract.py, core/brand_extract.py): POST /api/theme/v2/brand-extract, raw PNG or JPEG bytes, one server-only X-API-Key; answers { theme_payload, brand, preview } (BK-C6).
//     theme_payload and preview.source_colors are the ORIGINAL hexes (lowercased, nothing else changed); preview.role_colors are DERIVED display roles and are never saved or written anywhere (BK-C7).
//   - Director bc0643f1 / !673 (src/models/brand_kit.py, main.py): GET and PUT /api/users/{u}/themes/{id}/brand, the BrandKit model, every field optional, extra keys refused, PUT replaces the whole record and {} clears it (BK-C12).

import { THEME_FONT_FAMILIES, canonicalThemeFont } from '@/lib/theme-fonts'

/** Exact "true". Read on each call (Next inlines the NEXT_PUBLIC_ value; the try only guards sandboxes without `process`). */
export function isStudioBrandKitEnabled(): boolean {
  try {
    return process.env.NEXT_PUBLIC_STUDIO_BRAND_KIT === 'true'
  } catch {
    return false
  }
}

// ---- limits ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const BRAND_EXTRACT_MIME_TYPES = ['image/png', 'image/jpeg'] as const
export type BrandExtractMime = typeof BRAND_EXTRACT_MIME_TYPES[number]
/** BK-Q7: 4 MiB in the browser and in the route (Theme Builder takes 5 MiB; the Vercel request-body limit is a platform limit not checked here). */
export const BRAND_EXTRACT_MAX_BYTES = 4 * 1024 * 1024
/** BK-C5: the route's fetch must outlast Theme Builder's worst case (30 s upload read plus the 30 s default vision deadline). */
export const BRAND_EXTRACT_TIMEOUT_MS = 65_000
/** BK-Q6: a small per-user daily cap on the Studio route until spend attribution exists. Counted in the existing fe_api_rate_events table. */
export const BRAND_EXTRACT_DAILY_CAP = 10
export const BRAND_EXTRACT_CAP_BUCKET = 'brand_extract'
/** The PUT body of the brand record is a handful of short strings. */
export const BRAND_RECORD_MAX_BODY_BYTES = 8192
/** Director's BrandKit field limits (src/models/brand_kit.py). */
export const BRAND_LIMITS = { logo_url: 2048, footer: 200, confidentiality: 120, heading_font: 80, body_font: 80 } as const
/** The wire order of Director's BrandKit; any other key is refused by Director (extra = forbid). */
export const BRAND_RECORD_KEYS = ['logo_url', 'placement', 'footer', 'confidentiality', 'heading_font', 'body_font'] as const

// ---- the shapes --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export type BrandColourKey = 'primary_hex' | 'secondary_hex' | 'tertiary_hex' | 'neutral_hex'
export const BRAND_COLOUR_KEYS: readonly BrandColourKey[] = ['primary_hex', 'secondary_hex', 'tertiary_hex', 'neutral_hex']
export const BRAND_COLOUR_LABELS: Record<BrandColourKey, string> = { primary_hex: 'Primary / brand', secondary_hex: 'Secondary', tertiary_hex: 'Tertiary', neutral_hex: 'Neutral' }
/** Theme Builder's 14 derived display roles (BK-C6). Display only. */
export const BRAND_ROLE_KEYS = ['primary', 'primary_dark', 'secondary', 'accent', 'background', 'background_alt', 'surface', 'border', 'text_primary', 'text_secondary', 'text_body', 'text_on_dark', 'hero_background', 'hero_text_primary'] as const

export interface BrandRecord {
  logo_url?: string
  placement?: 'top_right'
  footer?: string
  confidentiality?: string
  heading_font?: string
  body_font?: string
}

export interface BrandContrastCheck {
  foreground_role: string
  foreground_hex: string
  background_role: string
  background_hex: string
  ratio: number
  passes_aa: boolean
}

export interface BrandExtractTheme {
  mode: 'custom'
  primary_hex: string
  secondary_hex?: string
  tertiary_hex?: string
  neutral_hex?: string
  font_family_heading?: string
  font_family?: string
}

/** Theme Builder's answer, cleaned: the same keys (BK-C6), only what is valid, nothing invented. */
export interface BrandExtractResult {
  theme_payload: BrandExtractTheme
  brand: { heading_font?: string; body_font?: string }
  preview: {
    source_colors: Partial<Record<BrandColourKey, string>>
    role_colors: Record<string, string>
    contrast_checks: BrandContrastCheck[]
    warnings: string[]
    font_suggestions_review_only: true
  }
}

const HEX = /^#[0-9a-fA-F]{6}$/
const CONTROL = /[\u0000-\u001f\u007f]/
const ROLE_NAME = /^[a-z][a-z0-9_]{0,39}$/
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const hexOf = (value: unknown): string | undefined => (typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : undefined)

/** Two hexes name the same colour (case aside). */
export const sameHex = (a: unknown, b: unknown): boolean => hexOf(a) !== undefined && hexOf(a) === hexOf(b)

// ---- the file ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export type BrandExtractCode = 'type' | 'size' | 'empty' | 'unreadable' | 'unavailable' | 'no_colors' | 'cap' | 'failed' | 'timeout' | 'network' | 'signin' | 'unconfigured'

/** The browser's pre-check, and the route's first one: a PNG or a JPEG, not empty, at most 4 MiB. (SVG, WebP, GIF and PDF are not accepted.) */
export function checkBrandExtractFile(file: { type?: unknown; size?: unknown } | null | undefined): { ok: true; mime: BrandExtractMime } | { ok: false; code: BrandExtractCode } {
  const type = typeof file?.type === 'string' ? file.type : ''
  const mime = BRAND_EXTRACT_MIME_TYPES.find(candidate => candidate === type)
  if (!mime) return { ok: false, code: 'type' }
  const size = typeof file?.size === 'number' && Number.isFinite(file.size) ? file.size : -1
  if (size <= 0) return { ok: false, code: 'empty' }
  if (size > BRAND_EXTRACT_MAX_BYTES) return { ok: false, code: 'size' }
  return { ok: true, mime }
}

/** What the first bytes say the file is: the PNG signature or the JPEG start-of-image marker. A name or a Content-Type says nothing; the bytes do. */
export function sniffBrandImageMime(bytes: Uint8Array): BrandExtractMime | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}

// ---- Theme Builder's answer --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * Read Theme Builder's 200 (BK-C6), or null when it is not what the contract says. The originals are theme_payload's hexes: they are what "Use these colours" copies and what the screen shows, so
 * preview.source_colors (the same hexes, by contract) must agree with them; a disagreement is a broken answer, not a choice. Fonts count only from the 8-family catalog. Warnings are plain text.
 */
export function parseBrandExtract(raw: unknown): BrandExtractResult | null {
  if (!isObject(raw) || !isObject(raw.theme_payload)) return null
  const payload = raw.theme_payload
  if (payload.mode !== 'custom') return null
  const primary = hexOf(payload.primary_hex)
  if (!primary) return null
  const theme: BrandExtractTheme = { mode: 'custom', primary_hex: primary }
  for (const key of BRAND_COLOUR_KEYS) {
    if (key === 'primary_hex') continue
    const hex = hexOf(payload[key])
    if (hex) theme[key] = hex
  }
  const brand: BrandExtractResult['brand'] = {}
  const brandRaw = isObject(raw.brand) ? raw.brand : {}
  const heading = canonicalThemeFont(brandRaw.heading_font ?? payload.font_family_heading)
  const body = canonicalThemeFont(brandRaw.body_font ?? payload.font_family)
  if (heading) { brand.heading_font = heading; theme.font_family_heading = heading }
  if (body) { brand.body_font = body; theme.font_family = body }

  const previewRaw = isObject(raw.preview) ? raw.preview : {}
  const sourceRaw = isObject(previewRaw.source_colors) ? previewRaw.source_colors : {}
  const source_colors: BrandExtractResult['preview']['source_colors'] = {}
  for (const key of BRAND_COLOUR_KEYS) {
    const mine = theme[key]
    const theirs = hexOf(sourceRaw[key])
    if (theirs !== undefined && theirs !== mine) return null
    if (mine) source_colors[key] = mine
  }
  const roleRaw = isObject(previewRaw.role_colors) ? previewRaw.role_colors : {}
  const role_colors: Record<string, string> = {}
  for (const role of BRAND_ROLE_KEYS) {
    const hex = hexOf(roleRaw[role])
    if (hex) role_colors[role] = hex
  }
  const contrast_checks: BrandContrastCheck[] = []
  if (Array.isArray(previewRaw.contrast_checks)) {
    for (const entry of previewRaw.contrast_checks.slice(0, 20)) {
      if (!isObject(entry)) continue
      const ratio = typeof entry.ratio === 'number' && Number.isFinite(entry.ratio) && entry.ratio >= 1 && entry.ratio <= 21 ? entry.ratio : null
      const fg = hexOf(entry.foreground_hex), bg = hexOf(entry.background_hex)
      if (ratio === null || !fg || !bg || typeof entry.foreground_role !== 'string' || typeof entry.background_role !== 'string' || !ROLE_NAME.test(entry.foreground_role) || !ROLE_NAME.test(entry.background_role)) continue
      contrast_checks.push({ foreground_role: entry.foreground_role, foreground_hex: fg, background_role: entry.background_role, background_hex: bg, ratio, passes_aa: ratio >= 4.5 })
    }
  }
  const warnings: string[] = []
  if (Array.isArray(previewRaw.warnings)) {
    for (const entry of previewRaw.warnings.slice(0, 20)) {
      if (typeof entry !== 'string') continue
      const text = entry.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim()
      if (text) warnings.push(text.slice(0, 300))
    }
  }
  return { theme_payload: theme, brand, preview: { source_colors, role_colors, contrast_checks, warnings, font_suggestions_review_only: true } }
}

/** The contrast rows that fail AA as normal text on the preview background (BK-C7: a notice, never an error and never a reason to change a hex). */
export const failingContrast = (result: BrandExtractResult): BrandContrastCheck[] => result.preview.contrast_checks.filter(check => !check.passes_aa)

// ---- the brand record --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface BrandKitForm { logoUrl: string; footer: string; confidentiality: string }
export const EMPTY_BRAND_FORM: BrandKitForm = { logoUrl: '', footer: '', confidentiality: '' }

export type BrandRecordField = typeof BRAND_RECORD_KEYS[number]
export type BrandRecordCheck = { ok: true; record: BrandRecord } | { ok: false; field: BrandRecordField | 'body'; message: string }

/** An https:// URL, up to Director's 2,048 characters, with a host, no credentials and no spaces or control characters. Anything else is not a logo link. */
export function cleanBrandLogoUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (!text || text.length > BRAND_LIMITS.logo_url || CONTROL.test(text) || /\s/.test(text)) return undefined
  try {
    const url = new URL(text)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return undefined
    return text
  } catch {
    return undefined
  }
}

function cleanText(value: unknown, max: number): string | undefined | null {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text) return undefined
  if (text.length > max || CONTROL.test(text)) return null
  return text
}

/**
 * Check a brand record the way Director will, plus the one rule Director does not have: fonts must be the 8 catalog names, so the kit's fonts equal the theme's. A value that is an empty string counts as absent (Director reads
 * an empty logo_url as absent); a key Director does not know, a non-string, an over-long value, an http link or a second placement is refused. {} is a valid record here (it is the clear): callers decide whether it may be sent.
 */
export function validateBrandRecord(raw: unknown): BrandRecordCheck {
  if (!isObject(raw)) return { ok: false, field: 'body', message: 'The brand details must be an object.' }
  for (const key of Object.keys(raw)) {
    if (!(BRAND_RECORD_KEYS as readonly string[]).includes(key)) return { ok: false, field: 'body', message: `Unknown brand detail "${key.slice(0, 40)}".` }
  }
  const record: BrandRecord = {}
  for (const key of BRAND_RECORD_KEYS) {
    const value = raw[key]
    if (value === undefined || value === '') continue
    if (key === 'logo_url') {
      const url = cleanBrandLogoUrl(value)
      if (!url) return { ok: false, field: key, message: BRAND_COPY.logoLinkInvalid }
      record.logo_url = url
    } else if (key === 'placement') {
      if (value !== 'top_right') return { ok: false, field: key, message: 'The logo can only sit top right.' }
      record.placement = 'top_right'
    } else if (key === 'footer' || key === 'confidentiality') {
      const text = cleanText(value, BRAND_LIMITS[key])
      if (text === null) return { ok: false, field: key, message: key === 'footer' ? BRAND_COPY.footerTooLong : BRAND_COPY.confidentialityTooLong }
      if (text !== undefined) record[key] = text
    } else {
      const family = canonicalThemeFont(value)
      if (!family || family !== value) return { ok: false, field: key, message: 'Fonts must be one of the eight Studio fonts.' }
      record[key] = family
    }
  }
  // the keys come out in Director's order, whatever order they went in
  const ordered: BrandRecord = {}
  for (const key of BRAND_RECORD_KEYS) if (record[key] !== undefined) (ordered as Record<string, string>)[key] = record[key] as string
  return { ok: true, record: ordered }
}

/** Read what Director stored, leniently: each known key that is valid, nothing else (a stored value that is not valid is left out, as Director reads it as unset). */
export function readBrandRecord(raw: unknown): BrandRecord | null {
  if (!isObject(raw)) return null
  const record: BrandRecord = {}
  for (const key of BRAND_RECORD_KEYS) {
    const value = raw[key]
    if (value === undefined || value === null) continue
    const single = validateBrandRecord({ [key]: value })
    if (single.ok && single.record[key] !== undefined) (record as Record<string, string>)[key] = single.record[key] as string
  }
  return record
}

/** { id, brand } as Director answers a GET or a PUT: brand is null (unset) or an object. Anything else is not an answer. */
export function readBrandResponse(raw: unknown): { id: string; brand: BrandRecord | null } | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id) return null
  if (raw.brand === null) return { id: raw.id, brand: null }
  const brand = readBrandRecord(raw.brand)
  return brand ? { id: raw.id, brand } : null
}

/** The record the form builds. Fonts are the SAVED THEME's (never typed here) and only the catalog names; placement goes with a logo. Empty when nothing is filled in (and then nothing is sent). */
export function brandRecordFromForm(form: BrandKitForm, fonts: { heading?: unknown; body?: unknown } = {}): BrandRecordCheck {
  return validateBrandRecord({
    logo_url: form.logoUrl,
    placement: form.logoUrl.trim() ? 'top_right' : undefined,
    footer: form.footer,
    confidentiality: form.confidentiality,
    heading_font: canonicalThemeFont(fonts.heading),
    body_font: canonicalThemeFont(fonts.body),
  })
}

export const brandRecordIsEmpty = (record: BrandRecord): boolean => BRAND_RECORD_KEYS.every(key => record[key] === undefined)

/** The fields of the form that cannot be saved as they stand, each with its words. No fonts are checked here (they are the theme's). */
export function brandFormProblems(form: BrandKitForm): { logoUrl?: string; footer?: string; confidentiality?: string } {
  const out: { logoUrl?: string; footer?: string; confidentiality?: string } = {}
  if (form.logoUrl.trim() && !cleanBrandLogoUrl(form.logoUrl)) out.logoUrl = BRAND_COPY.logoLinkInvalid
  if (form.footer.replace(/\s+/g, ' ').trim().length > BRAND_LIMITS.footer || CONTROL.test(form.footer)) out.footer = BRAND_COPY.footerTooLong
  if (form.confidentiality.replace(/\s+/g, ' ').trim().length > BRAND_LIMITS.confidentiality || CONTROL.test(form.confidentiality)) out.confidentiality = BRAND_COPY.confidentialityTooLong
  return out
}

/** Every field that was sent came back the same (the answer of a PUT is the stored record). A field Director dropped (fonts with its font switch off, say) is a mismatch the person is told about. */
export const brandRecordKept = (sent: BrandRecord, stored: BrandRecord | null): boolean => BRAND_RECORD_KEYS.every(key => sent[key] === undefined || stored?.[key] === sent[key])

// ---- Director's refusals, in Studio's codes -----------------------------------------------------------------------------------------------------------------------------------------------------------
export type BrandApiCode = 'kit_unavailable' | 'theme_not_found' | 'entitlement' | 'entitlement_unavailable' | 'invalid_brand' | 'unavailable' | 'director_error' | 'director_unreachable' | 'signin' | 'bad_request' | 'too_large' | 'clear_refused' | 'unconfigured'

/**
 * BK-C15, in one place (the route answers with this, the browser reads it): Director's two 404s differ only in `detail` ("Not Found" is the feature being off, "theme not found" a stale row); the entitlement refusals carry a code;
 * 422 is a refused record; 500 and 503 are a store that cannot answer (Director !673 says 503, the pin said 500: both are "try again").
 */
export function classifyDirectorBrandError(status: number, body: unknown): { status: number; code: BrandApiCode; retryable: boolean } {
  const detail = isObject(body) && typeof body.detail === 'string' ? body.detail : ''
  const entitlement = isObject(body) && typeof body.code === 'string' ? body.code : ''
  if (status === 404) return detail === 'Not Found' ? { status: 404, code: 'kit_unavailable', retryable: false } : { status: 404, code: 'theme_not_found', retryable: false }
  if (status === 401 || status === 403) return { status, code: 'entitlement', retryable: false }
  if (status === 503 && entitlement === 'ENTITLEMENT_UNAVAILABLE') return { status: 503, code: 'entitlement_unavailable', retryable: true }
  if (status === 422) return { status: 422, code: 'invalid_brand', retryable: false }
  if (status === 500 || status === 503) return { status: 503, code: 'unavailable', retryable: true }
  return { status: 502, code: 'director_error', retryable: false }
}

// ---- the words (one place, so a proof can read every string the Brand Kit can say) ------------------------------------------------------------------------------------------------------------
export const BRAND_COPY = {
  heading: 'Brand kit',
  intro: 'Add your logo, footer and confidentiality line to this theme. Nothing is saved until you press Save reusable theme.',
  extractHeading: 'Suggest colours from a logo',
  extractIntro: 'Optional. Pick a PNG or JPEG (up to 4 MB). The suggestions are an AI model\'s estimate of what it sees, not exact colours: check them against your brand guide before you save.',
  pickFile: 'Choose a logo image',
  consent: 'I agree to send this image once to an AI model to suggest colours and fonts. This step does not store the image.',
  extractButton: 'Suggest colours',
  extracting: 'Looking at your logo…',
  cancel: 'Cancel',
  suggestedHeading: 'Suggested colours',
  suggestedNote: 'Suggested by AI from your image. Nothing in your draft has changed yet.',
  suggestedNoteUsed: 'Suggested by AI from your image. These colours are now in your draft; colours you edited are marked.',
  derivedHeading: 'How Studio will draw them',
  derivedNote: 'Derived display colours, for your information. They are never saved, and your colours are never adjusted.',
  useColours: 'Use these colours',
  useFonts: 'Use suggested fonts',
  fontsNote: 'Fonts are a visual guess, not an identification.',
  fontsOff: 'Theme fonts are not switched on here, so font suggestions are for reference only.',
  noWarnings: 'No contrast warnings.',
  confirmed: 'These colours are in your draft. You can still edit them below; edited colours show what the suggestion was.',
  changedFrom: (hex: string) => `edited (suggested ${hex})`,
  logoLinkLabel: 'Logo link (https://)',
  logoLinkHelp: 'A link to a PNG or JPEG you host. Studio cannot host logo files yet, so the image you picked above is used for colour suggestions only and is not saved.',
  logoLinkInvalid: 'A logo link must start with https:// and be under 2,048 characters.',
  footerLabel: 'Footer text',
  footerHelp: 'Used as the company line in the deck footer.',
  footerTooLong: 'Footer text can be up to 200 characters.',
  confidentialityLabel: 'Confidentiality line',
  confidentialityTooLong: 'The confidentiality line can be up to 120 characters.',
  sampleHeading: 'Sample slide',
  sampleNote: 'The logo is drawn top right on content slides, on a light plate over dark backgrounds. PowerPoint downloads do not carry it yet. The footer is composed per deck.',
  logoNotLoaded: 'The logo could not be loaded from that link.',
  saving: 'Saving brand details…',
  retry: 'Save brand details again',
  setStandard: 'Set as standard',
  savedStandard: (name: string) => `Brand details saved to “${name}”. They are used for new presentations because this is your standard theme. Existing decks are unchanged.`,
  savedNotStandard: (name: string) => `Brand details saved to “${name}”. New presentations use a brand kit only from your standard theme, so set this theme as standard to use it. Existing decks are unchanged.`,
  savedDropped: 'Some details were not kept by the server.',
  partial: (name: string, reason: string) => `“${name}” was saved, but its brand details were not. ${reason}`,
  notSwitchedOn: (name: string) => `“${name}” was saved. Brand details are not switched on for your account yet, so none were saved.`,
  notStandardHint: 'New presentations use a brand kit only from your standard theme.',
  savedDetailsHeading: 'Brand details',
  savedDetailsNone: 'No brand details saved on this theme.',
  savedDetailsUnavailable: 'Brand details could not be read right now.',
  savedDetailsLoading: 'Reading brand details…',
} as const

/** What a refused or failed extraction says, and what to do next. A retry is a fresh click, and each attempt may count towards today's limit (BK-C9). */
export const BRAND_EXTRACT_WORDS: Record<BrandExtractCode, string> = {
  type: 'Use a PNG or JPEG image.',
  size: 'Use a smaller file (up to 4 MB).',
  empty: 'That file is empty. Choose another image.',
  unreadable: 'That image cannot be read. Try another PNG or JPEG.',
  unavailable: 'Colour suggestions are not available right now. You can still enter your colours by hand.',
  unconfigured: 'Colour suggestions are not available right now. You can still enter your colours by hand.',
  no_colors: 'No brand colours were found in that image. Enter your colours by hand.',
  cap: 'You have reached today\'s limit for colour suggestions. Try again tomorrow, or enter your colours by hand.',
  failed: 'The suggestion did not work. Press Suggest colours to try again (each try can count towards today\'s limit).',
  timeout: 'The suggestion took too long. Press Suggest colours to try again (each try can count towards today\'s limit).',
  network: 'Studio could not be reached. Check your connection, then try again.',
  signin: 'Sign in again to get colour suggestions.',
}

/** What a failed brand save or read says. */
export const BRAND_SAVE_WORDS: Record<BrandApiCode, string> = {
  kit_unavailable: 'Brand details are not switched on for your account yet.',
  theme_not_found: 'That theme is no longer in your library. Refresh the library.',
  entitlement: 'Your session could not be verified. Reload the page, then try again.',
  entitlement_unavailable: 'Brand details are temporarily unavailable. Try again in a moment.',
  invalid_brand: 'Some brand details were refused. Check the logo link, footer and confidentiality line.',
  unavailable: 'Brand details are temporarily unavailable. Try again in a moment.',
  director_error: 'Brand details could not be saved. Try again in a moment.',
  director_unreachable: 'Brand details could not be saved because Studio could not reach the service. Try again in a moment.',
  signin: 'Sign in again to save brand details.',
  bad_request: 'The brand details were not in the right shape.',
  too_large: 'The brand details were too long.',
  clear_refused: 'Nothing was sent: an empty brand record would clear the kit, and that needs an explicit remove.',
  unconfigured: 'Brand details are not configured here yet.',
}

// ---- the logo host seam (BK-B5, needs PK) -----------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * NOT BUILT. There is no logo host: /api/upload is the Knowledge file store and returns no URL, the avatar route rewrites the profile image. A new public content-addressed bucket plus a route is a production data-plane change
 * that needs PK's OK (BK-B5). Until it exists the Brand Kit takes only a logo link the person already has (https), and the image picked for colour suggestions is used for that and is not kept.
 * TODO(BK-B5): when the host exists, implement this interface in a new route (suggested POST /api/brand/logo: session, requireApprovedUser, PNG or JPEG, the same 4 MiB cap, a path of {userId}/{sha256 prefix}.{ext}, no upsert,
 * never deleted, answers { url } on its own bucket host only) and let the form offer "Use this image as my logo" with the bytes already in the browser. Studio must then send Director only URLs on that host.
 */
export interface BrandLogoHost {
  upload(bytes: Uint8Array, mime: BrandExtractMime): Promise<{ url: string }>
}
export const BRAND_LOGO_HOST: BrandLogoHost | null = null

/** The eight Studio fonts, for a proof to read. */
export const BRAND_FONT_FAMILIES: readonly string[] = THEME_FONT_FAMILIES
