// FRONTEND-2 (PK's phone review, 25 Oct, decision A: PR 1 of 2, "Phone shell 1"). Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL (exact "true", default off, build-time; it also needs NEXT_PUBLIC_STUDIO_V4_SHELL), defined here
// (lib/studio-phone-shell.ts); PR 2 ("Phone shell 2", the Builder top) uses the same flag. On a phone (640 px and narrower) the left icon rail gives way to a bottom tab bar: Studio, Decks, Templates, Themes and More
// (components/layout/studio-phone-tab-bar.tsx, its sheet components/layout/studio-phone-shell.css). The rail, its brand tile and the account header are NOT edited: FRONTEND-1's scripts/test-studio-p2-details.mjs holds
// components/layout/studio-rail.tsx and components/layout/app-header.tsx byte for byte, so the bar is drawn by the two hosts of the rail next to it, and the rail's own markup is restyled from the bar's stylesheet.
// The exact lines this change adds to the two app files that older pins hold to an earlier commit: app/builder/page.tsx and app/(app)/layout.tsx, three each (two imports and the bar). NOTHING IS CHANGED OR
// REMOVED IN A BASE LINE: each added line carries the marker PHONE-SHELL-NAV (a WHOLE token; PR 2's is PHONE-SHELL-TOP), so the strip is one rule: a line with the marker goes (stripPhoneShellNav(rel, text)).
// How the older pins reach it: this change REGISTERS the strip, its files and its .env.example block (scripts/studio-later-changes.mjs, three lines), and stripBulkEditUndo calls the registry first, innermost.
// The older proofs that read the two files raw (PHONE_SHELL_NAV_PIN_EDITS, all FRONTEND-2's own) read them through the registry after a one-line edit each, with the text they had kept here so the proof can put it back.
// scripts/test-studio-phone-shell-nav.mjs proves all of it. Plain node, no imports, nothing read from disk or git here; any other file comes back as it is.

export const BASE_COMMIT = 'fc97f2d5d0e99a12afee15343136f77c36191e26' // studio-v4-dev-preparation-code at #514 (D1), the branch this change is stacked on (it was cut at 15e2d90f, #512; #514 edited the legal proof, which the base files below must include)
export const PHONE_SHELL_NAV_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL'
export const PHONE_SHELL_NAV_COMMIT_SUBJECT = /^Phone shell 1:/
export const PHONE_SHELL_NAV_MARKER = 'PHONE-SHELL-NAV'
/** The marker as a WHOLE token: PHONE-SHELL-NAV is this change's; PHONE-SHELL-TOP (PR 2's) and any other suffix are not. */
export const PHONE_SHELL_NAV_MARKER_RE = /(?<![\w-])PHONE-SHELL-NAV(?![\w-])/
export const PHONE_SHELL_NAV_BUILDER = 'app/builder/page.tsx'
export const PHONE_SHELL_NAV_LAYOUT = 'app/(app)/layout.tsx'

/** The two app files whose existing lines older pins hold to a base commit: only marked lines are added to them. */
export const PHONE_SHELL_NAV_FILES = [PHONE_SHELL_NAV_BUILDER, PHONE_SHELL_NAV_LAYOUT]

/** New files (no base text to put back). */
export const PHONE_SHELL_NAV_NEW_FILES = [
  'lib/studio-phone-shell.ts',
  'components/layout/studio-phone-tab-bar.tsx',
  'components/layout/studio-phone-shell.css',
  'scripts/studio-phone-shell-nav-strip.mjs',
  'scripts/test-studio-phone-shell-nav.mjs',
]

/** The older proofs this change teaches (each failed on this change's lines in the Builder page or the account layout and passed on the base): [text the proof has now, text the base commit's proof has] per edit,
 * whole lines, so putting them back gives the base file byte for byte. Every line the proof has now carries PHONE_SHELL_NAV_PIN_MARK. All FRONTEND-2's own; no FRONTEND-1 test is edited. */
export const PHONE_SHELL_NAV_PIN_MARK = '// LATER-CHANGES: registry read (PHONE-SHELL-NAV)'
export const PHONE_SHELL_NAV_PIN_EDITS = {
  "scripts/test-studio-pass3-polish-e.mjs": [
    ["const read = rel => (rel in overrides ? overrides[rel] : LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripPass3PolishE) + 1).reduce((out, strip) => strip(rel, out), fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (PHONE-SHELL-NAV): the changes registered after this one come out first\n",
     "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"],
  ],
  "scripts/test-studio-pass3-polish-f.mjs": [
    ["const read = rel => (rel in overrides ? overrides[rel] : LATER_STRIPS.slice(LATER_STRIPS.indexOf(stripPass3PolishF) + 1).reduce((out, strip) => strip(rel, out), fs.readFileSync(path.join(root, rel), 'utf8'))) // LATER-CHANGES: registry read (PHONE-SHELL-NAV): the changes registered after this one come out first\n",
     "const read = rel => (rel in overrides ? overrides[rel] : fs.readFileSync(path.join(root, rel), 'utf8'))\n"],
  ],
  "scripts/test-studio-legal-short-links.mjs": [
    ["const GOOD_PROOF_DIFFS = Object.fromEntries(LEGAL_SHORT_LINKS_OLDER_PROOFS.map(rel => [rel, git('diff', '-U0', BASE, git('log', '-1', '--format=%H', '--extended-regexp', '--grep=^Legal short links:', 'HEAD').trim(), '--', rel)])) // LATER-CHANGES: registry read (PHONE-SHELL-NAV): the base against this change's own last commit (a later change may teach those proofs too), a faithful stand-in for the committed diff of those files\n",
     "const GOOD_PROOF_DIFFS = Object.fromEntries(LEGAL_SHORT_LINKS_OLDER_PROOFS.map(rel => [rel, git('diff', '-U0', BASE, '--', rel)])) // the base against the working tree: a faithful stand-in for the committed diff of those files\n"],
  ],
  "scripts/test-studio-thumbnail-last-good.mjs": [
    ["  const added = git('diff', '-U0', BASE, 'HEAD', '--', ...committed.filter(rel => !rel.startsWith('scripts/fixtures/') && (allowed.has(rel) || !LATER_CHANGE_FILES.has(rel) || git('ls-tree', '--name-only', BASE, '--', rel).trim() !== ''))).split('\\n').filter(line => /^\\+(?!\\+\\+)/.test(line)).join('\\n') // LATER-CHANGES: registry read (PHONE-SHELL-NAV): the NEW files of a registered later change are not this change's to answer for (its own proof scans them); the existing files it edits, and this change's own, are still scanned\n",
     "  const added = git('diff', '-U0', BASE, 'HEAD', '--', ...committed.filter(rel => !rel.startsWith('scripts/fixtures/'))).split('\\n').filter(line => /^\\+(?!\\+\\+)/.test(line)).join('\\n')\n"],
  ],
}

/** The proof without this change's edits (the base commit's file). Used by the proof only. */
export function putBackPin(rel, text) {
  return (PHONE_SHELL_NAV_PIN_EDITS[rel] || []).reduce((out, [has, base]) => out.replace(has, () => base), text)
}

/** The older proofs this change teaches. */
export const PHONE_SHELL_NAV_PIN_FILES = Object.keys(PHONE_SHELL_NAV_PIN_EDITS)

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip) and the older proofs it teaches (PHONE_SHELL_NAV_PIN_EDITS). */
export const PHONE_SHELL_NAV_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...PHONE_SHELL_NAV_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PHONE_SHELL_NAV_SCOPE_FILES = new Set([...PHONE_SHELL_NAV_FILES, ...PHONE_SHELL_NAV_NEW_FILES, ...PHONE_SHELL_NAV_OWN_EDITS])

/** The whole .env.example block: its comment and its line (appended at the end of the file). */
export const PHONE_SHELL_NAV_ENV_BLOCK = `# STUDIO PHONE SHELL (FRONTEND-2; PK's phone review, 25 Oct, decisions A and B; two stacked PRs, ONE flag). On for the exact value "true" together with NEXT_PUBLIC_STUDIO_V4_SHELL; default off, and then nothing
# changes: no element is drawn and no rule matches. Build-time value: change it on Vercel and redeploy. Phones only (640 px and narrower) unless said: tablets and desktops keep the rail. PR 1: the left icon rail
# gives way to a bottom tab bar (Studio, Decks, Templates, Themes, More; the current tab in the accent colour, 44 x 48 px targets, above the home indicator's safe area); More is a sheet with Second brain,
# Intelligence, Your details, Help and the account menu; the rail's brand tile (the new logo mark when the new-logo flag is on) stays at the top left of the top bar; pages get bottom padding
# for the bar, and on /builder the bar steps aside while the Director prompt has focus. PR 2: the Builder top is one row (logo, a "..." menu with the deck title, the deck list, New deck, Export, Notes,
# Thumbnails and the slide panel, then Publish) over today's Slides | Director switch, whose Director segment carries a connection dot; the separate "Director / Connected" row and the edge pull tabs go.
# On desktop (PR 2) the Director panel's status line becomes a dot beside "Director", with words only when it is not connected.
NEXT_PUBLIC_STUDIO_PHONE_SHELL="false"
`

/** The file without this change's lines: in the two app files every line that carries the marker (as a whole token) is taken out, every other byte stays; an older proof this change taught gets its base text back
 * (putBackPin). Any other file is returned as it is. */
export function stripPhoneShellNav(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in PHONE_SHELL_NAV_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its base text, so a proof that holds it byte for byte reads it as it was
  if (!PHONE_SHELL_NAV_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !PHONE_SHELL_NAV_MARKER_RE.test(line)).join('\n')
}
