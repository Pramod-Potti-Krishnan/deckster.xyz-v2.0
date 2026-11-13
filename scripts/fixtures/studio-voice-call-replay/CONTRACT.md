# W6 voice contract: the Director half (P4-18)

For FRONTEND-1 and ELEMENT-3. Branch `seat2/director-p4-18-voice`, switch `DIRECTOR_VOICE_CONTRACT_ENABLED` (default off; `/health` shows it and `..._RAW_PRESENT`).
The Director never touches audio. It sees text, and it adds two small fields to frames it already sends. Nothing else about a turn changes: same routing, same replies, same cards, same builds, same frame order.

## 1. What Studio sends

A normal `user_message` with two extras, both Studio's to set:

```json
{"type": "user_message", "data": {"text": "<the transcript>", "mode": "voice", "client_caps": ["mdc1", "...", "voice1"]}}
```

- A turn counts as a voice turn only if the flag is on, `data.mode` is exactly `"voice"`, and `voice1` is in `client_caps` (this message's list, else the last list the session sent). Otherwise `mode` is ignored.
- The connection (socket) is then in **voice mode**. The next message on that socket without `mode: "voice"` (typed text, a button click) ends it, and so does closing the socket. A second tab, or a reconnect, starts out of voice mode until its first voice turn.
- A spoken answer to a card (a "yes" to the plan) goes as the card's own text plus its `action_value`, with `mode: "voice"` (PROVISIONAL: recorded in V1, turn 3).
- Typed `pause` / `stop` / `resume` sent while a build runs are answered before the voice check runs: they use the mode the connection already has.

## 2. Where the fields go (FINAL)

Both fields are inside the frame's `payload` object: `payload.spoken` (string) and `payload.companion_state` (string). Never at the top level of the frame.
Only on a connection in voice mode; every other frame, and every frame when the flag is off, is byte-identical to today. No new frame types. `listening` is never sent.
History and reconnect replay (`sync_response`) never carry them: they exist only on live frames.

## 3. Which frames carry what

| frame | `spoken` comes from | `companion_state` |
|---|---|---|
| `chat_message` (a reply) | `payload.text` | `reporting` |
| `chat_message` with `ephemeral: true` (progress narration) | never | `working` |
| `action_request` (cards, clarifying questions) | `payload.prompt_text` | `waiting` |
| `status_update` | `payload.text` | by `payload.status`: thinking `thinking`*, generating `working`, error `concerned`, idle / complete none |
| `build_phase` | `payload.label` | by `payload.phase`: planning, strawman, building, qa, finalizing `working`; complete `pleased`; paused `waiting`; stopped, error `concerned`; settled none |
| `build_event`, `scope: "deck"` | `payload.text` | by `payload.status`: started, progress `working`; error `concerned`; done none |
| `build_event`, `scope: "slide"` | never (too many) | same as above |
| `slide_progress` | never | `working` |
| `slide_built` | never | `pleased` |
| `slide_failed` | never | `concerned` |

\* `thinking` only before any reply text (a `chat_message` or `action_request`) of the current voice turn; a thinking status after one carries no state.
A frame that is not in the table is untouched. A frame in the table can carry a state and no `spoken` (generic or repeated text), or `spoken` and no state.
The Director's honest "I can't do that yet" arrives as an ordinary `chat_message`, so it is `reporting`; the failure states come from the failure frames above.

## 4. How `spoken` is made (no model call, same text gives the same line)

- Replies and cards (at most 240 chars): markdown, tables, code, emoji and URLs removed (link text kept); heading and bold-only label lines dropped when there is other text; the first sentence, plus the second if the total fits.
  If the text ends with a question, that question (the run of questions at the end) is always included, so a clarifying question is heard; if everything does not fit, the first sentence plus the last question, else the last question alone. Cuts fall on a word boundary with no dangling "and" / "the". Empty text: no `spoken` key.
- Progress lines (at most 120 chars): same stripping, one line, no trailing "..." or "…", and with parenthetical and bracketed asides removed ("Composing 10 slides (v2 path)..." is spoken "Composing 10 slides"; a trailing "-", "—" or ":" left behind is dropped). A reply or card keeps its parentheses.
- **Never spoken:** generic lines (`thinking`, `working`, `generating`, `processing`, `loading`, `please wait`, `one moment`, `just a moment`, `working on it`, `still working`, `hold on`; any case, with or without dots or an ellipsis), empty text, a progress line that is empty or generic once its asides are removed (`(v2 path)`, `Working [stage_e]...`), slide-scoped build lines, and a progress line equal to the last one spoken on this connection (compared after cleaning; a reply does not reset that).

## 5. What stays on the client

`listening` (and any state the mic drives), filler lines ("Mm, one sec."), talking over or stopping speech (barge-in), when to speak a progress line (Garud's rules: a status only after about 4 s of waiting, at most one every 6 s, "Still working on it." at 12 s),
which of several `spoken` lines to say when frames arrive together (a card's `spoken` right after a reply's), speech-to-text and text-to-speech and their models, the per-call cost cap, and ending a call. The Director sends a line for most progress frames; the client decides what is worth saying.

## 6. Examples (from `out/scenario-V1.json` and `scenario-V2.json`, payloads trimmed)

```json
{"type": "action_request", "payload": {"prompt_text": "Happy to help you pitch this. A few quick questions so I can tailor it:\n\n• Who is in the room, ...", "actions": [], "question_set": {},
  "spoken": "Happy to help you pitch this. A few quick questions so I can tailor it: Who is in the room, and how many people? How long should the deck be? What should leadership take away or decide?", "companion_state": "waiting"}}
{"type": "status_update", "payload": {"status": "thinking", "text": "Analyzing presentation strategy...", "spoken": "Analyzing presentation strategy", "companion_state": "thinking"}}
{"type": "build_phase", "payload": {"phase": "building", "label": "Building your slides…", "slide_count": 10, "spoken": "Building your slides", "companion_state": "working"}}
{"type": "build_event", "payload": {"scope": "deck", "stage": "outline", "status": "progress", "text": "Drafting the deck outline…", "spoken": "Drafting the deck outline", "companion_state": "working"}}
{"type": "slide_built", "payload": {"slide_index": 0, "slide_count": 10, "companion_state": "pleased"}}
{"type": "chat_message", "payload": {"text": "🎉 Your presentation is ready!\n\n**Pitch for a new customer onboarding flow** - 10 slides\n\n[View Presentation](...)", "ephemeral": false,
  "spoken": "Your presentation is ready! Pitch for a new customer onboarding flow - 10 slides.", "companion_state": "reporting"}}
{"type": "slide_failed", "payload": {"kind": "compose", "status": "error", "companion_state": "concerned"}}
```

Typed turns and clients without `voice1` see none of this: `out/scenario-V0.json` (typed, flag on) is byte-identical to a flag-off run, and `out/identity-check.json` has the digests.

## 7. Testing against the branch

Run a Director from this branch with `DIRECTOR_VOICE_CONTRACT_ENABLED=true`, connect with `voice1` in `client_caps`, send `mode: "voice"` on the voice turns. Or replay `out/*.json`: every frame in order with relative ms.
