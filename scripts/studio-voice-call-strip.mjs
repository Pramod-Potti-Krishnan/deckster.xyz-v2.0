// FRONTEND-1 (W6 P4-20 "Talk to the Director", the Studio voice call UI). Flag NEXT_PUBLIC_STUDIO_VOICE_CALL (the string "true", default off, build-time; ELEMENT-3's P4-19 core owns the .env.example line that names it) and
// NEXT_PUBLIC_STUDIO_VOICE_COMPANION (the pack folder under public/companions/, default "bob"). With the flag on: two call buttons (Audio, Video) right beside Send (the only things that ask for the microphone); while a call is on
// the composer is not drawn and a stage fills the chat column (the whole screen on a phone): VIDEO is the character large in its setting (the pack's scene image, else a token gradient), AUDIO is a calm scene with the face large and
// centred in a level ring, both with the state chip (Your turn / Listening / Thinking / Speaking), Stop / Mute / End, hold-to-talk or tap-to-talk (the button or Space), and a live transcript in the bottom fifth (scrollable, can be hidden);
// the character is driven by Director's frames. Speech goes in and out through a same-origin router contract (lib/studio-voice-call-router.ts), never direct.
// The Director side is DIRECTOR-2's P4-18 schema: client cap voice1, user_message data.mode "voice", payload.spoken and payload.companion_state.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker VOICE-CALL (matched as a whole token): app/builder/page.tsx (the hook call, the call stage, the composer prop, two lines at
// the end beside the flow-control import), hooks/use-deckster-websocket-v2.ts (one import, the frame tap, the two voice fields on the one armed voice turn, the sent tap) and components/builder/chat-input.tsx (two
// imports, one prop, its destructuring, the buttons beside Send, the line that hides the composer during a call). Strip the marked lines and each file is its base, byte for byte. No existing line of app code is rewritten.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports but the written-out list of the committed art (studio-voice-call-art-files.mjs), nothing read from disk or git here.
import { VOICE_CALL_ART_FILES } from './studio-voice-call-art-files.mjs'
export { VOICE_CALL_ART_FILES }

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
  'components/builder/voice-call/voice-call-stage.tsx',
  'components/builder/voice-call/voice-call-buttons.tsx',
  'components/builder/voice-call/voice-call.css',
  'docs/p4-20/VOICE-CALL-UI.md',
  'scripts/studio-voice-call-strip.mjs',
  'scripts/test-studio-voice-call.mjs',
  // P4-21: the end-to-end replay of DIRECTOR-2's P4-18 recordings (V0 typed, V1 and V2 voice) and the copies of the recorder's README and CONTRACT it reads
  'scripts/test-studio-voice-call-replay.mjs',
  'scripts/fixtures/studio-voice-call-replay/README.md',
  'scripts/fixtures/studio-voice-call-replay/CONTRACT.md',
  'scripts/fixtures/studio-voice-call-replay/scenario-V0.json',
  'scripts/fixtures/studio-voice-call-replay/scenario-V1.json',
  'scripts/fixtures/studio-voice-call-replay/scenario-V2.json',
  // P4-21b: Maya's layered face (Garud's v2 player port, b3a812e): the pure modules, the painter behind the player's seam, and their proof
  'lib/studio/voice-v2/companion-face.ts',
  'lib/studio/voice-v2/companion-compositor.ts',
  'lib/studio/voice-v2/companion-speech.ts',
  'lib/studio/voice-v2/call-face.ts',
  'lib/studio/voice-v2/index.ts',
  'components/builder/voice-call/layered-face.ts',
  'scripts/test-studio-voice-v2.mjs',
  'scripts/fixtures/studio-voice-v2/companion-face.test.ts',
  'scripts/fixtures/studio-voice-v2/companion-compositor.test.ts',
  'scripts/fixtures/studio-voice-v2/companion-speech.test.ts',
]

/** Older proofs one of this change's commits touched and a later one put back (the voice core's subject helper took over for the element-edit and deck-sync ones; the theme-export one is the core's own now (ad5b5232); the stage open gate's reads the page past every registered later change itself (laterStrips); the font-selection sandbox runs the socket hook unchanged, its voice line guards the flag with typeof): the history touches them, the tree does not change them. */
export const VOICE_CALL_PUT_BACK_FILES = ['scripts/test-studio-chat-element-edit.mjs', 'scripts/test-studio-deck-sync-truth.mjs', 'scripts/test-studio-chat-theme-export.mjs', 'scripts/test-theme-font-selection.mjs', 'scripts/test-studio-stage-open-gate.mjs']

/** The one edit of the voice core's strip module (its commit-subject helper also names this change's commits): the line carries the marker, the text before it is the core's own. */
export const VOICE_CALL_CORE_STRIP_EDIT = 'scripts/studio-voice-core-strip.mjs'
/** The dock and the one toolbar button the first design had (replaced by the stage and the two buttons beside Send): this change's earlier commits touched them, the tree has them no more. */
export const VOICE_CALL_RETIRED_FILES = ['components/builder/voice-call/voice-call-dock.tsx', 'components/builder/voice-call/voice-call-button.tsx']

/** Files this change edits that are neither marked app code nor new: its .env.example block, the registry (three lines), the core's subject helper (one marked edit) and the proofs its history touched. No package.json script: run the proof with `node scripts/test-studio-voice-call.mjs`. */
export const VOICE_CALL_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', VOICE_CALL_CORE_STRIP_EDIT, ...VOICE_CALL_PUT_BACK_FILES]

/** Every file this change's own commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const VOICE_CALL_SCOPE_FILES = new Set([...VOICE_CALL_FILES, ...VOICE_CALL_NEW_FILES, ...VOICE_CALL_OWN_EDITS, ...VOICE_CALL_RETIRED_FILES, ...VOICE_CALL_ART_FILES, 'scripts/studio-voice-call-art-files.mjs'])

/** The whole .env.example block (it follows ELEMENT-3's two lines, which hold NEXT_PUBLIC_STUDIO_VOICE_CALL=false). */
export const VOICE_CALL_ENV_BLOCK = `# STUDIO VOICE CALL UI (FRONTEND-1, W6 P4-20). The flag is NEXT_PUBLIC_STUDIO_VOICE_CALL, on the line just above (it is ELEMENT-3's P4-19 line): the exact value "true" enables it; anything else, including unset, is off, and then nothing changes: no
# buttons, no stage, no listener, no timer, no import of the voice core, and no microphone. Build-time value: change it on Vercel and redeploy. It needs the Studio shell. Set it only with Director's DIRECTOR_VOICE_CONTRACT_ENABLED (P4-18) and
# the router's speech routes (below) in place; without them the call opens and says plainly "Speech isn't connected yet".
# On: two call buttons, Audio and Video, sit right beside Send (one tap each). Tapping one is the only thing that asks for the microphone (getUserMedia); a refusal says why in plain words (the core's microphone help) with Try again.
# While a call is on the composer is not drawn: a stage fills the chat column (the whole screen on a phone). VIDEO is the character large in its setting (the pack's scene image, public/companions/<name>/scene.webp or the manifest's "scene" file,
# else a soft gradient out of the shell's tokens); AUDIO is a calm scene with the face large and centred in a level ring. Both have a state chip (Your turn / Listening / Thinking / Speaking), Stop, Mute and End, a talk button (hold it, or Space,
# and let go to send; or tap it to talk until you tap again), and a live transcript in the bottom fifth (scrollable, can be hidden). The words you say go as an ordinary user_message with data.mode "voice" and the client cap "voice1"; Director
# answers with its usual chat text and, in voice mode, payload.spoken and payload.companion_state. Only payload.spoken is said. Reduced motion draws one still per state.
# Speech in and out is two same-origin routes that call model-router (never a vendor from the browser): POST /api/studio/voice/transcribe (multipart audio, label studio.voice_stt, answers {"text"}) and POST /api/studio/voice/speak
# (JSON {"text","label":"studio.voice_tts"}, answers audio). Neither route exists yet (ELEMENT-3 / ROUTER-1).
# STUDIO VOICE COMPANION: the default character, the pack folder under public/companions/ (bird layout: motion/manifest.json, a Face pack beside it for the audio call's disc, an optional scene image for the video call; a pack may keep its
# companion clips in motion/companion.json, which is merged in). Lower-case letters, digits and dashes, up to 32; anything else is the default. Felix (the default), Bob and Maya are committed, and a person goes round them in the call
# (one tap on the character's name in its top bar, a dot for each; remembered on that device, localStorage). Maya is a v2 layered-face pack (her native Face catalog is face/ at her root): she is drawn in her compatibility view (her body poses,
# gestures, talk slots and blink; the mouth, eyes and brows do not change) until the v2 player lands. A pack that is missing or refused by the parser shows its portrait, and its initials when that is missing too.
NEXT_PUBLIC_STUDIO_VOICE_COMPANION="felix"
`

/** A commit of this change: its subject starts "Voice call:" (the older scope proofs that read first-parent subjects leave these out). */
export function isVoiceCallCommitSubject(value) {
  return String(value).trim().startsWith(VOICE_CALL_SUBJECT)
}

/** The registry text without this change's three lines (a later strip is read out of the registry itself by the proofs that check "the last registered line of its list"). */
export const VOICE_CALL_REGISTRY_MARK = "./studio-voice-call-strip.mjs')"

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out in the app files, and its three registry lines are taken out of the registry; every other byte stays. Any other file is returned as it is. */
export function stripVoiceCall(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === 'scripts/studio-later-changes.mjs') return text.split('\n').filter(line => !line.includes(VOICE_CALL_REGISTRY_MARK)).join('\n')
  if (!VOICE_CALL_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !VOICE_CALL_MARKER_RE.test(line)).join('\n')
}
