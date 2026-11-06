// UAT MARKETING PORT (flag NEXT_PUBLIC_STUDIO_UAT_MARKETING, default off). Import-free: the flag, the words that keep two Pass 2 rulings, and the phone menu's open / close rules. No I/O.
//
// What the flag does: with it on, the seven Landing pages (/, /bring, /present, /experts, /pricing, /about, /learn) are the UAT design (pass 2 of 3-4 Oct 2026: status pills from one config, "Request access" CTAs,
// the hero film, gallery wall, the L-B logo symbol, UAT's own phone menu) rendered from a parallel tree (components/marketing/v3-uat, lib/marketing/v3-uat-content.ts, styles/marketing-v3-uat.css, public/marketing/v3-uat).
// With it off nothing of that tree is rendered and the pages are exactly as they were.
//
// How it meets the Pass 2 rulings already on dev (only when their own flags are on as well):
//   LAND-05 (NEXT_PUBLIC_STUDIO_P2_LANDING)  Narration and Viewers-ask are "Live" (PK, later than UAT's 3 Oct "Beta"): studioUatFeatures flips those two features and studioUatContent rewords the sentences that said "beta" for them.
//   ACC-14  (NEXT_PUBLIC_STUDIO_P2_ACCOUNT)  the plan words come from PRICING_TIERS; studioUatBetaLine finds the Knowledge-graph line again once those words replace UAT's, so its Beta pill stays.
//   LAND-06 (the phone menu)                 UAT's menu replaces it in the UAT tree and keeps its behaviours: a press outside closes, Escape closes and hands the focus back, choosing a link closes.

/** Exact "true" turns it on. Anything else (unset, "false", "TRUE", " true") is off. The caller passes `process.env.NEXT_PUBLIC_STUDIO_UAT_MARKETING` (Next inlines it at build time). */
export function studioUatMarketingOn(value: string | null | undefined): boolean {
  return value === 'true'
}

/** The class on the page's root `.mv3` element, only in the UAT tree: every rule of styles/marketing-v3-uat.css starts `.mv3:where(.mv3-uat)` (or names a class that only that tree renders). */
export const STUDIO_UAT_ROOT_CLASS = 'mv3-uat'

/** Where the UAT tree reads its slide stills from. UAT replaced some stills in place and deleted others that the unflagged pages still use, so the UAT set lives beside them, not over them. */
export const STUDIO_UAT_SLIDES_PATH = '/marketing/v3-uat/slides/'

// ---------------------------------------------------------------- LAND-05: the two statuses the later ruling keeps "Live"

/** The features the Landing ruling (LAND-05) holds at "live", whatever UAT's config says. Meetings stay "planned". */
export const STUDIO_UAT_LANDING_LIVE_FEATURES = ['narration', 'questions'] as const

/** UAT's feature -> status config with the ruling applied. Off, it returns the very same object. The object handed in is never changed. */
export function studioUatFeatures<T extends Record<string, string>>(features: T, landingOn: boolean): T {
  if (landingOn !== true) return features
  const next: Record<string, string> = { ...features }
  for (const key of STUDIO_UAT_LANDING_LIVE_FEATURES) if (Object.prototype.hasOwnProperty.call(next, key)) next[key] = 'live'
  return next as T
}

/** One piece of the copy to reword: `exact` swaps a string that is the whole value, otherwise the text is swapped inside whichever string holds it. */
export interface StudioUatTextRule { from: string; to: string; exact?: boolean }

/** The sentences of UAT's copy that call narration or audience questions "beta" (each text is in the copy exactly once; the test proves it). With the ruling they read as shipped. */
export const STUDIO_UAT_LANDING_TEXT_RULES: readonly StudioUatTextRule[] = [
  { from: 'It presents and answers questions · beta', to: 'It presents and answers questions' },
  { from: 'In beta, viewers can ask it questions and it answers from your slides and documents. Narration and live meetings come next.', to: 'Viewers can ask it questions and it answers from your slides and documents, and it can narrate itself. Live meetings come next.' },
  { from: 'Narration · beta', to: 'Narration' },
  { from: '· beta', to: '· live', exact: true },
  { from: 'In beta: audience questions and narration.', to: 'Audience questions and narration included.' },
  { from: "In beta, it answers your audience's questions from your slides and documents, and can narrate itself in a stock voice you pick.", to: "It answers your audience's questions from your slides and documents, and can narrate itself in a stock voice you pick." },
  { from: 'What a published deck can do today, what is in beta, and what is planned.', to: 'What a published deck can do today, and what is planned.' },
  { from: 'Audience questions, narration, the knowledge graph and templates from your own decks. Beta features may change.', to: 'The knowledge graph and templates from your own decks. Beta features may change.' },
]

/** The About page's status columns: these two lines move from the "beta" column to the "live" one with the ruling. */
export const STUDIO_UAT_LANDING_MOVED_LINES = [
  'Audience questions on published decks, with your inbox',
  'Narration in one of nine stock voices, fitted to your time',
] as const

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

function swapText(text: string, rules: readonly StudioUatTextRule[]): string {
  let next = text
  for (const rule of rules) {
    if (rule.exact) { if (next === rule.from) next = rule.to; continue }
    if (rule.from !== '' && next.includes(rule.from)) next = next.split(rule.from).join(rule.to)
  }
  return next
}

/** A copy of the value with each rule's text swapped in every string (objects and arrays are copied all the way down; the value handed in is never changed). No rules, nothing changes. */
export function studioUatApplyRules<T>(value: T, rules: readonly StudioUatTextRule[]): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return swapText(node, rules)
    if (Array.isArray(node)) return node.map(walk)
    if (isRecord(node)) return Object.fromEntries(Object.entries(node).map(([key, child]) => [key, walk(child)]))
    return node
  }
  return (rules.length === 0 ? value : walk(value)) as T
}

/** Move the listed lines from the column whose status is `from` to the one whose status is `to` (appended, in the listed order). Columns without those lines are untouched; a missing target column leaves everything as it was. */
export function studioUatMoveLines<C extends { status: string; items: readonly string[] }>(columns: readonly C[], lines: readonly string[], from: string, to: string): C[] {
  const source = columns.find(column => column.status === from)
  const target = columns.find(column => column.status === to)
  if (!source || !target) return [...columns]
  const moving = lines.filter(line => source.items.includes(line))
  return columns.map(column => {
    if (column === source) return { ...column, items: column.items.filter(item => !moving.includes(item)) }
    if (column === target) return { ...column, items: [...column.items, ...moving] }
    return column
  })
}

/**
 * UAT's copy with the LAND-05 ruling applied: the sentences reworded and the About page's two lines moved to "live". Off, the very same object comes back.
 * Reads only the one place it moves lines (pages.about.story.columns); a copy without it is reworded and nothing more.
 */
export function studioUatContent<T>(content: T, landingOn: boolean): T {
  if (landingOn !== true) return content
  const reworded = studioUatApplyRules(content, STUDIO_UAT_LANDING_TEXT_RULES)
  const about = isRecord(reworded) && isRecord(reworded.pages) && isRecord(reworded.pages.about) ? reworded.pages.about : null
  const story = about && isRecord(about.story) ? about.story : null
  if (story && Array.isArray(story.columns)) story.columns = studioUatMoveLines(story.columns as { status: string; items: readonly string[] }[], STUDIO_UAT_LANDING_MOVED_LINES, 'beta', 'live')
  return reworded
}

// ---------------------------------------------------------------- ACC-14: the Knowledge-graph Beta pill on a plan line

/**
 * The plan line the Beta pill sits on. UAT names the line (`betaFeature`) in its own plan copy; with ACC-14 on the lines are the shared plan list's, so the exact text is gone and the line that says
 * "Knowledge graph" in any case carries the pill instead. A plan with no `betaFeature` has no such line.
 */
export function studioUatBetaLine(features: readonly string[], betaFeature: string | null | undefined): string | null {
  if (!betaFeature) return null
  if (features.includes(betaFeature)) return betaFeature
  return features.find(line => /knowledge graph/i.test(line)) ?? null
}

// ---------------------------------------------------------------- LAND-06 behaviours in UAT's phone menu

export type StudioUatMenuEvent = 'toggle' | 'escape' | 'outside' | 'choose' | 'route'

/** Open / closed after an event: the button toggles; Escape, a press outside, choosing a link and a change of page close. Closed stays closed on the closing events. */
export function studioUatMenuNext(open: boolean, event: StudioUatMenuEvent): boolean {
  if (event === 'toggle') return !open
  if (event === 'escape' || event === 'outside' || event === 'choose' || event === 'route') return false
  return open
}

/** Only Escape hands the focus back to the menu button (a press outside, a chosen link or a new page moves it on its own). */
export function studioUatMenuRestoresFocus(event: StudioUatMenuEvent): boolean {
  return event === 'escape'
}

/** The key that closes an open menu. */
export function studioUatMenuKeyEvent(key: string | null | undefined): StudioUatMenuEvent | null {
  return key === 'Escape' ? 'escape' : null
}
