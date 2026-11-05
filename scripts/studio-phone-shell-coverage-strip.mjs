// FRONTEND-2 (B58; FRONTEND-1's pre-promotion UX pass of 4 Nov, blockers UX-03 and UX-04: "phone Help and the builder error state show the desktop rail with no tab bar"). Flag NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE (exact "true",
// build-time, default off), defined here (lib/studio-phone-shell-coverage.ts) and only active together with the phone shell (NEXT_PUBLIC_STUDIO_PHONE_SHELL) and so with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL).
// On a phone (640 px and narrower) the two Studio pages that drew the desktop rail without the phone shell's bottom tab bar now draw the bar too, as a DIRECT child of the shell root next to the rail (components/layout/studio-phone-shell.css acts only
// on a root that holds the bar as a direct child): Help (StudioHelpFrame in components/help/studio-help.tsx, only where the rail is drawn, signed in) and the Builder's load-error / not-found / no-access screen (StudioSessionProblemView in
// components/builder/studio-session-hygiene.tsx, only where the rail is drawn, studioShell). The phone shell's own files are NOT edited (lib/studio-phone-shell.ts is pinned; the bar and its stylesheet stay as they are).
// Every line this change adds to an EXISTING app file is a pure insertion that carries the marker PHONE-SHELL-COVERAGE (a WHOLE token): per file two imports (the bar, the flag) and one line of JSX, right after the rail. Strip the marked lines and
// each file is its base, byte for byte (stripPhoneShellCoverage(rel, text)). No existing line is rewritten.
// The older proofs this change teaches (PIN_EDITS, tests only, every line carries the registry-read mark): the two that read the first-parent line of BASE..HEAD for their own commits' subjects (one more inserted line each, for "Phone shell coverage:",
// as the phone hints did) and the phone shell 1 proof, whose family check names every phone-shell file as its own (this change's files have their own list). Two proofs in FRONTEND-1's lane read components/help/studio-help.tsx raw
// (scripts/test-studio-p2-docs.mjs pins it to the base commit; scripts/test-atlas-help-recovery.mjs loads it with a closed list of imports): they are NOT edited here (their owner adds the registry-read lines; the PR body names them).
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'b823b2301ac6bc9c0eba6dd7dc959d90a7ea2f0b' // restacked 5 Nov onto dev b823b230 (#575, #583, #587 in); was 3e1ce88e; // studio-v4-dev-preparation-code at #564 (Template match P4-7c proof), the branch this change is made on
export const PHONE_SHELL_COVERAGE_FLAG = 'NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE'
export const PHONE_SHELL_COVERAGE_MARKER = 'PHONE-SHELL-COVERAGE'
/** The marker as a WHOLE token: PHONE-SHELL-COVERAGE is this change's; PHONE-SHELL-NAV, PHONE-SHELL-TOP and any other prefix or suffix are not. */
export const PHONE_SHELL_COVERAGE_MARKER_RE = /(?<![\w-])PHONE-SHELL-COVERAGE(?![\w-])/
/** The subject prefix of this change's own commits. */
export const PHONE_SHELL_COVERAGE_SUBJECT = 'Phone shell coverage:'

/** Existing app files that get marked lines. */
export const PHONE_SHELL_COVERAGE_FILES = ['components/help/studio-help.tsx', 'components/builder/studio-session-hygiene.tsx']

/** New files (no base text to put back). */
export const PHONE_SHELL_COVERAGE_NEW_FILES = [
  'lib/studio-phone-shell-coverage.ts',
  'scripts/studio-phone-shell-coverage-strip.mjs',
  'scripts/test-studio-phone-shell-coverage.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the base commit's proof has] per edit, whole lines, so putting them back gives the base file byte for byte. Every line the proof has now carries PHONE_SHELL_COVERAGE_PIN_MARK.
 * Two are in FRONTEND-1's lane (test-studio-p2-docs, test-atlas-help-recovery), taught with FRONTEND-1's OK of 4 Nov 11:08Z; none is in COMPOSER-2's. */
export const PHONE_SHELL_COVERAGE_PIN_MARK = '// LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Phone shell coverage:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE): on a branch stacked after this change (the phone shell coverage's), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const PHONE_SHELL_COVERAGE_PIN_EDITS = {
  "scripts/test-studio-deck-sync-truth.mjs": [[FIRST_PARENT_LINE, ""]],
  "scripts/test-studio-chat-element-edit.mjs": [[FIRST_PARENT_LINE, ""]],
  "scripts/test-studio-phone-shell-nav.mjs": [
    ["  const family = ['lib', 'components/layout', 'scripts'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(name => /phone-shell|phone-tab/.test(name) && !/builder-top|phone-shell-coverage/.test(name)).map(name => `${dir}/${name}`)) // LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE): the coverage change's own files (it has its own proof and list) are not this family\n",
     "  const family = ['lib', 'components/layout', 'scripts'].flatMap(dir => fs.readdirSync(path.join(root, dir)).filter(name => /phone-shell|phone-tab/.test(name) && !/builder-top/.test(name)).map(name => `${dir}/${name}`))\n"],
  ],
  // FRONTEND-1 lane, taught with FRONTEND-1's OK (4 Nov 11:08Z): both read components/help/studio-help.tsx raw, so they strip later changes first.
  // Restack onto dev b823b230 (5 Nov): #575 already put the same stripLaterChanges import into test-studio-p2-docs, so this change keeps only its read line there
  "scripts/test-studio-p2-docs.mjs": [["const read = rel => stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE)\n", "const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))\n"]],
  "scripts/test-atlas-help-recovery.mjs": [["import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE)\n", ""], ["const read = path => stripLaunchWording(path, stripLaterChanges(path, fs.readFileSync(new URL(path, root), 'utf8'))) // LATER-CHANGES: registry read (PHONE-SHELL-COVERAGE)\n", "const read = path => stripLaunchWording(path, fs.readFileSync(new URL(path, root), 'utf8'))\n"]],
}

/** The proof without this change's edits (the base commit's file). Idempotent: a proof that has none of the edits comes back as it is. */
export function putBackPin(rel, text) {
  return (PHONE_SHELL_COVERAGE_PIN_EDITS[rel] || []).reduce((out, [has, base]) => out.replace(has, () => base), text)
}

/** The older proofs this change teaches. */
export const PHONE_SHELL_COVERAGE_PIN_FILES = Object.keys(PHONE_SHELL_COVERAGE_PIN_EDITS)

/** Files this change edits that are not app code: .env.example (its block, appended), the registry (three lines: its files, its block, its strip) and the older proofs it teaches (PHONE_SHELL_COVERAGE_PIN_EDITS). */
export const PHONE_SHELL_COVERAGE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...PHONE_SHELL_COVERAGE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const PHONE_SHELL_COVERAGE_SCOPE_FILES = new Set([...PHONE_SHELL_COVERAGE_FILES, ...PHONE_SHELL_COVERAGE_NEW_FILES, ...PHONE_SHELL_COVERAGE_OWN_EDITS])

/** The whole .env.example block: its comments and its line (appended at the end of the file, after one blank line). */
export const PHONE_SHELL_COVERAGE_ENV_BLOCK = `# STUDIO PHONE SHELL COVERAGE (FRONTEND-2; B58; FRONTEND-1's pre-promotion UX pass of 4 Nov, blockers UX-03 and UX-04). On for the exact value "true" AND only together with NEXT_PUBLIC_STUDIO_PHONE_SHELL and NEXT_PUBLIC_STUDIO_V4_SHELL (both exact "true"); default off, and then
# nothing changes: no element is drawn and no rule matches. Build-time value: change it on Vercel and redeploy. On, on a phone (640 px and narrower), the two Studio pages that showed the desktop rail without the phone shell's bottom tab bar draw the bar too:
# Help (signed in) and the Builder's "session not found / deleted / could not load" screen. The bar is the phone shell's own (Studio, Decks, Templates, Themes, More); the rail steps aside to its brand tile at the top left, as on the other pages. Tablets and desktops are unchanged.
NEXT_PUBLIC_STUDIO_PHONE_SHELL_COVERAGE="false"
`

/** The file without this change's lines: in the two app files every line that carries the marker (as a whole token) is taken out, every other byte stays; an older proof this change taught gets its base text back (putBackPin). Any other file is returned as it is. */
export function stripPhoneShellCoverage(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in PHONE_SHELL_COVERAGE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its base text, so a proof that holds it byte for byte reads it as it was
  if (!PHONE_SHELL_COVERAGE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !PHONE_SHELL_COVERAGE_MARKER_RE.test(line)).join('\n')
}
