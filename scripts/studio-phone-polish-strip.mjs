// FRONTEND-2 (B59; FRONTEND-1's pre-promotion UX pass of 4 Nov, finding UX-21, and F-13's two known limits in REAL-PHONE-CHECK.md). Flag NEXT_PUBLIC_STUDIO_PHONE_POLISH (exact "true", build-time, default off), defined here
// (lib/studio-phone-polish.ts) and only active together with the phone shell (NEXT_PUBLIC_STUDIO_PHONE_SHELL) and so with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL); the landscape fix also needs NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE.
// Three small phone fixes: the "Account menu" hint no longer floats over the Help row when the More sheet opens (UX-21); Escape closes the More sheet at once (it closed the hint first: ONE root cause, the sheet's initial focus lands on the avatar,
// whose Radix Tooltip opens on focus and is then the topmost Escape layer); in a phone turned sideways the hamburger and the plus sit clear of the slide's page number.
// Every line this change adds to an EXISTING app file is a pure insertion that carries the marker PHONE-POLISH (a WHOLE token), with ONE exception: the More sheet's Dialog.Content tag is one line and takes one more attribute (a spread), so that line is rewritten
// and PHONE_POLISH_LINE_EDITS (an idempotent pin table, [the line now, the base commit's line]) puts it back first. Strip the marked lines and put that one back, and each file is its base, byte for byte (stripPhonePolish(rel, text)).
// The older proofs this change teaches (PIN_EDITS, tests only, every line carries the registry-read mark): the two that read the first-parent line of BASE..HEAD for their own commits' subjects (one more inserted line each, for "Phone polish:", as the phone hints did).
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // studio-v4-dev-preparation-code at #564 (Template match P4-7c proof), the branch this change is made on
export const PHONE_POLISH_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_POLISH'
export const PHONE_POLISH_MARKER = 'PHONE-POLISH'
/** The marker as a WHOLE token: PHONE-POLISH is this change's; PHONE-POLISH-X and X-PHONE-POLISH are not. */
export const PHONE_POLISH_MARKER_RE = /(?<![\w-])PHONE-POLISH(?![\w-])/
/** The subject prefix of this change's own commits. */
export const PHONE_POLISH_SUBJECT = 'Phone polish:'

/** Existing app files that get marked lines. */
export const PHONE_POLISH_FILES = ['components/layout/studio-phone-tab-bar.tsx', 'components/builder/studio-phone-landscape.tsx']

/** New files (no base text to put back). */
export const PHONE_POLISH_NEW_FILES = [
  'lib/studio-phone-polish.ts',
  'components/layout/studio-phone-polish.css',
  'scripts/studio-phone-polish-strip.mjs',
  'scripts/test-studio-phone-polish.mjs',
]

/** The one app line this change rewrites: [the line now, the base commit's line], whole lines without the newline, so putting it back gives the base file byte for byte. Idempotent: a file that has the base line comes back as it is. */
export const PHONE_POLISH_LINE_EDITS = {
  'components/layout/studio-phone-tab-bar.tsx': [
    ['<Dialog.Content data-studio-v4-shell="true" data-studio-phone-more="true" aria-describedby={undefined} {...STUDIO_PHONE_MORE_PROPS /* PHONE-POLISH */}>',
     '<Dialog.Content data-studio-v4-shell="true" data-studio-phone-more="true" aria-describedby={undefined}>'],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line the proof has now carries PHONE_POLISH_PIN_MARK. */
export const PHONE_POLISH_PIN_MARK = 'LATER-CHANGES: registry read (PHONE-POLISH)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Phone polish:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PHONE-POLISH): on a branch stacked after this change (the phone polish's), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const PHONE_POLISH_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[FIRST_PARENT_LINE, '']],
}

/** The proof without this change's edits (the base commit's file). Idempotent: a proof that has none of the edits comes back as it is. */
export function putBackPin(rel, text) {
  return (PHONE_POLISH_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** An app file with its one rewritten line put back (idempotent). */
export function putBackLine(rel, text) {
  return (PHONE_POLISH_LINE_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const PHONE_POLISH_PIN_FILES = Object.keys(PHONE_POLISH_PIN_EDITS)

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip) and the older proofs it teaches (PHONE_POLISH_PIN_EDITS). */
export const PHONE_POLISH_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...PHONE_POLISH_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PHONE_POLISH_SCOPE_FILES = new Set([...PHONE_POLISH_FILES, ...PHONE_POLISH_NEW_FILES, ...PHONE_POLISH_OWN_EDITS])

/** The whole .env.example block: its comments and its line (appended at the end of the file, after one blank line). */
export const PHONE_POLISH_ENV_BLOCK = `# STUDIO PHONE POLISH (FRONTEND-2; B59; FRONTEND-1's pre-promotion UX pass of 4 Nov, finding UX-21, and F-13's two known limits). On for the exact value "true" AND only together with NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL (both exact "true"); the landscape fix also needs NEXT_PUBLIC_STUDIO_PHONE_LANDSCAPE. Default off, and then
# nothing changes: no attribute is set and no rule matches. Build-time value: change it on Vercel and redeploy. On: (1) the phone More sheet takes the focus itself when it opens, so the "Account menu" hint no longer floats over the Help row; (2) Escape closes the sheet at once (it used to close that hint first and the sheet only on a second press);
# (3) in a phone turned sideways the two floating buttons (hamburger and plus) sit 34 px higher, clear of the slide's page number. Tablets and desktops are unchanged.
NEXT_PUBLIC_STUDIO_PHONE_POLISH="false"
`

/** The file without this change's lines: in the two app files the one rewritten line is put back and then every line that carries the marker (as a whole token) is taken out, every other byte stays; an older proof this change taught gets its base text back (putBackPin). Any other file is returned as it is. */
export function stripPhonePolish(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in PHONE_POLISH_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its base text, so a proof that holds it byte for byte reads it as it was
  if (!PHONE_POLISH_FILES.includes(rel)) return text
  return putBackLine(rel, text).split('\n').filter(line => !PHONE_POLISH_MARKER_RE.test(line)).join('\n')
}
