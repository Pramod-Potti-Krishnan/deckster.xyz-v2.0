// FRONTEND-1 (PK's UAT feedback F-06, F-08, F-09, 30 Oct). Flag NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT (exact "true", default off, build-time): the Director chat stops drawing what the stage already says.
//   F-08  there is no outline card in the chat at all (PK 31 Oct; the first cut only dropped the numbered, scrolling slide list): the card renders nothing and a standalone outline frame draws no Director row;
//         Director's one-line message and its "Looks perfect! / Make some changes" buttons are their own rows and stay.
//   F-09  the Plan / Outline / Build / Check / Package card is gone from the chat (chat clean's job card, the presence row's Build log); the chain of thought shows on the stage. While the stage is hidden the chat shows exactly one
//         quiet line, phase words and an elapsed clock ("Drafting your outline... 0:18"); while it is open, none.
//   F-06  "Waiting for your go-ahead" is not shown when Director's build_phase said auto_proceed === true for this build (Studio never presses approve for the user).
// Every decision is lib/studio-strawman-chat.ts (pure, import-free); components/builder/chat/studio-strawman-chat.tsx draws the line; hooks/use-studio-strawman-chat.ts keeps auto_proceed.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker STRAWMAN-CHAT (matched as a whole token): app/builder/page.tsx (three imports at the end with the other late ones, the flag line, the hook
// call and the ONE stage-open line, and the two lines that make the presence row's slot a ternary), components/builder/chat/studio-outline-card.tsx (one import and one early return of null), components/builder/message-list.tsx
// (one import and one early return of null for a standalone outline frame's Director row) and components/builder/chat/studio-chat-clean.tsx (one import and the two lines that make the job card a ternary). Strip the marked
// lines and each file is its base, byte for byte.
// The stage-open boolean is a parameter of every function: the page computes it on one marked line (strawmanChatStageOpen) from what it has today, so FRONTEND-2's studio-stage-open-gate can replace that line and nothing else.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read these files raw or check the first-parent
// line (STRAWMAN_CHAT_PIN_EDITS). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'a470679ca8e198557b2a6f9848e568324305d371' // origin/studio-v4-dev-preparation-code (#553 merged) at the start of this change
export const STRAWMAN_CHAT_FLAG = 'NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT'
export const STRAWMAN_CHAT_MARKER = 'STRAWMAN-CHAT'
/** The marker as a WHOLE token: STRAWMAN-CHAT-X and X-STRAWMAN-CHAT are not it. */
export const STRAWMAN_CHAT_MARKER_RE = /(?<![\w-])STRAWMAN-CHAT(?![\w-])/
/** The subject prefix of this change's own commits (the older proofs find their own commits by their own prefixes: "Chat clean", "Flow control", "Text set keep look" ...). */
export const STRAWMAN_CHAT_SUBJECT = 'Strawman chat:'

/** Existing files that get marked lines (pure insertions only). */
export const STRAWMAN_CHAT_FILES = [
  'app/builder/page.tsx',
  'components/builder/chat/studio-outline-card.tsx',
  'components/builder/message-list.tsx',
  'components/builder/chat/studio-chat-clean.tsx',
]

/** New files (no base text to put back). */
export const STRAWMAN_CHAT_NEW_FILES = [
  'lib/studio-strawman-chat.ts',
  'hooks/use-studio-strawman-chat.ts',
  'components/builder/chat/studio-strawman-chat.tsx',
  'components/builder/chat/studio-strawman-chat.css',
  'scripts/studio-strawman-chat-strip.mjs',
  'scripts/test-studio-strawman-chat.mjs',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries STRAWMAN_CHAT_PIN_MARK. */
export const STRAWMAN_CHAT_PIN_MARK = 'LATER-CHANGES: registry read (STRAWMAN-CHAT)'
/** The line the first-parent scope checks of two older proofs get: a branch stacked after an older change has this change's commits on its first-parent line, and they are this change's own, not that change's. */
const FIRST_PARENT_SUBJECT_LINE = `  shas.splice(0, shas.length, ...shas.filter(sha => !/^Strawman chat:/.test(git('log', '-1', '--format=%s', sha)))) // ${STRAWMAN_CHAT_PIN_MARK}: on a branch stacked after this change (strawman chat's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n`
export const STRAWMAN_CHAT_PIN_EDITS = {
  // the first-parent scope check of test-studio-chat-element-edit.mjs: a branch stacked after this change has this change's commits on the first-parent line
  "scripts/test-studio-chat-element-edit.mjs": [[FIRST_PARENT_SUBJECT_LINE, ""]],
  // the first-parent scope check of test-studio-deck-sync-truth.mjs: the same
  "scripts/test-studio-deck-sync-truth.mjs": [[FIRST_PARENT_SUBJECT_LINE, ""]],
  // chat undo v2's proof strips the message list with its own strip and chat clean's and the order change's: this change's marked lines in the list (an import and the early return for a standalone outline frame) come out first, in one line
  "scripts/test-studio-chat-undo-v2.mjs": [[`    const head = (await import('./studio-strawman-chat-strip.mjs')).stripStrawmanChat(LIST, read(LIST)) // ${STRAWMAN_CHAT_PIN_MARK}: the strip of the change stacked after this one, so its marked lines in the message list come out first\n`, "    const head = read(LIST)\n"]],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (STRAWMAN_CHAT_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const STRAWMAN_CHAT_PIN_FILES = Object.keys(STRAWMAN_CHAT_PIN_EDITS)

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines) and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-strawman-chat.mjs`. */
export const STRAWMAN_CHAT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...STRAWMAN_CHAT_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const STRAWMAN_CHAT_SCOPE_FILES = new Set([...STRAWMAN_CHAT_FILES, ...STRAWMAN_CHAT_NEW_FILES, ...STRAWMAN_CHAT_OWN_EDITS])

/** The whole .env.example block: its comments and its line. */
export const STRAWMAN_CHAT_ENV_BLOCK = `# STUDIO STRAWMAN CHAT (FRONTEND-1; PK's UAT feedback F-06, F-08, F-09, 30 Oct). On for the exact value "true"; default off, and then the chat is exactly as before. Build-time value: change it on Vercel and redeploy. Studio shell only; the status line also needs NEXT_PUBLIC_BUILD_NARRATION.
# On: (F-08) there is no outline card in the chat at all (PK 31 Oct), and a standalone outline frame draws no Director row; Director's one-line "I've created an outline" message and its "Looks perfect! / Make some changes" buttons stay.
# (F-09) the Plan / Outline / Build / Check / Package card is gone from the chat (chat clean's job card) and so is the presence row's Build log: the chain of thought shows on the stage. While the stage is hidden the chat shows exactly one quiet line,
# phase words and an elapsed clock ("Drafting your outline... 0:18"); once the stage is open it shows none. (F-06) "Waiting for your go-ahead" is not shown when Director's build_phase said auto_proceed === true for this build; Studio never presses approve.
# No Director change, safe to set at any time. The page decides "stage open" on one marked line (strawmanChatStageOpen) so FRONTEND-2's stage-open gate can replace it.
NEXT_PUBLIC_STUDIO_STRAWMAN_CHAT="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays (a taught proof gets its previous lines back). Any other file is returned as it is. */
export function stripStrawmanChat(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in STRAWMAN_CHAT_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!STRAWMAN_CHAT_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !STRAWMAN_CHAT_MARKER_RE.test(line)).join('\n')
}
