// FRONTEND-2 (B51, 30 Oct; PK's UAT feedback F-01 and F-02, relayed by PROGRAM-1 at 18:54Z). TWO flags in one change, both build-time, exact "true", default off:
//   NEXT_PUBLIC_STUDIO_WELCOME_TRIM       (marker STUDIO-WELCOME-TRIM, commit prefix "Welcome trim:"): the first-run welcome (NEXT_PUBLIC_STUDIO_FIRST_RUN_V2) loses the "Bring an idea..." line, the "Need a starting point?" caption, the idle
//                                         "Choose a starter..." hint, and Director's opening greeting bubble on an empty new session (Studio only; Director and the stored transcript are untouched).
//   NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM (marker STUDIO-DIRECTOR-MARK-TRIM, commit prefix "Director mark trim:"): the four-pointed star beside "Director" in the chat header and above the first-run welcome is not drawn;
//                                         the real Deckster mark is one line away (lib/studio-director-mark.ts, STUDIO_DIRECTOR_MARK = "none" | "deckster").
// Every line this change adds to an EXISTING file is a pure insertion that carries one of the two markers (a whole token), except ONE existing line that is extended: message-list.tsx's useMemo dependency list gains `trimmedGreetingIds`
// (WELCOME_TRIM_PIN_EDITS puts the old line back). Strip those lines and the three files are their base, byte for byte. The decisions live in two new libs (lib/studio-welcome-trim.ts, lib/studio-director-mark.ts); the header's tidy-up
// CSS is a new file (components/builder/chat/studio-director-mark-trim.css) whose rules can only match markup that exists with the flag on.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the five older proofs that read the three files raw (WELCOME_TRIM_PROOF_EDITS: one registry read
// of one or two lines each, tests only). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'a470679ca8e198557b2a6f9848e568324305d371' // origin/studio-v4-dev-preparation-code with #553 merged (tree of dev at the time of this change)
export const WELCOME_TRIM_FLAG = 'NEXT_PUBLIC_STUDIO_WELCOME_TRIM'
export const DIRECTOR_MARK_TRIM_FLAG = 'NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM'
export const WELCOME_TRIM_MARKER = 'STUDIO-WELCOME-TRIM'
export const DIRECTOR_MARK_TRIM_MARKER = 'STUDIO-DIRECTOR-MARK-TRIM'
/** Each marker as a WHOLE token: STUDIO-WELCOME-TRIM-X and X-STUDIO-WELCOME-TRIM are not it. */
export const WELCOME_TRIM_MARKER_RE = /(?<![\w-])STUDIO-WELCOME-TRIM(?![\w-])/
export const DIRECTOR_MARK_TRIM_MARKER_RE = /(?<![\w-])STUDIO-DIRECTOR-MARK-TRIM(?![\w-])/
/** A line that carries either marker. */
export const WELCOME_TRIM_ANY_MARKER_RE = /(?<![\w-])STUDIO-(?:WELCOME|DIRECTOR-MARK)-TRIM(?![\w-])/
/** The subject prefixes of this change's own commits: one per flag (neither is "Chat ..." / "Text set ...": older scope checks find their own commits by those prefixes). */
export const WELCOME_TRIM_SUBJECTS = ['Welcome trim:', 'Director mark trim:']

/** Existing files that get marked lines. */
export const WELCOME_TRIM_FILES = [
  'components/builder/chat/studio-director-header.tsx',
  'components/builder/chat/studio-welcome.tsx',
  'components/builder/message-list.tsx',
]

/** New files (no base text to put back). */
export const WELCOME_TRIM_NEW_FILES = [
  'lib/studio-welcome-trim.ts',
  'lib/studio-director-mark.ts',
  'components/builder/chat/studio-director-mark-trim.css',
  'scripts/studio-welcome-trim-strip.mjs',
  'scripts/test-studio-welcome-trim.mjs',
  'scripts/fixtures/studio-welcome-trim/pk-f03-scenario-A.json',
]

/** The one existing line this change extends: [text now, text before], whole lines. Putting `now` back to `was` gives the base. */
export const WELCOME_TRIM_PIN_MARK = '// STUDIO-WELCOME-TRIM'
export const WELCOME_TRIM_PIN_EDITS = {
  'components/builder/message-list.tsx': [
    ['studioFrontendTranscriptReceipt, studioGreetingSafety, trimmedGreetingIds]); // STUDIO-WELCOME-TRIM\n', 'studioFrontendTranscriptReceipt, studioGreetingSafety]);\n'],
  ],
}

/** The file without this change's pins put back (idempotent: a file that does not have `now` is returned as it is). */
export function putBackPin(rel, text) {
  return (WELCOME_TRIM_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches (each reads one of the three files raw, through an import allow-list or a byte pin, so a source with this change's lines in it failed them): [text the proof has now, text it had before] per edit, so putting them back gives the
 *  previous file. Every added piece carries a registry-read mark ("LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)"). The five edits are the registry reads the repo already uses for every later change; no proof owned by FRONTEND-1 or COMPOSER-2 is among them. */
export const WELCOME_TRIM_PROOF_EDITS = {
  "scripts/test-studio-welcome-polish.mjs": [
    ["import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM): a registered later change's marked lines come out of a source before it is read\nconst read = rel => stripLaunchWording(rel, stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))) // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)\n",
     "const read = rel => stripLaunchWording(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8'))\n"],
  ],
  "scripts/test-studio-welcome-width.mjs": [
    ["const read = rel => stripLaterChanges(rel, fs.readFileSync(path.join(repoRoot, rel), 'utf8')) // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM): a registered later change's marked lines come out of a source before it is read\n",
     "const read = rel => fs.readFileSync(path.join(repoRoot, rel), 'utf8')\n"],
  ],
  "scripts/test-studio-chat-header-ask.mjs": [
    ["import { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM): a registered later change's marked lines come out of a source before it is read\nfunction loadModule(root, relative, env, imports) {\n  const source = stripLaterChanges(relative, fs.readFileSync(path.join(root, relative), 'utf8')) // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)\n",
     "function loadModule(root, relative, env, imports) {\n  const source = fs.readFileSync(path.join(root, relative), 'utf8')\n"],
    ["  const read = relative => stripLaterChanges(relative, fs.readFileSync(path.join(root, relative), 'utf8')) // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)\n",
     "  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')\n"],
  ],
  "scripts/test-studio-pass2b-chat.mjs": [
    ["const welcomeTrimStrip = await import('./studio-welcome-trim-strip.mjs') // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM): the strip of the change stacked after chat parity, so its marked lines in the Director header and the message list come out of a source before the pins below read it\n",
     ""],
    ["  const read = relative => welcomeTrimStrip.stripWelcomeTrim(relative, fs.readFileSync(path.join(root, relative), 'utf8')) // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)\n",
     "  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')\n"],
  ],
  "scripts/test-studio-chat-undo-v2.mjs": [
    ["const welcomeTrimStrip = await import('./studio-welcome-trim-strip.mjs') // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM): the strip of the change stacked after chat clean order, so its marked lines in the message list come out first\n",
     ""],
    ["    const head = welcomeTrimStrip.stripWelcomeTrim(LIST, read(LIST)) // LATER-CHANGES: registry read (STUDIO-WELCOME-TRIM)\n",
     "    const head = read(LIST)\n"],
  ],
}

/** An older proof without this change's edits (the previous file). */
export function putBackProof(rel, text) {
  return (WELCOME_TRIM_PROOF_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
export const WELCOME_TRIM_PROOF_FILES = Object.keys(WELCOME_TRIM_PROOF_EDITS)

export const WELCOME_TRIM_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...WELCOME_TRIM_PROOF_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const WELCOME_TRIM_SCOPE_FILES = new Set([...WELCOME_TRIM_FILES, ...WELCOME_TRIM_NEW_FILES, ...WELCOME_TRIM_OWN_EDITS])

/** The whole .env.example block: both flags' comments and lines. */
export const WELCOME_TRIM_ENV_BLOCK = `# STUDIO WELCOME TRIM (FRONTEND-2, B51; PK's UAT feedback F-01 of 30 Oct: the new-session welcome has too much copy). On for the exact value "true"; default off, and then the welcome is exactly what it is today. Build-time value: change it on Vercel and redeploy.
# It trims the FIRST-RUN welcome only (it needs NEXT_PUBLIC_STUDIO_FIRST_RUN_V2). On, the welcome keeps the time-of-day greeting, "What story are we telling today?", the three starters and the Replay intro / Explore templates / Blank canvas row, and drops:
# the "Bring an idea..." line, the "Need a starting point?" caption, the idle "Choose a starter..." hint (the busy notice, "Director is working...", stays) and Director's opening "Hello! I'm your presentation assistant..." bubble on an empty new session.
# The greeting is only not drawn: Director is unchanged and the message stays in the transcript data. It stays hidden once the user sends a message; a restored session, an open deck's welcome and a later reply with the same words are unchanged.
NEXT_PUBLIC_STUDIO_WELCOME_TRIM="false"
# STUDIO DIRECTOR MARK TRIM (FRONTEND-2, B51; PK's UAT feedback F-02 of 30 Oct: the four-pointed star is the old logo). On for the exact value "true"; default off. Build-time value.
# On, the star beside "Director" in the chat header and above the first-run welcome is not drawn (the header and the welcome close up, no gap). PK has not picked the alternative yet: it is ONE LINE away in lib/studio-director-mark.ts,
# STUDIO_DIRECTOR_MARK = "none" (default) or "deckster", which draws the real Deckster mark (public/logo-icon-sm.png) at the star's size in both places. Other star uses (message avatars, theme menu, outline canvas, welcome stage caption) are not touched.
NEXT_PUBLIC_STUDIO_DIRECTOR_MARK_TRIM="false"
`

/** The file without this change's lines: the pin put back, then every line that carries either marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripWelcomeTrim(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in WELCOME_TRIM_PROOF_EDITS) return putBackProof(rel, text) // an older proof this change taught: its previous text
  if (!WELCOME_TRIM_FILES.includes(rel)) return text
  return putBackPin(rel, text).split('\n').filter(line => !WELCOME_TRIM_ANY_MARKER_RE.test(line)).join('\n')
}
