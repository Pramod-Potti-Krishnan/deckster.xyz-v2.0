// FRONTEND-1 (DIRECTOR-2's read-only diagnosis G-4 of the outline card). Flag NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4 (exact "true", default off, build-time): three defects in the expanded slide of the chat's outline card
// (lib/studio-outline-card-g4.ts has the root causes and the fix).
//   (a) a leading "Key message:" line in the narrative that repeats the slide's key message is drawn a second time;
//   (b) the slide's subtitle is never drawn;
//   (c) a "conceptual" research status with no citations, source types or issues still draws a "Research details" block.
// Every line this change adds to an EXISTING file carries the marker OUTLINE-CARD-G4 (matched as a whole token). Four of them are pure insertions in components/builder/chat/studio-outline-card.tsx (the import, the one view line,
// the subtitle line) and in hooks/use-deckster-websocket-v2.ts (the optional `subtitle` on the slide type); TWO base lines of the card are rewritten (the narrative paragraph and the research condition), so the strip is a list of [has, was]
// pairs, not a marker filter: putting each pair back gives the file at BASE_COMMIT byte for byte. The new files (a lib, this strip, a proof) have no base text.
// FRONTEND-2's UX findings E (#603) carries the same four-line edit of FRONTEND-1's test-studio-voice-call.mjs (the .env.example "last thing in the file" pin must take out the env blocks registered after voice-call's); this change carries it too, BYTE-IDENTICAL, so both merge clean in either order.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // origin/studio-v4-dev-preparation-code (#598 merged) at the start of this change
export const OUTLINE_CARD_G4_FLAG = 'NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4'
export const OUTLINE_CARD_G4_MARKER = 'OUTLINE-CARD-G4'
/** The marker as a WHOLE token: OUTLINE-CARD-G4-X and X-OUTLINE-CARD-G4 are not this change's. */
export const OUTLINE_CARD_G4_MARKER_RE = /(?<![\w-])OUTLINE-CARD-G4(?![\w-])/
/** The subject prefix of this change's own commits. */
export const OUTLINE_CARD_G4_SUBJECT = 'Outline card G4:'

export const OUTLINE_CARD = 'components/builder/chat/studio-outline-card.tsx'
export const SOCKET_HOOK = 'hooks/use-deckster-websocket-v2.ts'

/** Existing files that get marked lines. */
export const OUTLINE_CARD_G4_FILES = [OUTLINE_CARD, SOCKET_HOOK]

/** New files (no base text to put back). */
export const OUTLINE_CARD_G4_NEW_FILES = [
  'lib/studio-outline-card-g4.ts',
  'scripts/studio-outline-card-g4-strip.mjs',
  'scripts/test-studio-outline-card-g4.mjs',
]

const MARK = `// ${OUTLINE_CARD_G4_MARKER}`
const JSX_MARK = `{/* ${OUTLINE_CARD_G4_MARKER} */}`

/** [text the file has now, text the file had at BASE_COMMIT] per edit, in the order they sit in the file; putting them back gives the base file byte for byte. Every line the file has now that this change touched carries the marker. */
export const OUTLINE_CARD_G4_EDITS = {
  [OUTLINE_CARD]: [
    [`import { STUDIO_OUTLINE_CARD_G4_ENABLED, outlineCardG4View } from "@/lib/studio-outline-card-g4" ${MARK}\n`, ''],
    [`          const g4 = outlineCardG4View(STUDIO_OUTLINE_CARD_G4_ENABLED, slide, context, hasResearch) ${MARK}: flag off = the slide's own narrative, no subtitle, hasResearch\n`, ''],
    [`                  {g4.subtitle && <p data-studio-director-part="outline-review-subtitle">{g4.subtitle}</p>}${JSX_MARK}\n`, ''],
    [`                  {g4.narrative && <p>{g4.narrative}</p>}${JSX_MARK}\n`, `                  {slide.narrative && <p>{slide.narrative}</p>}\n`],
    [`                  {g4.research && ( ${MARK}\n`, `                  {hasResearch && (\n`],
  ],
  [SOCKET_HOOK]: [
    [`      subtitle?: string | null; ${MARK}\n`, ''],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. Every line the proof has now that this change touched carries OUTLINE_CARD_G4_PIN_MARK. */
export const OUTLINE_CARD_G4_PIN_MARK = 'LATER-CHANGES: registry read (OUTLINE-CARD-G4)'
const SPLICE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Outline card G4:/.test(git('log', '-1', '--format=%s', sha)))) // "
export const OUTLINE_CARD_G4_PIN_EDITS = {
  // two older proofs walk the first-parent line of BASE..HEAD without merges and require every subject on it to be their own: this change's commits (subject "Outline card G4:") are left out of that line, like every later change's
  'scripts/test-studio-chat-element-edit.mjs': [
    [`${SPLICE}${OUTLINE_CARD_G4_PIN_MARK}: on a branch stacked after this change (the outline card G4's), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n`, ''],
  ],
  'scripts/test-studio-deck-sync-truth.mjs': [
    [`${SPLICE}${OUTLINE_CARD_G4_PIN_MARK}: on a branch stacked after this change (the outline card G4's), the first-parent commits are its own, not this change's; with none left the identity checks cover the files\n`, ''],
  ],
}

/** The file with this change's edits put back (the previous text). Used by the strip and the proof. */
export function putBackOutlineCardG4(rel, text) {
  return (OUTLINE_CARD_G4_EDITS[rel] || OUTLINE_CARD_G4_PIN_EDITS[rel] || OUTLINE_CARD_G4_VOICE_CALL_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/**
 * FRONTEND-1's voice-call proof with the four-line after-merge edit FRONTEND-1 OK'd for UX findings E (FE1-OK-REQUEST-2.md section 2, #603 carries the same lines): its .env.example pins read the file raw, so a later change's env block
 * shows up in it. [line now, line before] per edit, whole lines; was = '' for an inserted line. The lines carry UX_FINDINGS_E_PIN_MARK, not this change's mark, because they are #603's lines byte for byte. Put back, the proof is the base's.
 */
export const OUTLINE_CARD_G4_VOICE_CALL_PIN_MARK = '// LATER-CHANGES: registry read (UX-FINDINGS-E)'
export const OUTLINE_CARD_G4_VOICE_CALL_PIN_EDITS = {
  'scripts/test-studio-voice-call.mjs': [
    ["const laterRegistry = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ''],
    ["const laterEnvOut = text => laterRegistry.LATER_ENV_BLOCKS.slice(laterRegistry.LATER_ENV_BLOCKS.indexOf(strip.VOICE_CALL_ENV_BLOCK) + 1).reduce((out, block) => out.replace(`\\n${block}`, ''), text) // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ''],
    ["  ok(laterEnvOut(env).endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "  ok(env.endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line')\n"],
    ["    ok(laterEnvOut(`${envDiff.map(line => line.slice(1)).join('\\n')}\\n`).trimEnd().endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "    ok(envDiff.map(line => line.slice(1)).join('\\n').endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)')\n"],
  ],
}
/** The proof it edits, and the anchor the two inserted lines go right after. */
export const OUTLINE_CARD_G4_VOICE_CALL_PIN_FILES = Object.keys(OUTLINE_CARD_G4_VOICE_CALL_PIN_EDITS)
export const OUTLINE_CARD_G4_VOICE_CALL_PIN_ANCHOR = "const core = await import('./studio-voice-core-strip.mjs')"

/** The older proofs this change teaches. */
export const OUTLINE_CARD_G4_PIN_FILES = Object.keys(OUTLINE_CARD_G4_PIN_EDITS)

export const OUTLINE_CARD_G4_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...OUTLINE_CARD_G4_PIN_FILES, ...OUTLINE_CARD_G4_VOICE_CALL_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const OUTLINE_CARD_G4_SCOPE_FILES = new Set([...OUTLINE_CARD_G4_FILES, ...OUTLINE_CARD_G4_NEW_FILES, ...OUTLINE_CARD_G4_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const OUTLINE_CARD_G4_ENV_BLOCK = `# STUDIO OUTLINE CARD G4 (FRONTEND-1; DIRECTOR-2's read-only diagnosis G-4 of the outline card). On for the exact value "true"; default off, and then the card renders byte for byte as it did. Build-time value: change it on Vercel and redeploy. It acts only where the card is drawn (with the Studio strawman chat on, the chat draws no outline card at all).
# On, in a slide's expanded body: (a) a leading "Key message:" line of the narrative that repeats the slide's key message is left out (the key message is drawn once, under "Key message"); (b) the slide's subtitle is drawn first, when it has one; (c) the "Research details" block is not drawn when the status is "conceptual" with no citations, no source types and no issues. The key points are not touched.
# No new text, no Director change, nothing sent.
NEXT_PUBLIC_STUDIO_OUTLINE_CARD_G4="false"
`

/** The file without this change's edits: each [has, was] pair put back; every other byte stays. Any other file is returned as it is. */
export function stripOutlineCardG4(rel, text) {
  if (typeof text !== 'string') return text
  if (!(rel in OUTLINE_CARD_G4_EDITS) && !(rel in OUTLINE_CARD_G4_PIN_EDITS) && !(rel in OUTLINE_CARD_G4_VOICE_CALL_PIN_EDITS)) return text
  return putBackOutlineCardG4(rel, text)
}
