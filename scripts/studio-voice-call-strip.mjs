// FRONTEND-1 (W6 P4-20 "Talk to the Director", the Studio voice call UI). Flag NEXT_PUBLIC_STUDIO_VOICE_CALL (the string "true", default off, build-time; ELEMENT-3's P4-19 core owns the .env.example line that names it) and
// NEXT_PUBLIC_STUDIO_VOICE_COMPANION (the pack folder under public/companions/, default "bob"). With the flag on: a call button in the composer's toolbar (the only thing that asks for the microphone), a companion
// docked in the chat column above the composer (a face disc of 88 px, 64 px on a phone, that opens to a 240 px chest view) with the state chip (Your turn / Listening / Thinking / Speaking), push-to-talk (hold the
// button or Space), Stop and talking over it, and the character driven by Director's frames. Speech goes in and out through a same-origin router contract (lib/studio-voice-call-router.ts), never direct.
// The Director side is DIRECTOR-2's P4-18 schema: client cap voice1, user_message data.mode "voice", payload.spoken and payload.companion_state.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker VOICE-CALL (matched as a whole token): app/builder/page.tsx (the hook call, the dock, the composer prop, two lines at
// the end beside the flow-control import), hooks/use-deckster-websocket-v2.ts (one import, the frame tap, the two voice fields on the one armed voice turn, the sent tap) and components/builder/chat-input.tsx (two
// imports, one prop, its destructuring, the button). Strip the marked lines and each file is its base, byte for byte. No existing line of app code is rewritten.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'abf52d4d4858b24cdb62549325ae5b9eed36624e' // origin/studio-v4-dev-preparation-code (#554 merged) at the start of this change
export const VOICE_CALL_FLAGS = ['NEXT_PUBLIC_STUDIO_VOICE_CALL', 'NEXT_PUBLIC_STUDIO_VOICE_COMPANION']
export const VOICE_CALL_MARKER = 'VOICE-CALL'
/** The marker as a WHOLE token: VOICE-CALL-X and X-VOICE-CALL are not this change's. */
export const VOICE_CALL_MARKER_RE = /(?<![\w-])VOICE-CALL(?![\w-])/
/** The subject prefix of this change's own commits (the proof reads these, not the merge of ELEMENT-3's core that this branch needs to compile). */
export const VOICE_CALL_SUBJECT = 'Voice call:'

/** Existing files that get marked lines (pure insertions only). */
export const VOICE_CALL_FILES = ['app/builder/page.tsx', 'hooks/use-deckster-websocket-v2.ts', 'components/builder/chat-input.tsx']

/** New files (no base text to put back). */
export const VOICE_CALL_NEW_FILES = [
  'lib/studio-voice-call-ui.ts',
  'lib/studio-voice-call-router.ts',
  'lib/studio-voice-call-controller.ts',
  'lib/studio-voice-call-browser.ts',
  'hooks/use-studio-voice-call.ts',
  'components/builder/voice-call/companion-player.tsx',
  'components/builder/voice-call/voice-call-dock.tsx',
  'components/builder/voice-call/voice-call-button.tsx',
  'components/builder/voice-call/voice-call.css',
  'docs/p4-20/VOICE-CALL-UI.md',
  'scripts/studio-voice-call-strip.mjs',
  'scripts/test-studio-voice-call.mjs',
]

/**
 * Older proofs this change teaches, each by marked lines (the strip puts the file back): the stage open gate's robustness check (an import and one replaced line: a real later change in the page). The font-selection sandbox is not taught: the
 * socket hook's one flag-gated line guards the flag with typeof, so the sandbox runs it unchanged. NOT taught: the chat theme export proof, which fails on the voice core's own head (e324183b) because of the core's lines in the stacked test files; that is the core's to teach (see the report), and editing it here would
 * make the model catalog and narration router proofs, which police its added lines, fail as well. The older scope proofs that read first-parent commit subjects (chat element edit, deck sync truth) are taught nothing here: the voice core's subject helper (isVoiceCoreCommitSubject)
 * also leaves out "Voice call:" (one marked edit of scripts/studio-voice-core-strip.mjs, VOICE_CALL_CORE_STRIP_EDIT).
 */
export const VOICE_CALL_PIN_FILES = ['scripts/test-studio-stage-open-gate.mjs']

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines) and the older proofs it teaches. No package.json script: run the proof with `node scripts/test-studio-voice-call.mjs`. */
/** An older proof taught by REPLACING one whole line (the line now carries the marker; the strip puts the old line back): the stage open gate's "robust after a later change" check reads the page past a synthetic change's lines, and this is a real one. */
export const VOICE_CALL_PIN_EDITS = {
  'scripts/test-studio-stage-open-gate.mjs': [
    [
      "  pageWiring(stripVoiceCall(PAGE, later)) // VOICE-CALL, LATER-CHANGES: registry read (VOICE-CALL): the page read past the synthetic change's lines is also read past a REAL later change's (the voice call UI marks lines in the page)\n",
      '  pageWiring(later)\n',
    ],
  ],
}

/** Four older proofs one of this change's commits taught and a later one put back (the voice core's subject helper took over for the first two; the third is the core's to teach; the fourth needs no teaching: the socket hook's voice line guards the flag with typeof): the history touches them, the tree does not change them. */
export const VOICE_CALL_PUT_BACK_FILES = ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-theme-font-selection.mjs']

/** The one edit of the voice core's strip module (its commit-subject helper also names this change's commits): the line carries the marker, the text before it is the core's own. */
export const VOICE_CALL_CORE_STRIP_EDIT = 'scripts/studio-voice-core-strip.mjs'
export const VOICE_CALL_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', VOICE_CALL_CORE_STRIP_EDIT, ...VOICE_CALL_PIN_FILES, ...VOICE_CALL_PUT_BACK_FILES]

/** Every file this change's own commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const VOICE_CALL_SCOPE_FILES = new Set([...VOICE_CALL_FILES, ...VOICE_CALL_NEW_FILES, ...VOICE_CALL_OWN_EDITS])

/** The whole .env.example block (it follows ELEMENT-3's two lines, which hold NEXT_PUBLIC_STUDIO_VOICE_CALL=false). */
export const VOICE_CALL_ENV_BLOCK = `# STUDIO VOICE CALL UI (FRONTEND-1, W6 P4-20). The flag is NEXT_PUBLIC_STUDIO_VOICE_CALL, on the line just above (it is ELEMENT-3's P4-19 line): the exact value "true" enables it; anything else, including unset, is off, and then nothing changes: no
# button, no dock, no listener, no timer, no import of the voice core, and no microphone. Build-time value: change it on Vercel and redeploy. It needs the Studio shell. Set it only with Director's DIRECTOR_VOICE_CONTRACT_ENABLED (P4-18) and
# the router's speech routes (below) in place; without them the call opens and says plainly "Speech isn't connected yet".
# On: a call button sits last in the composer's toolbar. Tapping it is the only thing that asks for the microphone (getUserMedia); a refusal says why in plain words (the core's microphone help) with Try again. The call docks the companion above the
# composer: an 88 px face disc (64 px on a phone) that opens to a 240 px chest view, a state chip (Your turn / Listening / Thinking / Speaking), hold-to-talk (the button or Space, never inside a text field), Stop and End. The words you say go as
# an ordinary user_message with data.mode "voice" and the client cap "voice1"; Director answers with its usual chat text and, in voice mode, payload.spoken and payload.companion_state. Only payload.spoken is said. Reduced motion draws one still per state.
# Speech in and out is two same-origin routes that call model-router (never a vendor from the browser): POST /api/studio/voice/transcribe (multipart audio, label studio.voice_stt, answers {"text"}) and POST /api/studio/voice/speak
# (JSON {"text","label":"studio.voice_tts"}, answers audio). Neither route exists yet (ELEMENT-3 / ROUTER-1).
# STUDIO VOICE COMPANION: the character's pack folder under public/companions/ (bird layout: motion/manifest.json, a Face pack beside it for the disc). Lower-case letters, digits and dashes, up to 32; anything else is the default. A missing or invalid pack
# leaves a plain disc with initials. Garud delivers the packs; Bob is the first.
NEXT_PUBLIC_STUDIO_VOICE_COMPANION="bob"
`

/** A commit of this change: its subject starts "Voice call:" (the older scope proofs that read first-parent subjects leave these out). */
export function isVoiceCallCommitSubject(value) {
  return String(value).trim().startsWith(VOICE_CALL_SUBJECT)
}

/** The registry text without this change's three lines (a later strip is read out of the registry itself by the proofs that check "the last registered line of its list"). */
export const VOICE_CALL_REGISTRY_MARK = "./studio-voice-call-strip.mjs')"

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out in the app files and in the older proofs it teaches, and its three registry lines are taken out of the registry; every other byte stays. Any other file is returned as it is. */
export function stripVoiceCall(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') return text.split('\n').filter(line => !line.includes(VOICE_CALL_REGISTRY_MARK)).join('\n')
  if (!VOICE_CALL_FILES.includes(rel) && !VOICE_CALL_PIN_FILES.includes(rel)) return text
  const put = rel in VOICE_CALL_PIN_EDITS ? VOICE_CALL_PIN_EDITS[rel].reduce((out, [has, was]) => out.replace(has, () => was), text) : text // a replaced line goes back first (it carries the marker too)
  return put.split('\n').filter(line => !VOICE_CALL_MARKER_RE.test(line)).join('\n')
}
