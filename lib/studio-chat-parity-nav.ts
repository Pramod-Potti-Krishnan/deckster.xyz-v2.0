/**
 * FRONTEND-1, overnight chat parity (11 Nov), the NAVIGATION half: "/" commands under a "Go to" group. Stacked on the viewer half (lib/studio-chat-parity-viewer.ts, PR #611).
 * Gated by NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (which already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell). No new flag, no backend, no Director change.
 *
 *   /open <title>      handleSessionSelectWrapped(id), after matching the title against the deck list (hooks/use-chat-sessions.ts loadSessions); up to 5 matches are menu rows
 *   /decks             the Sessions panel's own toggle (setShowChatHistory)        /decks <words>   the matches, as rows (the panel has no outside filter); a pick opens the deck
 *   /duplicate-deck    runDuplicateDeck for the deck on screen (lib/studio-duplicate-deck.ts; the deps are lib/studio-duplicate-deck-deps.ts, the Decks page's own five); NEXT_PUBLIC_STUDIO_DUPLICATE_DECK
 *   /dashboard /themes /templates /intelligence /knowledge /settings /help /shortcuts    router.push to the route the rail and the account menu already link to
 *   /details /billing  router.push to /studio/details and /billing, the same way (the rail's "Your details" and the account menu's "Workspace & billing"; /profile is only a redirect to /settings/profile)
 *   /usage             router.push to /usage, the same way; that route is a 404 unless NEXT_PUBLIC_STUDIO_USAGE_PAGE is on, so the row is disabled ("Usage isn't available yet.") until it is (the page hands this file that one fact)
 *   /about             the existing About dialog (components/studio-about-dialog.tsx)
 *
 * Three rules for the commands that leave this deck (Opus design): while a build runs, or the viewer holds unsaved edits, a page opens in a NEW TAB (the build keeps going, the edits stay) and the note says
 * so; /open never discards unsaved edits (it is disabled until they are saved or discarded); /duplicate-deck never switches to the copy (the note offers /open <new title>). Every command ends in one short note
 * of what it SAW; an unknown or empty word is a hint row and the menu stays open. With nothing typed the group shows its four most used rows and "More..."; typing searches all of them (/details, /usage and /billing sit behind "More...").
 *
 * The rows are plain data that lib/studio-chat-parity-viewer.ts hands back from parityRows (they sit in the same menu, the same index, the same ARIA ids as the viewer's). The page hands this file its handles
 * through the composer hook (setNavLive, while rendering, the way the viewer sets its own handle); every browser call is one of those handles. Nothing here touches the DOM, the router or the network.
 */
import type { ParityEnv, ParityResult, ParityRow, ParityTrigger, ViewerState } from '@/lib/studio-chat-parity-viewer'

// ---- the commands ---------------------------------------------------------------------------------------------------------------------------

export type NavPageName = 'dashboard' | 'themes' | 'templates' | 'intelligence' | 'knowledge' | 'settings' | 'details' | 'usage' | 'billing' | 'help' | 'shortcuts'
export type NavRun =
  | { name: 'open'; deck: { id: string; title: string } }
  | { name: 'decks' }
  | { name: 'duplicate-deck' }
  | { name: NavPageName }
  | { name: 'about' }
  /** The "More..." row only fills "/more " (it never runs). */
  | { name: 'more' }
export type NavName = NavRun['name']

interface NavDef {
  name: Exclude<NavName, 'more'>
  blurb: string
  /** Takes words after its name: picking it fills "/name " so the choices show. */
  takes: boolean
  /** How the row reads when it is not just "/name". */
  label?: string
  /** One of the four rows shown with nothing typed. */
  common?: boolean
}

/** The group's order. The four `common` rows are what the menu shows with nothing typed; "More..." shows the rest. */
export const NAV_COMMANDS: readonly NavDef[] = Object.freeze([
  { name: 'open', blurb: 'Open one of your decks by name', takes: true, label: '/open <title>', common: true },
  { name: 'decks', blurb: 'Open or close the deck list', takes: false, common: true },
  { name: 'duplicate-deck', blurb: 'Copy this deck (the copy stays closed)', takes: false },
  { name: 'dashboard', blurb: 'Open the Decks page', takes: false, common: true },
  { name: 'themes', blurb: 'Open Themes and brand', takes: false },
  { name: 'templates', blurb: 'Open Templates', takes: false },
  { name: 'intelligence', blurb: 'Open Intelligence', takes: false },
  { name: 'knowledge', blurb: 'Open Knowledge', takes: false },
  { name: 'settings', blurb: 'Open Settings', takes: false, common: true },
  { name: 'details', blurb: 'Open Your details', takes: false },
  { name: 'usage', blurb: 'Open Usage', takes: false },
  { name: 'billing', blurb: 'Open Billing and plan', takes: false },
  { name: 'help', blurb: 'Open Help', takes: false },
  { name: 'shortcuts', blurb: 'See the keyboard shortcuts', takes: false },
  { name: 'about', blurb: 'About Deckster Studio', takes: false },
] as NavDef[])

/** The routes the rail and the account menu already link to (the proof checks each exists), and the words each is called in a note. */
export const NAV_PAGES: Readonly<Record<NavPageName, { path: string; label: string }>> = Object.freeze({
  dashboard: { path: '/dashboard', label: 'Decks' },
  themes: { path: '/studio/themes', label: 'Themes' },
  templates: { path: '/studio/templates', label: 'Templates' },
  intelligence: { path: '/studio/intelligence', label: 'Intelligence' },
  knowledge: { path: '/knowledge', label: 'Knowledge' },
  settings: { path: '/settings', label: 'Settings' },
  details: { path: '/studio/details', label: 'Your details' },
  usage: { path: '/usage', label: 'Usage' },
  billing: { path: '/billing', label: 'Billing' },
  help: { path: '/help', label: 'Help' },
  shortcuts: { path: '/shortcuts', label: 'Shortcuts' },
})

/** The real handler or route behind each command (the proof reads these names from the page and the sources). */
export const NAV_HANDLERS: Readonly<Record<string, string>> = Object.freeze({
  open: 'handleSessionSelectWrapped',
  decks: 'setShowChatHistory',
  'duplicate-deck': 'runDuplicateDeck',
  dashboard: "router.push('/dashboard')",
  themes: "router.push('/studio/themes')",
  templates: "router.push('/studio/templates')",
  intelligence: "router.push('/studio/intelligence')",
  knowledge: "router.push('/knowledge')",
  settings: "router.push('/settings')",
  details: "router.push('/studio/details')",
  usage: "router.push('/usage')",
  billing: "router.push('/billing')",
  help: "router.push('/help')",
  shortcuts: "router.push('/shortcuts')",
  about: 'StudioAboutDialog',
})

const NAV_NAMES: ReadonlySet<string> = new Set([...NAV_COMMANDS.map(def => def.name as string), 'more'])
export const isNavName = (name: string): boolean => NAV_NAMES.has(name)
export const isNavRun = (run: { name: string }): run is NavRun => NAV_NAMES.has(run.name)

/** How many deck rows /open and /decks <words> show. */
export const NAV_DECK_ROWS = Object.freeze({ open: 5, decks: 8 })

// ---- the words (one place) ------------------------------------------------------------------------------------------------------------------

export const NAV_WORDS = Object.freeze({
  dirty: 'Save or discard your edits first.',
  noPage: "That isn't available right now.",
  loadingDecks: 'Looking up your decks…',
  decksFailed: "Couldn't load your decks. Try again.",
  noDecks: 'You have no decks yet.',
  noDeckMatch: (typed: string) => `No deck matches "${typed}".`,
  alreadyOpen: 'This deck is already open.',
  noCopy: "Copying a deck isn't switched on here.",
  noUsage: "Usage isn't available yet.",
  copyEdits: 'Save your edits first so the copy has them.',
  copying: 'Already copying a deck.',
  nothingAfter: (name: string) => `Nothing goes after /${name}.`,
  more: 'Show every Go to command',
  newTabBuild: 'so your build keeps going',
  newTabEdits: 'so your edits stay here',
})

// ---- what the page hands over ---------------------------------------------------------------------------------------------------------------

export interface NavDeck { id: string; title: string; slides: number | null; when: string | null }
export interface NavDecks { status: 'idle' | 'loading' | 'ready' | 'failed'; items: NavDeck[] }
export const NO_DECKS: NavDecks = Object.freeze({ status: 'idle', items: [] }) as NavDecks

/** One row of GET /api/sessions, the part this file reads. */
export interface NavSessionRow { id: string; title?: string | null; slideCount?: number | null; lastMessageAt?: string | null; updatedAt?: string | null; createdAt?: string | null }

export type NavDuplicateOutcome = { ok: true; title: string } | { ok: false; message: string }

/** The part of the Builder page this feature may use (app/builder/page.tsx hands it to the composer as chatCommandsPage.nav). Plain values and the handlers the buttons call. */
export interface ChatParityNavPage {
  /** The saved deck on screen (its session id), null with none. */
  sessionId: string | null
  /** The Sessions panel is open. */
  decksOpen: boolean
  /** handleSessionSelectWrapped: the Sessions panel's own pick. */
  openDeck: (id: string) => void
  /** The Sessions panel's own toggle. */
  toggleDecks: () => void
  /** router.push. */
  go: (path: string) => void
  /** window.open(path, '_blank', 'noopener'). */
  openTab: (path: string) => void
  /** loadSessions({ limit: 50, status: 'active' }): what the Sessions panel lists. */
  loadSessions: () => Promise<{ sessions: NavSessionRow[] } | null>
  /** null with NEXT_PUBLIC_STUDIO_DUPLICATE_DECK off; else runDuplicateDeck for the deck on screen, answered as a title or a message. */
  duplicate: { run: () => Promise<NavDuplicateOutcome> } | null
  /** NEXT_PUBLIC_STUDIO_USAGE_PAGE is on: the /usage route exists (with it off the route is a 404, so /usage is disabled). */
  usage: boolean
}

/** The sessions as deck rows (the title the Sessions panel shows, else "Untitled"). */
export function decksFromSessions(sessions: readonly NavSessionRow[]): NavDeck[] {
  return sessions.filter(item => item && typeof item.id === 'string' && item.id).map(item => ({
    id: item.id,
    title: (typeof item.title === 'string' && item.title.trim()) || 'Untitled',
    slides: typeof item.slideCount === 'number' && item.slideCount > 0 ? item.slideCount : null,
    when: item.lastMessageAt || item.updatedAt || item.createdAt || null,
  }))
}

export interface NavHelpers {
  /** lib/studio-chat-parity-viewer.ts looseScore: how well a typed word names a title. */
  score: (query: string, text: string) => number
  /** The viewer half's own words, so a reason reads the same in both halves. */
  words: { noDeck: string; building: string }
}

// ---- the bus: the latest handles, set by the composer while it renders -------------------------------------------------------------------------

let live: { page: ChatParityNavPage | null; decks: NavDecks } = { page: null, decks: NO_DECKS }

/** The composer hook calls this on every render: the page's handles (null with the flag off) and the deck list it holds. */
export function setNavLive(page: ChatParityNavPage | null, decks: NavDecks): void { live = { page, decks } }
export const navLive = () => live

/** Raised after a copy is made, so the next /open or /decks reads the deck list again (the copy is in it). */
let decksEpochNow = 0
export const decksEpoch = (): number => decksEpochNow

// the About dialog's open state (a component in the composer renders the existing dialog from it)
let aboutOpen = false
const aboutListeners = new Set<() => void>()
export const aboutSnapshot = (): boolean => aboutOpen
export const subscribeAbout = (listener: () => void): (() => void) => { aboutListeners.add(listener); return () => { aboutListeners.delete(listener) } }
export function setAboutOpen(open: boolean): void {
  if (aboutOpen === open) return
  aboutOpen = open
  for (const listener of Array.from(aboutListeners)) listener()
}

/** A "/open" or "/decks" trigger: the composer reads the deck list once for it. */
export function navWantsDecks(trigger: { kind: string; name?: string } | null): boolean {
  if (!trigger || trigger.kind !== 'command') return false
  const name = (trigger.name || '').toLowerCase()
  return name === 'open' || name === 'decks'
}

// ---- when a command cannot run (one place: the rows and the run both ask it) --------------------------------------------------------------------

/** The viewer has edits that are not saved (a save is still going, or the last one failed): leaving this page or deck would lose them. */
export const viewerDirty = (viewer: ViewerState | null): boolean => Boolean(viewer && viewer.save !== 'saved')

/** What a page opens in a new tab for: a build is running, or unsaved edits are on screen. */
export function awayReason(building: boolean, viewer: ViewerState | null): 'build' | 'edits' | null {
  if (building || Boolean(viewer?.building)) return 'build'
  return viewerDirty(viewer) ? 'edits' : null
}

const newTabWhy = (why: 'build' | 'edits') => (why === 'build' ? NAV_WORDS.newTabBuild : NAV_WORDS.newTabEdits)

/** Why `name` cannot run now, else null. `words` are the viewer half's (no deck, build running). */
export function navBlocked(name: NavName, state: { building: boolean; viewer: ViewerState | null; page: ChatParityNavPage | null }, words: NavHelpers['words']): string | null {
  const { page, viewer } = state
  if (!page) return NAV_WORDS.noPage
  switch (name) {
    case 'open': return viewerDirty(viewer) ? NAV_WORDS.dirty : null
    case 'duplicate-deck':
      if (!page.duplicate) return NAV_WORDS.noCopy
      if (!viewer || !page.sessionId) return words.noDeck
      if (state.building || viewer.building) return words.building
      return viewerDirty(viewer) ? NAV_WORDS.copyEdits : null
    case 'usage': return page.usage ? null : NAV_WORDS.noUsage
    default: return null
  }
}

// ---- the rows ---------------------------------------------------------------------------------------------------------------------------------

const clip = (text: string, max: number): string => { const flat = text.replace(/\s+/g, ' ').trim(); return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat }

/** A title cut to `max` characters in the MIDDLE, so its end survives ("Q3 product review…map (copy)"): a deck and its copy differ at the end, and a row that cut the end could not tell them apart. */
export function clipMiddle(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const head = Math.ceil((max - 1) * 0.6), tail = max - 1 - head
  return `${flat.slice(0, head).trimEnd()}…${flat.slice(flat.length - tail).trimStart()}`
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", "3 wk ago", else the date. */
export function ago(when: string | null, now: number): string | null {
  const time = when ? Date.parse(when) : NaN
  if (!Number.isFinite(time)) return null
  const mins = Math.max(0, Math.floor((now - time) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days} day${days === 1 ? '' : 's'} ago`
  if (days < 60) return `${Math.floor(days / 7)} wk ago`
  return new Date(time).toISOString().slice(0, 10)
}

/** The decks a typed word names, best first (the list's own order breaks a tie; every deck for an empty word). */
export function matchDecks(items: readonly NavDeck[], query: string, score: NavHelpers['score'], limit: number): NavDeck[] {
  const word = query.trim()
  return items.map((deck, order) => ({ deck, order, score: word ? score(word, deck.title) : 1 })).filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order).slice(0, limit).map(entry => entry.deck)
}

const defOf = (name: string): NavDef | undefined => NAV_COMMANDS.find(def => def.name === name)

function rowOf(name: NavName, label: string, blurb: string, run: NavRun | null, extra: Partial<ParityRow> = {}): ParityRow {
  return { key: label, command: name, group: 'Go to', label, blurb, disabled: null, hint: null, fill: false, run, ...extra }
}

const problem = (name: NavName, label: string, text: string): ParityRow => rowOf(name, label, '', null, { hint: text })

/** The row of a command that needs no word (or the "fill" row of one that does). */
function firstLevel(def: NavDef, env: ParityEnv, page: ChatParityNavPage, helpers: NavHelpers): ParityRow {
  const label = def.label ?? `/${def.name}`
  const away = awayReason(env.building, env.viewer)
  const disabled = navBlocked(def.name, { building: env.building, viewer: env.viewer, page }, helpers.words)
  const blurb = away && def.name in NAV_PAGES ? `${def.blurb} in a new tab` : def.blurb
  return rowOf(def.name, label, blurb, def.takes ? null : { name: def.name } as NavRun, { fill: def.takes, disabled })
}

const moreRow = (): ParityRow => rowOf('more', 'More…', NAV_WORDS.more, null, { fill: true })

function deckRows(name: 'open' | 'decks', arg: string, env: ParityEnv, page: ChatParityNavPage, helpers: NavHelpers): ParityRow[] {
  const label = `/${name} ${clip(arg, 28)}`.trimEnd()
  const bare = `/${name}` // a row that only says why it cannot run keeps its label short, so the reason fits the menu's width
  const dirty = viewerDirty(env.viewer)
  if (dirty) return [{ ...rowOf(name, bare, '', null), disabled: NAV_WORDS.dirty }]
  const { status, items } = live.decks
  if (status === 'idle' || status === 'loading') return [{ ...rowOf(name, bare, '', null), disabled: NAV_WORDS.loadingDecks }]
  if (status === 'failed') return [problem(name, label, NAV_WORDS.decksFailed)]
  if (!items.length) return [problem(name, label, NAV_WORDS.noDecks)]
  const hits = matchDecks(items, arg, helpers.score, NAV_DECK_ROWS[name])
  if (!hits.length) return [problem(name, label, NAV_WORDS.noDeckMatch(arg))]
  const building = env.building || Boolean(env.viewer?.building)
  const now = Date.now()
  return hits.map(deck => {
    const blurb = [building ? 'Opens in a new tab' : null, deck.slides ? `${deck.slides} slide${deck.slides === 1 ? '' : 's'}` : null, ago(deck.when, now)].filter(Boolean).join(' · ')
    return rowOf(name, `/${name} ${clipMiddle(deck.title, 28)}`, blurb, { name: 'open', deck: { id: deck.id, title: deck.title } }, { key: `${name}:${deck.id}`, disabled: deck.id === page.sessionId ? NAV_WORDS.alreadyOpen : null })
  })
}

/**
 * The "Go to" rows for a "/" trigger. Nothing typed: the four most used rows and "More...". "/more": all of them. A name: every command whose name starts with it, then those that contain it. A word after
 * /open or /decks: the decks it names (or why none); after any other name, a hint (a typed word never runs a command). With no page handles (the flag off, no Builder page) there are no rows.
 */
export function navRows(trigger: ParityTrigger, env: ParityEnv, helpers: NavHelpers): ParityRow[] {
  const page = live.page
  if (!page) return []
  const name = trigger.name.toLowerCase()
  const all = () => NAV_COMMANDS.map(def => firstLevel(def, env, page, helpers))
  if (name === 'more') return all()
  if (trigger.arg === null) {
    if (name === '') return [...NAV_COMMANDS.filter(def => def.common).map(def => firstLevel(def, env, page, helpers)), moreRow()]
    const starts = NAV_COMMANDS.filter(def => def.name.startsWith(name))
    const contains = NAV_COMMANDS.filter(def => !def.name.startsWith(name) && def.name.includes(name))
    return [...starts, ...contains].map(def => firstLevel(def, env, page, helpers))
  }
  const def = defOf(name)
  if (!def) return []
  const arg = trigger.arg.trim()
  if (def.name === 'open' || (def.name === 'decks' && arg)) return deckRows(def.name, arg, env, page, helpers)
  return arg ? [problem(def.name, `/${def.name}`, NAV_WORDS.nothingAfter(def.name))] : [firstLevel(def, env, page, helpers)]
}

// ---- running a command ------------------------------------------------------------------------------------------------------------------------

const done = (note: string): ParityResult => ({ ok: true, note })
const failed = (note: string): ParityResult => ({ ok: false, note })

/** How long a command waits to SEE its effect (ms). */
export const NAV_WAIT = Object.freeze({ open: 6000, decks: 2000 })

export interface NavRunContext {
  /** The composer's own "a build is running". */
  building: boolean
  /** The viewer's latest state (null with no deck on screen). */
  viewer: ViewerState | null
  /** The viewer half's own words. */
  words?: NavHelpers['words']
  scale?: number
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/** Look at the page's handles until `test` holds (false when it never does within `ms`). */
async function settle(test: (page: ChatParityNavPage) => boolean, ms: number): Promise<boolean> {
  const end = Date.now() + ms
  for (;;) {
    const page = live.page
    if (page && test(page)) return true
    if (Date.now() >= end) return false
    await sleep(40)
  }
}

let copying = false

/**
 * Run a Go to command: ask for its block once more (the same words the menu showed), call the real handler, then look at the page and say what happened. Never throws; a command that did not do what
 * it was asked says so (ok: false) and never claims the change. The first call into the page happens before any wait, so a new tab is still opened inside the key press that chose it.
 */
export async function runNav(run: NavRun, context: NavRunContext): Promise<ParityResult> {
  const page = live.page
  const words = context.words ?? { noDeck: 'Open or build a deck first.', building: 'A build is running. Wait for it, or stop it first.' }
  const blocked = navBlocked(run.name, { building: context.building, viewer: context.viewer, page }, words)
  if (blocked || !page) return failed(blocked ?? NAV_WORDS.noPage)
  const wait = (ms: number) => Math.max(1, Math.round(ms * (context.scale ?? 1)))
  const away = awayReason(context.building, context.viewer)
  try {
    switch (run.name) {
      case 'open': {
        const { id } = run.deck
        const title = clip(run.deck.title, 60)
        if (page.sessionId === id) return failed(NAV_WORDS.alreadyOpen)
        if (away) { page.openTab(`/builder?session_id=${encodeURIComponent(id)}`); return done(`Opened “${title}” in a new tab ${newTabWhy(away)}`) }
        page.openDeck(id)
        return (await settle(current => current.sessionId === id, wait(NAV_WAIT.open))) ? done(`Opened “${title}”`) : failed(`Couldn't confirm “${title}” opened. Check the deck list.`)
      }
      case 'decks': {
        const want = !page.decksOpen
        page.toggleDecks()
        return (await settle(current => current.decksOpen === want, wait(NAV_WAIT.decks))) ? done(want ? 'Deck list opened' : 'Deck list closed') : failed("Couldn't show the deck list.")
      }
      case 'duplicate-deck': {
        const copier = page.duplicate
        if (!copier) return failed(NAV_WORDS.noCopy)
        if (copying) return failed(NAV_WORDS.copying)
        copying = true
        try {
          const outcome = await copier.run()
          if (outcome.ok) decksEpochNow += 1
          return outcome.ok ? done(`Copied as “${clip(outcome.title, 60)}”. It stays closed: say /open ${clip(outcome.title, 60)} to switch to it.`) : failed(outcome.message)
        } finally { copying = false }
      }
      case 'about': {
        setAboutOpen(true)
        return aboutSnapshot() ? done('About Deckster Studio is open') : failed("Couldn't open About.")
      }
      case 'more': return failed(NAV_WORDS.noPage)
      default: {
        const target = NAV_PAGES[run.name]
        if (away) { page.openTab(target.path); return done(`Opened ${target.label} in a new tab ${newTabWhy(away)}`) }
        page.go(target.path)
        return done(`Opened ${target.label}`)
      }
    }
  } catch {
    return failed("That didn't work. Nothing was changed that we could confirm.")
  }
}
