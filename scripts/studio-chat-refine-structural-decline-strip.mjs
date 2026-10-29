// FRONTEND-2 (B50, 29 Oct; parity rows 43 and 45, E2E-2 run-B3: a chat "Shorten this" on a slide title came back "Done" while the title was rewritten from the instruction). Flag NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE (exact "true",
// default off, build-time): the Studio INTERIM until the Text Service's fix (its structural branch never puts the box's current text into its prompt). With the flag on, a chat refine of a TEXT_BOX whose semantic role is a KNOWN STRUCTURAL role
// (every role but BODY_TEXT) is answered element_directive_result {status: "failed", error_code: "unsupported_type"} BEFORE any generation; Director then says its own line. Everything else is refined as today.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-REFINE-STRUCTURAL-DECLINE (a whole token): lib/chat-element-refine.ts (one import, one decline line). Strip those lines and the file is its
// base, byte for byte. The new lib lib/chat-refine-structural-decline.ts holds the flag, the role table and the test.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read the runner raw (CHAT_REFINE_STRUCTURAL_DECLINE_PIN_EDITS).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'dec76f0afde6de6da906a06e5ea19d9ae5ce8ff9' // origin/studio-v4-dev-preparation-code with #551 merged (29 Oct): dev, which this change is cut from
export const CHAT_REFINE_STRUCTURAL_DECLINE_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE'
export const CHAT_REFINE_STRUCTURAL_DECLINE_MARKER = 'CHAT-REFINE-STRUCTURAL-DECLINE'
/** The marker as a WHOLE token: CHAT-REFINE-STRUCTURAL-DECLINE-X and X-CHAT-REFINE-STRUCTURAL-DECLINE are not it. */
export const CHAT_REFINE_STRUCTURAL_DECLINE_MARKER_RE = /(?<![\w-])CHAT-REFINE-STRUCTURAL-DECLINE(?![\w-])/
/** The subject prefix of this change's own commits (NOT "Chat element edit" / "Targeted chat edit:" / "Targeted chat add:" / "Chat text set:": the older scope checks find their own commits by those prefixes). */
export const CHAT_REFINE_STRUCTURAL_DECLINE_SUBJECT = 'Structural refine decline:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_REFINE_STRUCTURAL_DECLINE_FILES = [
  'lib/chat-element-refine.ts',
]

/** New files (no base text to put back). */
export const CHAT_REFINE_STRUCTURAL_DECLINE_NEW_FILES = [
  'lib/chat-refine-structural-decline.ts',
  'scripts/studio-chat-refine-structural-decline-strip.mjs',
  'scripts/test-studio-chat-refine-structural-decline.mjs',
  'scripts/fixtures/chat-refine-structural-decline/b47-capture.json',
  'scripts/fixtures/chat-refine-structural-decline/director-frames/01-with-element_text1.json', // DIRECTOR-2's recorded examples (workspace main 4c47fbd2, streams/director2/refine-unsupported/examples; Director MR !599 9a60d351), copied byte for byte
  'scripts/fixtures/chat-refine-structural-decline/director-frames/02-without-element_text1.json',
  'scripts/fixtures/chat-refine-structural-decline/director-frames/03-text-set-off.json',
  'scripts/fixtures/chat-refine-structural-decline/director-frames/04-blank-placeholder-null-element-id.json',
  'scripts/fixtures/chat-refine-structural-decline/director-frames/05-flag-off-todays-line.json',
  'scripts/fixtures/chat-refine-structural-decline/director-frames/06-other-error-code.json',
  'scripts/fixtures/chat-refine-structural-decline/director-frames/07-element-edit-off-no-offer.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries CHAT_REFINE_STRUCTURAL_DECLINE_PIN_MARK. */
export const CHAT_REFINE_STRUCTURAL_DECLINE_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-REFINE-STRUCTURAL-DECLINE)'
export const CHAT_REFINE_STRUCTURAL_DECLINE_PIN_EDITS = {
  // filled in by the proofs this change had to teach (none yet)
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (CHAT_REFINE_STRUCTURAL_DECLINE_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_REFINE_STRUCTURAL_DECLINE_PIN_FILES = Object.keys(CHAT_REFINE_STRUCTURAL_DECLINE_PIN_EDITS)

export const CHAT_REFINE_STRUCTURAL_DECLINE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_REFINE_STRUCTURAL_DECLINE_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_REFINE_STRUCTURAL_DECLINE_SCOPE_FILES = new Set([...CHAT_REFINE_STRUCTURAL_DECLINE_FILES, ...CHAT_REFINE_STRUCTURAL_DECLINE_NEW_FILES, ...CHAT_REFINE_STRUCTURAL_DECLINE_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_REFINE_STRUCTURAL_DECLINE_ENV_BLOCK = `# STUDIO CHAT REFINE STRUCTURAL DECLINE (FRONTEND-2, B50; parity rows 43 and 45, E2E-2 run-B3: a chat "Shorten this" on a slide title came back "Done" while the title was rewritten from the instruction). On for the exact value "true"; default off, and then
# a chat refine of any text box behaves exactly as today. Build-time value: change it on Vercel and redeploy. It acts only while the chat element refine flag is on (it lives in the chat refine runner). An interim until the Text Service's own fix: its structural branch
# never puts the box's current text into its prompt, so the request Studio sends cannot be honoured.
# On, a chat refine of a text box whose semantic role is a structural role (every role but BODY_TEXT: slide, presentation and section titles and subtitles, eyebrow, author, section number, closing, contact, quote attribution, footer, sources) is answered
# element_directive_result {status: "failed", error_code: "unsupported_type"} BEFORE any generation: no Text Labs call, the box is not touched, and Director says its own line (Studio adds no copy). BODY_TEXT, a text box with no role or an unknown role,
# and every other element type are refined as today; the manual Element panel refine is not touched.
NEXT_PUBLIC_STUDIO_CHAT_REFINE_STRUCTURAL_DECLINE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatRefineStructuralDecline(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_REFINE_STRUCTURAL_DECLINE_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_REFINE_STRUCTURAL_DECLINE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_REFINE_STRUCTURAL_DECLINE_MARKER_RE.test(line)).join('\n')
}
