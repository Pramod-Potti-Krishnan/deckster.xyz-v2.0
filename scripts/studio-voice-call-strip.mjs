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

/** Files this change edits that are neither marked app code nor new: its .env.example block and the registry (three lines). No package.json script: run the proof with `node scripts/test-studio-voice-call.mjs`. */
export const VOICE_CALL_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

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

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripVoiceCall(rel, text) {
  if (typeof text !== 'string') return text
  if (!VOICE_CALL_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !VOICE_CALL_MARKER_RE.test(line)).join('\n')
}
