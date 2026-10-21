// PASS2 DET-01/03/04/06 (flag NEXT_PUBLIC_STUDIO_P2_DETAILS, default off). Import-free: the words, the draft, and the one mapping between the Your details draft and the deck's EXISTING footer / logo.
//
// What the deck already has (Layout Service, the Master panel's fields): presentation.derivative_elements = { footer: { template, values, sources?, sources_style?, style? }, logo: { image_url, alt_text } }.
// Layout fills ONLY five tokens in a footer template: {title} {page} {total} {date} {author} (values.date / values.author; {title} falls back to the presentation's own title).
// The draft has five more fields the mockup lists (professional title, organization, contact email, website, confidentiality line). They have no slot in the deck, so they are written as
// LITERAL TEXT into the template (an empty one is dropped with its separator); the deck therefore only ever receives Layout's own five tokens. Nothing here invents a field or a scope:
// "Reusable defaults" needs new storage (PROGRAM-1 ruling on DET-01: backlog), so this file has no defaults and no storage.
//
// Auto date: an empty Date field writes the current month and year ("Oct 2026"), as the mockup's placeholder says. Footer hidden: the footer is left out of the write, the way the Master panel
// saves an empty template (its footer is null); the footer's sources / style fields and every value it already has are kept whenever it is shown.

export interface StudioDetailsDraft {
  author: string
  role: string
  company: string
  email: string
  website: string
  confidentiality: string
  logoUrl: string
  date: string
  footer: string
  showFooter: boolean
}

export interface StudioDeckFooter {
  template: string
  values: Record<string, string>
  sources?: string
  sources_style?: Record<string, unknown>
  style?: Record<string, unknown> | null
}
export interface StudioDeckLogo { image_url: string | null; alt_text?: string }
export interface StudioDeckDerivative { footer?: StudioDeckFooter | null; logo?: StudioDeckLogo | null }
export interface StudioDeckSession {
  title?: string | null
  blankPresentationId?: string | null
  strawmanPresentationId?: string | null
  finalPresentationId?: string | null
  stateCache?: { activeVersion?: string | null } | null
}

export const STUDIO_DETAILS_WORDS = {
  scope: 'This presentation',
  scopeNote: 'Changes apply across this presentation.',
  scopeLoading: 'Finding your open presentation…',
  scopeNone: 'Open or build a presentation in Studio, then come back to apply these details to it.',
  scopeError: 'Your open presentation could not be read. Reload to try again.',
  save: 'Save to this presentation',
  saving: 'Saving…',
  saved: 'Saved. These details now apply across this presentation.',
  saveFailed: 'The presentation was not changed. Try again.',
  saveNote: 'Saving writes the footer and logo to the presentation. Leaving this page discards unsaved edits.',
  noteNone: 'There is no presentation to save to yet. Leaving this page discards the draft.',
  logoInvalid: 'Use an HTTPS image URL, or leave this empty.',
  footerLong: 'The footer is longer than 200 characters once your details are filled in. Shorten it before saving.',
} as const

export const STUDIO_DETAILS_FOOTER_MAX = 200
export const STUDIO_DETAILS_LOGO_MAX = 2000
export const STUDIO_DETAILS_DEFAULT_FOOTER = '{author} · {role} · {company} | {page}/{total}'

/** The mockup's four preset buttons, in its order. */
export const STUDIO_DETAILS_FOOTER_PRESETS: readonly { label: string; value: string }[] = [
  { label: 'Page only', value: '{page}' },
  { label: 'Page X of Y', value: 'Page {page} of {total}' },
  { label: 'Title + Page', value: '{title} | {page}' },
  { label: 'Author + role', value: STUDIO_DETAILS_DEFAULT_FOOTER },
]

/** "Insert a field": the five tokens Layout fills, then the five details this page fills before they reach it. */
export const STUDIO_DETAILS_FIELD_TOKENS: readonly string[] = ['author', 'role', 'company', 'title', 'date', 'page', 'total', 'confidentiality', 'email', 'website']
const LAYOUT_TOKENS = ['title', 'page', 'total', 'date', 'author']
const DETAIL_TOKENS = ['role', 'company', 'email', 'website', 'confidentiality']

export const studioDetailsInitial = (accountName: string): StudioDetailsDraft => ({
  author: typeof accountName === 'string' ? accountName : '', role: '', company: '', email: '', website: '', confidentiality: '', logoUrl: '', date: '', footer: STUDIO_DETAILS_DEFAULT_FOOTER, showFooter: true,
})

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const studioDetailsAutoDate = (now: Date): string => `${MONTHS[now.getMonth()]} ${now.getFullYear()}`

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const TOKEN = /\{([a-z]+)\}/g

/** Empty parts and their separators go; what is left is joined with " · " (the mockup's footer). */
const tidy = (template: string): string => template.split(/\s*[|·]\s*/).filter(part => part.trim()).join(' · ').trim()

/** The footer the deck would get: the draft template with the five details filled in. Null when the footer is hidden or nothing is left. Layout's own tokens stay tokens. */
export function studioDetailsDeckFooter(draft: StudioDetailsDraft, now: Date): { template: string; values: Record<string, string> } | null {
  if (!draft.showFooter) return null
  const filled: Record<string, string> = { role: draft.role.trim(), company: draft.company.trim(), email: draft.email.trim(), website: draft.website.trim(), confidentiality: draft.confidentiality.trim() }
  const author = draft.author.trim()
  const date = draft.date.trim() || studioDetailsAutoDate(now)
  let changed = false
  const resolved = draft.footer.replace(TOKEN, (whole, key: string) => {
    if (DETAIL_TOKENS.includes(key)) { changed = true; return filled[key] }
    if (key === 'author' && !author) { changed = true; return '' }
    return whole
  })
  const template = changed ? tidy(resolved) : resolved.trim()
  if (!template) return null
  const values: Record<string, string> = {}
  if (/\{author\}/.test(template)) values.author = author
  if (/\{date\}/.test(template)) values.date = date
  return { template, values }
}

/** What one slide's footer reads: the deck footer with Layout's tokens filled. Page numbers start at 1. */
export function studioDetailsFooterText(draft: StudioDetailsDraft, title: string, page: number, total: number, now: Date): string {
  const footer = studioDetailsDeckFooter(draft, now)
  if (!footer) return ''
  const values: Record<string, string> = { ...footer.values, title, page: String(page), total: String(total) }
  return footer.template.replace(TOKEN, (whole, key: string) => (LAYOUT_TOKENS.includes(key) ? (values[key] ?? '') : whole)).trim()
}

export const studioDetailsLogoValid = (logoUrl: string): boolean => {
  const value = typeof logoUrl === 'string' ? logoUrl.trim() : ''
  return !value || (value.length <= STUDIO_DETAILS_LOGO_MAX && /^https:\/\/[^\s]+$/i.test(value))
}

export function studioDetailsDeckLogo(draft: StudioDetailsDraft): StudioDeckLogo | null {
  const url = draft.logoUrl.trim()
  if (!url || !studioDetailsLogoValid(url)) return null
  const company = draft.company.trim()
  return { image_url: url, alt_text: (company ? `${company} logo` : 'Presentation logo').slice(0, 100) }
}

export function studioDetailsValid(draft: StudioDetailsDraft, now: Date): { logo: boolean; footer: boolean; ok: boolean } {
  const logo = studioDetailsLogoValid(draft.logoUrl)
  const footer = (studioDetailsDeckFooter(draft, now)?.template.length ?? 0) <= STUDIO_DETAILS_FOOTER_MAX
  return { logo, footer, ok: logo && footer }
}

/** The whole write: the deck's existing derivative elements with the footer and logo replaced by the draft's. Existing footer sources / styles and any other value keys stay. */
export function studioDetailsMergeDerivative(existing: unknown, draft: StudioDetailsDraft, now: Date): StudioDeckDerivative {
  const base = isObject(existing) ? existing : {}
  const previous = isObject(base.footer) ? base.footer : null
  const next: Record<string, unknown> = { ...base }
  delete next.footer
  delete next.logo
  const footer = studioDetailsDeckFooter(draft, now)
  if (footer) {
    const values: Record<string, string> = {}
    if (previous && isObject(previous.values)) for (const [key, value] of Object.entries(previous.values)) if (typeof value === 'string') values[key] = value
    next.footer = { ...(previous ?? {}), template: footer.template, values: { ...values, ...footer.values } }
  }
  const logo = studioDetailsDeckLogo(draft)
  if (logo) {
    // The organization is not recoverable from a saved deck, so an unchanged logo keeps the alt text it has.
    const was = isObject(base.logo) ? base.logo : null
    if (!draft.company.trim() && was && was.image_url === logo.image_url && text(was.alt_text).trim()) logo.alt_text = text(was.alt_text).slice(0, 100)
    next.logo = logo
  }
  return next as StudioDeckDerivative
}

/** True when saving this draft would change what the deck stores (so a loaded, untouched draft is not "unsaved"). */
export function studioDetailsWouldChange(existing: unknown, draft: StudioDetailsDraft, now: Date): boolean {
  return JSON.stringify(canon(studioDetailsMergeDerivative(existing, draft, now))) !== JSON.stringify(canon(isObject(existing) ? existing : {}))
}

const canon = (value: unknown): unknown => Array.isArray(value) ? value.map(canon) : isObject(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canon(value[key])])) : value

/** The draft a deck starts from: its existing footer template / author / date and logo. A deck with no footer starts from the mockup's default. */
export function studioDetailsDraftFromDeck(existing: unknown, accountName: string): StudioDetailsDraft {
  const draft = studioDetailsInitial(accountName)
  const base = isObject(existing) ? existing : {}
  const footer = isObject(base.footer) ? base.footer : null
  const logo = isObject(base.logo) ? base.logo : null
  if (footer && text(footer.template).trim()) {
    const values = isObject(footer.values) ? footer.values : {}
    draft.footer = text(footer.template)
    draft.author = text(values.author).trim() || draft.author
    draft.date = text(values.date)
  }
  if (logo && studioDetailsLogoValid(text(logo.image_url))) draft.logoUrl = text(logo.image_url)
  return draft
}

/** The presentation a session shows: the active version when it has an id, else final, strawman, blank. */
export function studioDetailsDeckTarget(session: unknown): { presentationId: string; title: string } | null {
  if (!isObject(session)) return null
  const ids: Record<string, string> = { final: text(session.finalPresentationId).trim(), strawman: text(session.strawmanPresentationId).trim(), blank: text(session.blankPresentationId).trim() }
  const cache = isObject(session.stateCache) ? session.stateCache : null
  const active = text(cache?.activeVersion)
  const key = [active, 'final', 'strawman', 'blank'].find(name => Object.prototype.hasOwnProperty.call(ids, name) && ids[name])
  return key ? { presentationId: ids[key], title: text(session.title).trim() } : null
}
