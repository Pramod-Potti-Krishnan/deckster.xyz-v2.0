// FRONTEND-1 (chat parity round C2, Studio half, 10 Nov). Flags NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS / _PUBLISH (the string "true", each default off, build-time): Director's two C2 groups, `deck_ops` (cap deckops1) and `publish` (cap publish1),
// reach Studio as the same `studio_action` frame the themes / identity / templates groups use. With a flag on Studio advertises the group's cap and runs each action through the click path's own handler (the viewer's, the Sessions list's, the
// Publish dialog's own requests), answering with studio_action_result; a write says `done` only on evidence. Every decision is lib/studio-chat-parity-c2.ts (pure); lib/studio-chat-parity-deckops.ts, lib/studio-chat-parity-publish.ts and
// lib/studio-chat-parity-c2-run.ts run the actions; lib/studio-chat-parity-runners.ts and its three groups are NOT touched. The Director contract is read from Director's code (origin/uat @ e30b41d4): src/utils/mdc_chat_parity_deck.py,
// mdc_chat_parity_publish.py, mdc_studio_action.py, docs/chat-parity/c2-deck-contract.md, c2-publish-contract.md; the file:line of each rule is in the lib files' comments and in the proof.
// Every line this change adds to an EXISTING file carries the marker CHAT-PARITY-C2 (matched as a whole token). Most are pure insertions (the viewer's one effect, the Builder page's runner block, its routing line and imports); TWO base lines of
// lib/studio-chat-parity.ts are rewritten (the any-flag constant and the caps constant), so the strip is a list of [has, was] pairs for those and a marker filter for the rest: putting each pair back and dropping the other marked lines gives the
// file at BASE_COMMIT byte for byte. The new files (four libs, this strip, a proof) have no base text.
// The viewer's lines carry the older CHAT-PARITY marker as well (as B43's viewer lines do): the older proofs that pin the viewer's bytes after taking out only the strips they know (first paint, arrange) then see none of this change's lines, so neither needs an edit.
// Older proofs taught: FRONTEND-1's chat parity proof finds "its own" newest commit by subject ("Chat parity"), and this change's commits start the same way, so its walk now starts at BASE_COMMIT (one line); FRONTEND-1's voice-call proof gets the
// four-line registry-read edit of FRONTEND-2's UX findings E (#603), BYTE-IDENTICAL, because its .env.example pins read the file raw and this change's block sits after voice-call's (so both merge clean in either order, as #604 did).
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'eeb78d4f4b7676d75c244746f1edc7da1d269478' // origin/studio-v4-dev-preparation-code (#598 merged) at the start of this change
export const CHAT_PARITY_C2_FLAGS = ['NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS', 'NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH']
export const CHAT_PARITY_C2_MARKER = 'CHAT-PARITY-C2'
/** The marker as a WHOLE token: CHAT-PARITY-C2-X and X-CHAT-PARITY-C2 are not this change's (and CHAT-PARITY alone is the older change's). */
export const CHAT_PARITY_C2_MARKER_RE = /(?<![\w-])CHAT-PARITY-C2(?![\w-])/
/** The subject prefix of this change's own commits. */
export const CHAT_PARITY_C2_SUBJECT = 'Chat parity C2:'

export const PARITY_LIB = 'lib/studio-chat-parity.ts'
export const BUILDER_PAGE = 'app/builder/page.tsx'
export const VIEWER = 'components/presentation-viewer.tsx'

/** Existing files that get marked lines. */
export const CHAT_PARITY_C2_FILES = [PARITY_LIB, BUILDER_PAGE, VIEWER]

/** New files (no base text to put back). */
export const CHAT_PARITY_C2_NEW_FILES = [
  'lib/studio-chat-parity-c2.ts',
  'lib/studio-chat-parity-c2-run.ts',
  'lib/studio-chat-parity-deckops.ts',
  'lib/studio-chat-parity-publish.ts',
  'scripts/studio-chat-parity-c2-strip.mjs',
  'scripts/test-studio-chat-parity-c2.mjs',
]

const MARK = `// ${CHAT_PARITY_C2_MARKER}`

/** The two rewritten base lines: [line now, line at BASE_COMMIT], whole lines. Every other marked line of CHAT_PARITY_C2_FILES is a pure insertion and goes with the marker filter. */
export const CHAT_PARITY_C2_EDITS = {
  [PARITY_LIB]: [
    [`export const STUDIO_CHAT_PARITY_ANY_ENABLED = Object.values(CHAT_PARITY_FLAGS).some(Boolean) || STUDIO_CHAT_PARITY_C2_ANY_ENABLED ${MARK}\n`, 'export const STUDIO_CHAT_PARITY_ANY_ENABLED = Object.values(CHAT_PARITY_FLAGS).some(Boolean)\n'],
    [`export const CHAT_PARITY_CAPS: readonly string[] = [...chatParityCaps(CHAT_PARITY_FLAGS), ...chatParityC2Caps(CHAT_PARITY_C2_FLAGS)] ${MARK}: deckops1 / publish1 after the three groups' caps\n`, 'export const CHAT_PARITY_CAPS: readonly string[] = chatParityCaps(CHAT_PARITY_FLAGS)\n'],
  ],
}

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, so putting them back gives the previous file byte for byte. */
export const CHAT_PARITY_C2_PIN_MARK = 'LATER-CHANGES: registry read (CHAT-PARITY-C2)'
export const CHAT_PARITY_C2_PIN_EDITS = {
  // FRONTEND-1's chat parity proof: "its own" newest commit is found by subject; this change's commits ("Chat parity C2: ...") start the same way, so the walk starts at the base this change was made on
  'scripts/test-studio-chat-parity.mjs': [
    [`const OWN = (() => { try { return git('log', '-1', '--format=%H', '-E', '--grep=^Chat parity', '${BASE_COMMIT}').trim() || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way) // ${CHAT_PARITY_C2_PIN_MARK}: the walk starts at the commit the later "Chat parity C2:" change was made on (#598), so that change's own commits, which start the same way, are not read as this change's newest commit\n`,
      `const OWN = (() => { try { return git('log', '-1', '--format=%H', '-E', '--grep=^Chat parity', 'HEAD').trim() || null } catch { return null } })() // a merge of dev into this branch is this change's commit too (its subject starts the same way)\n`],
  ],
}

/**
 * FRONTEND-1's voice-call proof with the four-line after-merge edit FRONTEND-1 OK'd for UX findings E (FE1-OK-REQUEST-2.md section 2, #603 carries the same lines): its .env.example pins read the file raw, so a later change's env block
 * shows up in it. [line now, line before] per edit, whole lines; was = '' for an inserted line. The lines carry UX_FINDINGS_E_PIN_MARK, not this change's mark, because they are #603's lines byte for byte (and #604's). Put back, the proof is the base's.
 */
export const CHAT_PARITY_C2_VOICE_CALL_PIN_MARK = '// LATER-CHANGES: registry read (UX-FINDINGS-E)'
export const CHAT_PARITY_C2_VOICE_CALL_PIN_EDITS = {
  'scripts/test-studio-voice-call.mjs': [
    ["const laterRegistry = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ''],
    ["const laterEnvOut = text => laterRegistry.LATER_ENV_BLOCKS.slice(laterRegistry.LATER_ENV_BLOCKS.indexOf(strip.VOICE_CALL_ENV_BLOCK) + 1).reduce((out, block) => out.replace(`\\n${block}`, ''), text) // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", ''],
    ["  ok(laterEnvOut(env).endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "  ok(env.endsWith(`\\n${strip.VOICE_CALL_ENV_BLOCK}`) && strip.VOICE_CALL_ENV_BLOCK.endsWith('\\n'), '.env.example: the block is the last thing in the file, after one blank line')\n"],
    ["    ok(laterEnvOut(`${envDiff.map(line => line.slice(1)).join('\\n')}\\n`).trimEnd().endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)') // LATER-CHANGES: registry read (UX-FINDINGS-E)\n", "    ok(envDiff.map(line => line.slice(1)).join('\\n').endsWith(strip.VOICE_CALL_ENV_BLOCK.trimEnd()), '.env.example: this change adds exactly its block (after ELEMENT-3\\'s two lines)')\n"],
  ],
}
export const CHAT_PARITY_C2_VOICE_CALL_PIN_FILES = Object.keys(CHAT_PARITY_C2_VOICE_CALL_PIN_EDITS)
export const CHAT_PARITY_C2_PIN_FILES = Object.keys(CHAT_PARITY_C2_PIN_EDITS)

export const CHAT_PARITY_C2_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_PARITY_C2_PIN_FILES, ...CHAT_PARITY_C2_VOICE_CALL_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_PARITY_C2_SCOPE_FILES = new Set([...CHAT_PARITY_C2_FILES, ...CHAT_PARITY_C2_NEW_FILES, ...CHAT_PARITY_C2_OWN_EDITS])

/** The whole .env.example block: its comments and its two flag lines. */
export const CHAT_PARITY_C2_ENV_BLOCK = `# STUDIO CHAT PARITY C2 (FRONTEND-1; chat parity round C2, Studio half; Director's C2 groups deck_ops and publish). Two switches, each on only for the string "true"; both default off, and then chat sends, socket handling, the viewer and the Builder page are
# byte for byte what they were. Build-time values: change them on Vercel and redeploy. Each pairs with Director's own flags (DIRECTOR_CHAT_PARITY_C2_ENABLED + MULTI_INTENT_ENABLED + the CHAT_CAP_<KEY> of each action; PK's OK first), and Director needs mdc1
# (NEXT_PUBLIC_CHAT_DIRECTIVES) as well; until Director's side is on nothing is ever sent. Studio shows no chat line of its own: Director closes each turn with its fixed line.
# NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS: advertises the client cap deckops1 and runs Director's deck_ops requests with the click paths' own handlers: start on a blank canvas, add a blank slide, change a slide's layout, go to a slide, rename / duplicate / delete the deck,
# present, view or edit mode, show or hide the slide rail. A write says done only when the viewer's or the server's own record shows it; delete runs only after Director's click card and never while a build runs.
NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS="false"
# NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH: advertises publish1 and runs Director's publish requests (publish, republish, unpublish, a new link, settings, copy or open the link) with the Publish dialog's own requests, never its wizard or a paid narration step.
# The click is Director's confirm card; the frame carries no token Studio can check, so leave this off until PK rules on it.
NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH="false"
`

/** The file with this change's edits put back (the previous text): the rewritten base lines, then every other marked line is dropped; a taught proof gets its previous lines back. Used by the strip and the proof. */
export function putBackChatParityC2(rel, text) {
  if (typeof text !== 'string') return text
  const pairs = CHAT_PARITY_C2_EDITS[rel] || CHAT_PARITY_C2_PIN_EDITS[rel] || CHAT_PARITY_C2_VOICE_CALL_PIN_EDITS[rel] || []
  const out = pairs.reduce((now, [has, was]) => now.replace(has, () => was), text)
  return CHAT_PARITY_C2_FILES.includes(rel) ? out.split('\n').filter(line => !CHAT_PARITY_C2_MARKER_RE.test(line)).join('\n') : out
}

/** The file without this change's edits; any other file is returned as it is. */
export function stripChatParityC2(rel, text) {
  if (typeof text !== 'string') return text
  if (!CHAT_PARITY_C2_FILES.includes(rel) && !(rel in CHAT_PARITY_C2_PIN_EDITS) && !(rel in CHAT_PARITY_C2_VOICE_CALL_PIN_EDITS)) return text
  return putBackChatParityC2(rel, text)
}
