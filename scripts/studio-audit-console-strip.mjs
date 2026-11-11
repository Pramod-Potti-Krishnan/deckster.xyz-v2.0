// FRONTEND-1 (production frontend audit, P-30 analytics script 404, P-32 Completed Presentations naming (P-31 is a backend asset, not in this repo)). Flags NEXT_PUBLIC_STUDIO_ANALYTICS_GATE and NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED and NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST (exact "true", default off, build-time).
// P-30 "Vercel analytics console errors": app/layout.tsx mounts <Analytics /> on a deployment whose Vercel project does not serve Web Analytics, so the script request 404s (lib/studio-analytics-gate.ts has the root cause and the gate).
// P-32 "Completed Presentations naming": the Decks page's first tab is every deck with a built deck, in progress or not, and says "Completed" (lib/studio-deck-tabs-honest.ts has the root cause and the label).
// P-31 (the box/violin plugin 404 on cdn.jsdelivr.net) is NOT here: the reference is in the Layout service's viewer page (backend repo), not in this frontend.
// Every line this change adds to an EXISTING file carries the marker AUDIT-CONSOLE (matched as a whole token). Some base lines are rewritten, so the strip is a list of [has, was] pairs, not a marker filter: putting each pair back gives the file at BASE_COMMIT
// byte for byte (a pair is one hunk of the committed diff: the lines the file has now, the lines it had). The new files have no base text.
// FRONTEND-2's UX findings E (#603) carries the same four-line edit of FRONTEND-1's test-studio-voice-call.mjs (the .env.example "last thing in the file" pin must take out the env blocks registered after voice-call's); this change carries it too, BYTE-IDENTICAL, so every PR merges clean in any order.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // origin/studio-v4-dev-preparation-code (#598 merged) at the start of this change
export const AUDIT_CONSOLE_FLAGS = ["NEXT_PUBLIC_STUDIO_ANALYTICS_GATE","NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED","NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST"]
export const AUDIT_CONSOLE_MARKER = 'AUDIT-CONSOLE'
/** The marker as a WHOLE token: AUDIT-CONSOLE-X and X-AUDIT-CONSOLE are not this change's. */
export const AUDIT_CONSOLE_MARKER_RE = /(?<![\w-])AUDIT-CONSOLE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const AUDIT_CONSOLE_SUBJECT = 'Audit fix:'

/** Existing files that get marked lines. */
export const AUDIT_CONSOLE_FILES = ["app/layout.tsx","app/(app)/dashboard/page.tsx"]

/** New files (no base text to put back). */
export const AUDIT_CONSOLE_NEW_FILES = [
  "lib/studio-analytics-gate.ts",
  "lib/studio-deck-tabs-honest.ts",
  "scripts/studio-audit-console-strip.mjs",
  "scripts/test-studio-audit-console.mjs"
]

/** The new libs that read a flag: [file, flag], each import-free with one literal env read. */
export const AUDIT_CONSOLE_LIB_FLAGS = [["lib/studio-analytics-gate.ts","NEXT_PUBLIC_STUDIO_ANALYTICS_GATE"],["lib/studio-analytics-gate.ts","NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED"],["lib/studio-deck-tabs-honest.ts","NEXT_PUBLIC_STUDIO_DECK_TABS_HONEST"]]

/** [text the file has now, text the file had at BASE_COMMIT] per edit (one per hunk), in the order they sit in the file; putting them back gives the base file byte for byte. */
export const AUDIT_CONSOLE_EDITS = {
  "app/layout.tsx": [
    ["import { Analytics as VercelAnalytics } from '@vercel/analytics/next' // AUDIT-CONSOLE\nimport { STUDIO_ANALYTICS_MOUNTS } from '@/lib/studio-analytics-gate' // AUDIT-CONSOLE\n", "import { Analytics } from '@vercel/analytics/next'\n"],
    ["const Analytics = STUDIO_ANALYTICS_MOUNTS ? VercelAnalytics : () => null // AUDIT-CONSOLE: the gate (lib/studio-analytics-gate.ts); the flag off is the real component, so the Analytics element below is as before\n", ""],
  ],
  "app/(app)/dashboard/page.tsx": [
    ["import { STUDIO_DECK_TABS_HONEST_ENABLED, deckBuiltTabLabel } from \"@/lib/studio-deck-tabs-honest\" // AUDIT-CONSOLE\n", ""],
    ["              {STUDIO_DECK_TABS_HONEST_ENABLED ? deckBuiltTabLabel(true, completedPresentations.length) : <>Completed Presentations ({completedPresentations.length})</>}{/* AUDIT-CONSOLE */}\n", "              Completed Presentations ({completedPresentations.length})\n"],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const AUDIT_CONSOLE_PIN_MARK = "LATER-CHANGES: registry read (AUDIT-CONSOLE)"
export const AUDIT_CONSOLE_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Audit fix:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AUDIT-CONSOLE): on a branch stacked after this change (the audit P-30 / P-32 console fixes), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n", ""],
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Audit fix:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AUDIT-CONSOLE): on a branch stacked after this change (the audit P-30 / P-32 console fixes), the first-parent commits are its own, not this change's; with none left the identity checks cover the files\n", ""],
  ],
  "scripts/test-studio-deck-card-count.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["const read = rel => stripDeckCardThumbnail(rel, stripAuditConsole(rel, fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (AUDIT-CONSOLE); DECK-CARD-THUMBNAIL: its marked lines on the Decks page come out first\n", "const read = rel => stripDeckCardThumbnail(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // DECK-CARD-THUMBNAIL: its marked lines on the Decks page come out first\n"],
  ],
  "scripts/test-studio-create-word.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripAuditConsole(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // LATER-CHANGES: registry read (AUDIT-CONSOLE); DECK-CARD-THUMBNAIL: its lines out first\n", "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // DECK-CARD-THUMBNAIL: its lines out first\n"],
  ],
  "scripts/test-studio-deck-cards-v2.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["const read = file => stripDeckCardThumbnail(file, stripAuditConsole(file, fs.readFileSync(path.join(root, file), 'utf8'))); // LATER-CHANGES: registry read (AUDIT-CONSOLE); DECK-CARD-THUMBNAIL: its marked lines on the Decks page come out first\n", "const read = file => stripDeckCardThumbnail(file, fs.readFileSync(path.join(root, file), 'utf8')); // DECK-CARD-THUMBNAIL: its marked lines on the Decks page come out first\n"],
  ],
  "scripts/test-studio-plain-nav-labels.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, stripAuditConsole(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')))) // LATER-CHANGES: registry read (AUDIT-CONSOLE); DECK-CARD-THUMBNAIL: its lines out first\n", "const read = rel => stripLaunchWording(rel, stripDeckCardThumbnail(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // DECK-CARD-THUMBNAIL: its lines out first\n"],
  ],
  "scripts/test-atlas-decks-pagination.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["const source = stripAuditConsole('app/(app)/dashboard/page.tsx', fs.readFileSync(new URL('../app/(app)/dashboard/page.tsx', import.meta.url), 'utf8')) // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", "const source = fs.readFileSync(new URL('../app/(app)/dashboard/page.tsx', import.meta.url), 'utf8')\n"],
  ],
  "scripts/test-present-view-only.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["const read = path => stripAuditConsole(path, fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')) // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", "const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')\n"],
  ],
  "scripts/test-studio-deck-card-thumbnail-cards.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["const read = rel => stripAuditConsole(rel, fs.readFileSync(path.join(root, rel), 'utf8')) // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", "const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')\n"],
  ],
  "scripts/test-studio-p2-publish.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["    const stripped = stripP2Publish(rel, stripAuditConsole(rel, sources[rel])) // LATER-CHANGES: registry read (AUDIT-CONSOLE): this change's lines (the layout's gated <Analytics />) come out first\n", "    const stripped = stripP2Publish(rel, sources[rel])\n"],
    ["    let text = stripAuditConsole(rel, sources[rel]) // LATER-CHANGES: registry read (AUDIT-CONSOLE): this change's lines come out before the listed changes are put back\n", "    let text = sources[rel]\n"],
  ],
  "scripts/test-studio-deck-card-thumbnail.mjs": [
    ["import { stripAuditConsole } from './studio-audit-console-strip.mjs' // LATER-CHANGES: registry read (AUDIT-CONSOLE)\n", ""],
    ["const pageText = stripAuditConsole(DASHBOARD_PAGE, read(DASHBOARD_PAGE)) // LATER-CHANGES: registry read (AUDIT-CONSOLE): this change's lines come out first\n", "const pageText = read(DASHBOARD_PAGE)\n"],
  ],
}

/**
 * FRONTEND-1's voice-call proof with the four-line after-merge edit FRONTEND-1 OK'd for UX findings E (FE1-OK-REQUEST-2.md section 2, #603 carries the same lines): its .env.example pins read the file raw, so a later change's env block
 * shows up in it. [line now, line before] per edit, whole lines; was = '' for an inserted line. Put back, the proof is the base's.
 */
export const AUDIT_CONSOLE_VOICE_CALL_PIN_MARK = '// LATER-CHANGES: registry read (UX-FINDINGS-E)'
export const AUDIT_CONSOLE_VOICE_CALL_PIN_EDITS = {
  "scripts/test-studio-voice-call.mjs": [
    ["const laterRegistry = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ""],
    ["const laterEnvOut = text => laterRegistry.LATER_ENV_BLOCKS.slice(laterRegistry.LATER_ENV_BLOCKS.indexOf(strip.VOICE_CALL_ENV_BLOCK) + 1).reduce((out, block) => out.replace(`\\n${block}`, ''), text) // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ""],
    ["  ok(laterEnvOut(env).endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "  ok(env.endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line')\n"],
    ["    ok(laterEnvOut(`${envDiff.map(line => line.slice(1)).join('\\n')}\\n`).trimEnd().endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "    ok(envDiff.map(line => line.slice(1)).join('\\n').endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)')\n"],
  ],
}
/** The proof it edits, and the anchor the two inserted lines go right after. */
export const AUDIT_CONSOLE_VOICE_CALL_PIN_FILES = Object.keys(AUDIT_CONSOLE_VOICE_CALL_PIN_EDITS)
export const AUDIT_CONSOLE_VOICE_CALL_PIN_ANCHOR = "const core = await import('./studio-voice-core-strip.mjs')"

/** The older proofs this change teaches. */
export const AUDIT_CONSOLE_PIN_FILES = Object.keys(AUDIT_CONSOLE_PIN_EDITS)

export const AUDIT_CONSOLE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...AUDIT_CONSOLE_PIN_FILES, ...AUDIT_CONSOLE_VOICE_CALL_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const AUDIT_CONSOLE_SCOPE_FILES = new Set([...AUDIT_CONSOLE_FILES, ...AUDIT_CONSOLE_NEW_FILES, ...AUDIT_CONSOLE_OWN_EDITS])

/** The whole .env.example block: its comment and its lines. */
export const AUDIT_CONSOLE_ENV_BLOCK = "# STUDIO ANALYTICS GATE (FRONTEND-1; production frontend audit P-30). Both on for the exact value \"true\"; default off, and then app/layout.tsx mounts <Analytics /> exactly as before. Build-time values: change them on Vercel and redeploy.\n# NEXT_PUBLIC_STUDIO_ANALYTICS_GATE: on, <Analytics /> is rendered only when NEXT_PUBLIC_STUDIO_ANALYTICS_SERVED is also \"true\" (set SERVED on a Vercel project where Web Analytics is enabled). A project that sets the gate and not SERVED (production today, where\n# /_vercel/insights/script.js is a 404) mounts nothing: no script request, no console errors. A project that sets neither keeps today's behaviour.\nNEXT_PUBLIC_STUDIO_ANALYTICS_GATE=\"false\"\nNEXT_PUBLIC_STUDIO_ANALYTICS_SERVED=\"false\"\n\n# STUDIO DECK TABS HONEST (FRONTEND-1; production frontend audit P-32). On for the exact value \"true\"; default off, and then the Decks page's first tab reads \"Completed Presentations (N)\". Build-time value.\n# On, the tab reads \"Built decks (N)\": it holds every session that has a built deck (a deck in progress is in it too), so \"Completed\" was wrong. Which deck sits in which tab, the counts, the filters and the status badges do not change.\nNEXT_PUBLIC_STUDIO_DECK_TABS_HONEST=\"false\"\n"

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackAuditConsole(rel, text) {
  return (AUDIT_CONSOLE_EDITS[rel] || AUDIT_CONSOLE_PIN_EDITS[rel] || AUDIT_CONSOLE_VOICE_CALL_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripAuditConsole(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in AUDIT_CONSOLE_EDITS) && !(rel in AUDIT_CONSOLE_PIN_EDITS) && !(rel in AUDIT_CONSOLE_VOICE_CALL_PIN_EDITS)) return text
  return putBackAuditConsole(rel, text)
}
