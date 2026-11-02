# P4-20 Studio voice call UI

Branch `frontend1/p4-20-call-ui`, based on Studio `abf52d4d`, with ELEMENT-3's `element3/p4-19-voice-core` (1d1327f4) merged in because the UI needs its modules to compile. Flag `NEXT_PUBLIC_STUDIO_VOICE_CALL` (exact `"true"`, default off, build-time). Optional `NEXT_PUBLIC_STUDIO_VOICE_COMPANION` (pack folder name, default `bob`).

## What it is

| Piece | File |
| --- | --- |
| Pure decisions (flag, wire, frame to scene, scene to clips, framing, words). Import-free, tested offline. | `lib/studio-voice-call-ui.ts` |
| The seam to model-router (hearing, speaking), two same-origin routes. | `lib/studio-voice-call-router.ts` |
| One call's life: microphone, turn-taking (ELEMENT-3's `reduceCall`), speech queue, Director's frames. Everything browser-side is injected. | `lib/studio-voice-call-controller.ts` |
| The browser's microphone, recorder, speaker, clock. | `lib/studio-voice-call-browser.ts` |
| The page's hook (loads the controller on demand, Space key, session change). | `hooks/use-studio-voice-call.ts` |
| Dock, companion player (canvas, bird-layout packs), composer call button, stylesheet. | `components/builder/voice-call/` |
| Marked `// VOICE-CALL` lines | `app/builder/page.tsx`, `hooks/use-deckster-websocket-v2.ts`, `components/builder/chat-input.tsx` |

With the flag off nothing is loaded, listened to, timed or asked for; strip the marked lines and each existing file is the base's, byte for byte.

## The contract it follows (P4-18, DIRECTOR-2's final schema, `DIRECTOR_VOICE_CONTRACT_ENABLED`)

- Studio to Director: a voice turn is an ordinary `user_message` whose `text` is the transcript, plus `data.mode: "voice"` and the cap `voice1` in `client_caps` (after the other caps). A typed message has no mode, so it ends voice mode on the Director's side.
- A spoken answer to a card (PROVISIONAL): when an `action_request` with buttons is open and the transcript is a clear yes or no (or a button's own label), the page's own button click is made with mode "voice": the card's text and its `action_value`. `matchSpokenAnswer` is pure and tested; anything that is not a clear match goes as an ordinary voice message. A button that asks for typed input is never pressed by voice.
- Director to Studio (voice mode only, existing frames): `payload.spoken` on `chat_message` and `action_request` (the reply, the card, all the clarifying questions; up to about 240 characters) and on `status_update` / `build_phase` / deck-scope `build_event` (about 120 characters); `payload.companion_state` (`thinking | working | reporting | pleased | concerned | waiting`; `listening` is client-only).
- Studio speaks only `payload.spoken`; nothing is made up from the chat text. Replies and cards are said at once (chunk by chunk); progress lines follow Garud's rules (said after 4 s of quiet, at most one every 6 s, only the newest, dropped after 20 s). It drives the character from `companion_state` when present, from the frame's type when not.

## Speech in and out (the router contract; the routes do not exist yet)

ROUTER-1's transport contract (via the core's `docs/p4-19/VOICE-CORE.md`): the calls belong in Studio's SERVER adapter, which holds the router key; the browser never does. Hearing is the router's chat/completions with `input_audio` as base64 WAV (task `studio.voice_stt`); speaking is the router's audio/speech (task `studio.voice_tts`, audio plus `x-generation-id`). So the call is written against two same-origin routes:

- `POST /api/studio/voice/transcribe`: multipart `audio` (a WAV, 16 kHz, mono, 16-bit: the capture layer in `lib/studio-voice-call-browser.ts` decodes what the recorder produced and converts it) and `label: studio.voice_stt`; answers `{ "text" }`.
- `POST /api/studio/voice/speak`: JSON `{ "text", "label": "studio.voice_tts" }`; answers audio.
- Either answer may carry the optional header `X-Deckster-Cost-Usd`; the call keeps the core's `CallCostMeter` and adds `null` when it is not there (never zero). The per-call cap is P4-22's.

404, 501 and 503 read as "Speech isn't connected yet", 402 and 429 as a limit. Neither route exists on this branch; tests and shots answer them locally.

## Companion packs

`public/companions/<name>/` in the bird layout (`motion/manifest.json`, `motion/face/manifest.json` for the disc). Not committed here: Garud delivers the real packs. A missing or invalid pack leaves a plain disc with initials. Clips a pack lacks fall back through the core's `resolveCompanionClip`.

## Behaviour worth knowing

- The microphone is asked for by the call button and nothing else (`getUserMedia` appears once, in `lib/studio-voice-call-browser.ts`, called from `startCall`). A refusal says why in the core's words (`describeMicError`) with Try again. The same click unlocks the speaker.
- Hold the talk button or Space (Space is left to a focused text field, button, link or menu item, except the call's own buttons). Talking over the Director, or Stop, cancels its speech and the turn that is pending; the reply to a cancelled turn is in the chat and is not said.
- A reply's first line waits half a second, so the gesture (present, sorry, concerned) is seen before the voice; a beat that speech hid (a celebration, a failure) is shown after it. A failure is not covered by the report that explains it.
- Reduced motion draws one still per state. A missing pack leaves a plain disc with initials.
- Voice mode on the Director's side ends with the next typed message; the next voice turn starts it again.
