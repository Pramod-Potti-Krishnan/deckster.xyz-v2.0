// FRONTEND-1 (overnight chat parity, 11 Nov 2026), the NAVIGATION half, stacked on the viewer half (#611, scripts/studio-chat-parity-viewer-strip.mjs). Flag NEXT_PUBLIC_STUDIO_CHAT_COMMANDS (the string "true", default off, build-time;
// it already needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell): the composer's "/" menu gains a "Go to" group (/open <title>, /decks, /duplicate-deck, /dashboard, /themes, /templates, /intelligence, /knowledge, /settings,
// /details, /usage, /billing, /help, /shortcuts, /about; with nothing typed the group shows /open, /decks, /dashboard, /settings and "More..."). Each calls the handler or route the matching click uses (lib/studio-chat-parity-nav.ts lists them). No new flag,
// no .env.example block, no backend, no Director change. lib/studio-chat-parity-nav.ts decides (the rows, what cannot run and why, the words, the run), lib/studio-duplicate-deck-deps.ts holds the deps object the Decks page builds inline (a copy: the Decks page is
// left exactly as it was, and the proof holds the two to each other member by member), components/builder/chat/studio-chat-parity-nav-decks.ts reads the deck list for /open and /decks, components/builder/chat/studio-chat-parity-nav-about.tsx draws the existing About dialog.
// Every line this change adds to an EXISTING file carries the marker CHAT-PARITY-NAV (matched as a whole token; CHAT-PARITY-VIEWER is the viewer half's). Most are pure insertions. CHAT_PARITY_NAV_EDITS holds [line now, line before] for each
// CHANGED line (whole lines): put those back, then take the marked lines out, and each file is the viewer half's head, byte for byte. Five files are the viewer half's own or touched by it; the strip goes back to ITS head (VIEWER_HEAD).
// /details, /usage and /billing (a follow-up) changed only lines that already carry the marker (the page's one handles line, the menu's icon import and icon map) and files this change owns, so the changed-line pairs below are the same pairs.
// The Decks page is NOT touched. An earlier cut moved its inline deps object into the shared helper (one marked line); two older proofs (test-studio-deck-title, test-studio-deck-grid-4) hold that page with their OWN strips, by the
// exact text of duplicateSession, and failed on it: the move was skipped, and the helper copies the five members instead.
// Registry: stripChatParityNavAfterViewer is what the registry holds. It takes this change's lines out and then runs the viewer half's own strip over the result, so the registry's order (the viewer's strip first, this one after) can never
// leave a viewer line behind where this change edited one, and neither needs the other to have run. Plain node; the only import is the viewer half's strip module. Nothing is read from disk or git here.

import { stripChatParityViewer } from './studio-chat-parity-viewer-strip.mjs'

export const VIEWER_HEAD = '5efe114b09b8a76e33cdda45240830831e24d574' // origin/frontend1/chat-parity-viewer (PR #611) when this change was cut: the strip puts a file back to it
export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // origin/studio-v4-dev-preparation-code (#598 merged): the viewer half's base (the proof compares the files the Decks page and this change both leave alone with it)
export const CHAT_PARITY_NAV_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_COMMANDS'
export const CHAT_PARITY_NAV_MARKER = 'CHAT-PARITY-NAV'
/** The marker as a WHOLE token: CHAT-PARITY-NAV-X and X-CHAT-PARITY-NAV are not this change's (CHAT-PARITY-VIEWER and CHAT-PARITY are other changes'). */
export const CHAT_PARITY_NAV_MARKER_RE = /(?<![\w-])CHAT-PARITY-NAV(?![\w-])/
/** The subject prefix of this change's own commits (the proof reads these; chat parity's own proof must not take them for its commit). */
export const CHAT_PARITY_NAV_SUBJECT = 'Chat parity nav:'

/** Existing files that get marked lines (all three the viewer half touched too: put back to VIEWER_HEAD). The Decks page is NOT among them: see the head of this file. */
export const CHAT_PARITY_NAV_FILES = [
  "app/builder/page.tsx",
  "components/builder/chat/studio-chat-commands.tsx",
  "lib/studio-chat-commands.ts",
]
/** The viewer half's NEW files this change edits (put back to VIEWER_HEAD; they have no base). */
export const CHAT_PARITY_NAV_VIEWER_NEW_EDITED = [
  "lib/studio-chat-parity-viewer.ts",
  "components/builder/chat/studio-chat-parity-viewer-menu.tsx",
]

/** The changed lines: [line now, line before] per edit, whole lines (a line now carries the marker and occurs once in its file; the line before is the viewer half's head's). */
export const CHAT_PARITY_NAV_EDITS = {
  "components/builder/chat/studio-chat-commands.tsx": [
    ["    menu: <>{menu}<ChatNavAbout /></>, // CHAT-PARITY-NAV: the menu, and the existing About dialog /about opens (closed, it draws nothing)",
     "    menu,"]
  ],
  "lib/studio-chat-parity-viewer.ts": [
    ["export type ParityRun = ViewerRun | { name: 'theme'; preset: { id: string; name: string } } | { name: 'canvas' } | NavRun // CHAT-PARITY-NAV",
     "export type ParityRun = ViewerRun | { name: 'theme'; preset: { id: string; name: string } } | { name: 'canvas' }"],
    ["export type ParityGroup = 'Slides' | 'View' | 'Deck' | 'Go to' // CHAT-PARITY-NAV",
     "export type ParityGroup = 'Slides' | 'View' | 'Deck'"],
    ["export const PARITY_GROUPS: readonly ParityGroup[] = Object.freeze(['Slides', 'View', 'Deck', 'Go to'] as ParityGroup[]) // CHAT-PARITY-NAV",
     "export const PARITY_GROUPS: readonly ParityGroup[] = Object.freeze(['Slides', 'View', 'Deck'] as ParityGroup[])"],
    ["    return [...[...starts, ...contains].map(def => firstLevel(def, env)).sort((a, b) => groupRank(a.group) - groupRank(b.group)), ...navRows(trigger, env, NAV_HELPERS)] // CHAT-PARITY-NAV: the Go to group, after the viewer's three",
     "    return [...starts, ...contains].map(def => firstLevel(def, env)).sort((a, b) => groupRank(a.group) - groupRank(b.group))"]
  ]
}

/** New files (no base text to put back). */
export const CHAT_PARITY_NAV_NEW_FILES = [
  "lib/studio-chat-parity-nav.ts",
  "lib/studio-duplicate-deck-deps.ts",
  "components/builder/chat/studio-chat-parity-nav-decks.ts",
  "components/builder/chat/studio-chat-parity-nav-about.tsx",
  "scripts/studio-chat-parity-nav-strip.mjs",
  "scripts/test-studio-chat-parity-nav.mjs",
]

/** The older proofs this change teaches: [line now, line before] per edit, whole lines (a line now carries "registry read (CHAT-PARITY-NAV)" and occurs once in its file; a line before of "" is an inserted line). */
export const CHAT_PARITY_NAV_PIN_EDITS = {
  "scripts/test-studio-chat-parity-viewer.mjs": [
    ["import { stripChatParityNav, CHAT_PARITY_NAV_READ_FILES } from './studio-chat-parity-nav-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-NAV): the navigation slash commands (stacked after this change) add lines to files this proof reads and edit three of this change's own; it reads them as this change had them\n",
     ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_NAV_READ_FILES.includes(rel) ? stripChatParityNav(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-NAV): every read of a file that change touched (the module loader's too) is the file as this change left it\n",
     ""],
    ["const addedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, ...(OWN[0] ? [OWN[0]] : []), '--', rel).split('\\n').filter(line => /^\\+(?!\\+\\+)/.test(line)).map(line => line.slice(1)) // LATER-CHANGES: registry read (CHAT-PARITY-NAV): this change's lines are the diff to ITS newest commit (a later change's lines in the tree are not this change's)",
     "const addedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, '--', rel).split('\\n').filter(line => /^\\+(?!\\+\\+)/.test(line)).map(line => line.slice(1))"],
    ["const removedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, ...(OWN[0] ? [OWN[0]] : []), '--', rel).split('\\n').filter(line => /^-(?!--)/.test(line)).map(line => line.slice(1)) // LATER-CHANGES: registry read (CHAT-PARITY-NAV): this change's lines are the diff to ITS newest commit (a later change's lines in the tree are not this change's)",
     "const removedLines = (rel, from = strip.BASE_COMMIT) => git('diff', '--no-color', '-U0', from, '--', rel).split('\\n').filter(line => /^-(?!--)/.test(line)).map(line => line.slice(1))"],
    ["  ok(registry.LATER_STRIPS.includes(strip.stripChatParityViewer), 'registry: the strip is registered') // LATER-CHANGES: registry read (CHAT-PARITY-NAV): later changes' strips follow it",
     "  ok(registry.LATER_STRIPS.includes(strip.stripChatParityViewer) && registry.LATER_STRIPS[registry.LATER_STRIPS.length - 1] === strip.stripChatParityViewer, 'registry: the strip is registered, last')"]
  ],
  "scripts/test-studio-chat-commands.mjs": [
    ["import { stripChatParityNav, CHAT_PARITY_NAV_READ_FILES } from './studio-chat-parity-nav-strip.mjs' // LATER-CHANGES: registry read (CHAT-PARITY-NAV): the navigation slash commands (stacked after the viewer's) add rows and lines to files this proof reads; it reads them as chat commands had them\n",
     ""],
    ["{ const realRead = fs.readFileSync; fs.readFileSync = function (file, ...rest) { const out = realRead.call(this, file, ...rest); const rel = typeof file === 'string' ? path.relative(root, file) : ''; return typeof out === 'string' && CHAT_PARITY_NAV_READ_FILES.includes(rel) ? stripChatParityNav(rel, out) : out } } // LATER-CHANGES: registry read (CHAT-PARITY-NAV): every read of a file that change touched (the module loader's too) has its lines taken out first, on top of the viewer's put-back above\n",
     ""]
  ],
  "scripts/test-studio-chat-parity.mjs": [
    ["const OWN = (() => { try { return git('log', '--format=%H%x09%s', '-E', '--grep=^Chat parity', 'HEAD').split('\\n').filter(Boolean).map(line => line.split('\\t')).find(([, subject]) => !subject.startsWith('Chat parity viewer:') && !subject.startsWith('Chat parity nav:'))?.[0] || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (commits \"Chat parity viewer: ...\") are a later change's, not this one's // LATER-CHANGES: registry read (CHAT-PARITY-NAV): so are the navigation slash commands' (commits \"Chat parity nav: ...\")",
     "const OWN = (() => { try { return git('log', '--format=%H%x09%s', '-E', '--grep=^Chat parity', 'HEAD').split('\\n').filter(Boolean).map(line => line.split('\\t')).find(([, subject]) => !subject.startsWith('Chat parity viewer:'))?.[0] || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way) // LATER-CHANGES: registry read (CHAT-PARITY-VIEWER): the viewer's slash commands (commits \"Chat parity viewer: ...\") are a later change's, not this one's"]
  ]
}
export const CHAT_PARITY_NAV_PIN_FILES = Object.keys(CHAT_PARITY_NAV_PIN_EDITS)
/** Files this change edits that are neither marked app code nor new: the registry (two lines) and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-chat-parity-nav.mjs`. */
export const CHAT_PARITY_NAV_OWN_EDITS = ['scripts/studio-later-changes.mjs', ...CHAT_PARITY_NAV_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_PARITY_NAV_SCOPE_FILES = new Set([...CHAT_PARITY_NAV_FILES, ...CHAT_PARITY_NAV_VIEWER_NEW_EDITED, ...CHAT_PARITY_NAV_NEW_FILES, ...CHAT_PARITY_NAV_OWN_EDITS])

/** The files an older proof reads through this strip (its marked lines come out): the existing files, the viewer half's new files it edits, and the registry. */
export const CHAT_PARITY_NAV_READ_FILES = [...CHAT_PARITY_NAV_FILES, ...CHAT_PARITY_NAV_VIEWER_NEW_EDITED, 'scripts/studio-later-changes.mjs']

/** The registry text carries this change's two lines; they name this module. */
export const CHAT_PARITY_NAV_REGISTRY_MARK = "./studio-chat-parity-nav-strip.mjs')"

/** An older proof without this change's edits (the viewer half's previous file). */
export function putBackChatParityNavEdits(rel, text) {
  return (CHAT_PARITY_NAV_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/**
 * The file without this change's lines, as the viewer half had it (its head): the changed lines go back to what they were, then every line that carries the marker (as a whole token) is taken out; every other byte stays. The registry
 * loses its two lines; a taught proof gets its previous lines back. Any other file is returned as it is.
 */
export function stripChatParityNav(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') return text.split('\n').filter(line => !line.includes(CHAT_PARITY_NAV_REGISTRY_MARK)).join('\n')
  if (rel in CHAT_PARITY_NAV_PIN_EDITS) return putBackChatParityNavEdits(rel, text)
  if (!CHAT_PARITY_NAV_FILES.includes(rel) && !CHAT_PARITY_NAV_VIEWER_NEW_EDITED.includes(rel)) return text
  const swapped = (CHAT_PARITY_NAV_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
  return swapped.split('\n').filter(line => !CHAT_PARITY_NAV_MARKER_RE.test(line)).join('\n')
}

/** What the registry holds: this change's strip, then the viewer half's over the result (see the head of this file). A file neither owns comes back as it was. */
export function stripChatParityNavAfterViewer(rel, text) {
  return stripChatParityViewer(rel, stripChatParityNav(rel, text))
}
