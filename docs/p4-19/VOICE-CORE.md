# P4-19 Director voice core

Branch: `element3/p4-19-voice-core`, based on Studio `abf52d4d`.

Client entry point: `@/lib/studio/voice`. No module reads keys, contacts a provider, records audio, plays audio, starts a timer, or starts an animation on import.

`STUDIO_VOICE_CALL_ENABLED` reads `NEXT_PUBLIC_STUDIO_VOICE_CALL === "true"`. Unset, empty, false, numeric and malformed values stay off. FRONTEND-1 must check it before mounting call UI or acquiring a microphone. This port adds no mounted UI, route, request or existing runtime import, so flag-off Studio behavior stays unchanged.

| Module | Consumer responsibility |
| --- | --- |
| sentences | Feed text deltas to `SentenceChunker`; flush at end/tool pause. Send each cleaned sentence through the router speech seam. |
| vad | Feed explicit samples/time to `EnergyVad`; push-to-talk first. The consumer owns microphone permission, echo cancellation and track release. |
| call-state | Apply `reduceCall`; execute returned effects. Keep turn IDs so late results after interruption are ignored. |
| turns | Filler and progress timing, acknowledgement detection, phrase choice and an injected phrase cache. Cache only canned lines, never user recordings or generated replies. |
| tone | Cheap local mood and opening-gesture hints. Full reply text remains authoritative. |
| avatar-rig | Pure seeded pose maths, gestures, arm geometry and reduced-motion behavior. Consumer owns drawing and animation scheduling. |
| bird-motion | v1 manifest validation, frame/viseme timing, decoded-clip ledger, expression sequences and fallback behavior. Bird names are format compatibility identifiers. |
| gestures | Shared moment and gesture types, without a product-specific bird roster or organization model. |
| mic-errors | Plain Deckster microphone recovery text; `macApp` is supplied explicitly by the host. |
| format | Duration, recording MIME selection, price parsing and running cost meter. Missing price remains unknown. `COST_HEADER` is `X-Deckster-Cost-Usd`, for a future Studio/router adapter to agree on. |

STT and TTS must go through model-router. No provider SDK, speech route, server key lookup, catalog, rate limiter, or usage database code is copied. The router adapter and call orchestration are integration work for P4-20 / ROUTER-1. Do not use browser speech synthesis as a fallback to bypass the router. Director receives text only: advertise `voice1` in `client_caps` and send the final transcript as an ordinary `user_message` with `mode: "voice"`. P4-18 supplies `payload.spoken` and `payload.companion_state` on existing frames; a typed message or disconnect ends voice mode. Use `spoken` for router speech and preserve full chat text. Progress lines must come from those existing frames. The core does not parse or invent Director frames.

The character specification's additional clips are optional parser names: `lean_in`, `work_loop`, `look_down`, `one_moment`, `invite`, `hold`, `point_left`, `point_right`, `emphasis`, `shrug`, `thank_you`, `count`, `celebrate`. Older packs retain their required clip set and existing fallback behavior. `resolveCompanionClip(manifest, name)` and `BirdMotionRig.gestureClip(name, at?)` accept UI clip hints with nearest legacy fallbacks (unknown hints use nod). Supplied clips get the normal decode grace before falling back. Registering these names does not add Director state orchestration or invent missing artwork. FRONTEND-1 owns the state-to-clip adapter and presentation choreography.

## Source and tests

Ported from the local voice core at source revision `d05252905f5f2ced9771d1138f7f8725fca2e343`, with per-file SHA-256 inventory in `source-inventory.json` (the working files are authoritative if they differ from that revision). Product wording is relabelled; the rig only needs gesture types, so the organization/bird roster and palettes are omitted.

Run `pnpm test:studio-voice-core` after installing locked dependencies. Vitest is test-only. All fixtures are generated values, fake clocks, in-memory phrase fetchers and synthetic manifests: no real audio or paid calls.

225 tests pass: 190 source cases, one flag case covering six values, 13 optional companion clip cases, 15 gesture fallback/decode cases, and six exact proof-compatibility cases. The seven source suites are carried across; the avatar rig suite omits its one unrelated roster/palette case. Microphone-help and cost-meter describe blocks are extracted from the broader source input/cost suites, without their server/database/provider imports. No voice provider integration is claimed.

## P4-20 wiring notes

- Initialize `initialCallState()`. Push-to-talk maps to `{ type: "talk_start", source: "ptt" }` / `{ type: "talk_end", source: "ptt", keep }`; `worthSending` can decide `keep`.
- `reduceCall` returns `{ state, effects }`. `send_recording` means the UI should transcribe through its server/router adapter and send the final transcript to Director. There is no speech recognition in the pure reducer.
- Feed streamed text to the chunker and enqueue its returned sentences with the UI's injected audio player. On playback send `audio_started` with the current `turn`; at text completion send `reply_done`; once its sentence queue finishes send `audio_drained`. The UI owns per-sentence start/end callbacks and measured output amplitude.
- `skip`, `end`, and barge-in emit cancellation/teardown effects. The audio owner must stop playback and cancel pending requests before starting the next recording. Ignore late results by turn ID.
- `turn_failed` recovers the machine; keep user-facing error information separately in UI state. There is no additional `error` phase in the ported source reducer.
- Fetch and validate the manifest in the UI before constructing `BirdMotionRig`. Call `step(dt, { state, level })`; drive `AvatarRig` with the same state/level. The UI owns URL loading, decoded frame availability, animation scheduling, tab visibility, reduced-motion preference and canvas/DOM updates. Play full-frame gestures in sentence gaps so speech and gestures take turns.

## Existing Studio proofs

The port registers its additive files, environment block and exact test-manifest additions after all earlier changes (the ordering is tested) with `scripts/studio-later-changes.mjs`. `studio-voice-core-strip.mjs` removes only those known additions when older proofs compare their source snapshots. Older first-parent commit-scope proofs are taught the voice port's bounded commit subjects, with git output whitespace normalized. Raw metadata readers remove only this port's known test script, dev dependency and lockfile hunks before applying their existing comparisons. All taught proof files restore to their original baseline bytes; their original assertions remain intact. Exact-strip tests check that unrelated dependency versions, lockfile edits and source assertions remain visible. The registration-order check compares against the preceding stage-gate feature, so future registered features can follow this one. The dependency entry sits before TypeScript so the base's final dependency line retains its original comma behavior.

## Director recorded-frame check

The P4-18 final contract and fixtures are in the program workspace at `streams/director2/p4-18-voice/`. `action_request` question cards carry `payload.spoken`; an honest decline is `reporting`, while failure frames carry `concerned`. Replay/history frames carry neither voice field. The plan-card `action_value` mapping remains a P4-20 integration decision.

A local text-only replay through this chunker preserved all 21 spoken lines in V1 and all 24 in V2, including every question card. Typed V0 contained zero spoken lines. This validates recorded input handling, not connected operation or audio latency. Fixture hashes and results are included in the final comparison evidence.

## Router transport contract received from ROUTER-1

ROUTER-1's router MR !49 provides labels `studio.voice_stt` and `studio.voice_tts`. Calls belong in Studio's server adapter, using the existing studio proxy-scoped router key and identity headers; provider keys stay server-only.

- STT uses router `POST /v1/chat/completions` with `X-MR-Service: studio`, `X-MR-Task: studio.voice_stt`, a concrete configured audio-capable model, and `input_audio` with base64 WAV. The transcript is `choices[0].message.content`. The router has no transcription endpoint; do not call `/audio/transcriptions`. The capture layer must produce the agreed WAV input; these pure modules do not record or convert audio.
- TTS uses router `POST /v1/audio/speech`, task `studio.voice_tts`, a concrete configured narration model, sentence `input`, `voice`, and `response_format` mp3 or pcm. The response is audio bytes with its Content-Type and `x-generation-id`.
- `COST_HEADER` is an optional normalized Studio-adapter header, not a claim that the router returns a USD header. The adapter can resolve available billing metadata server-side; add `null` to the meter while cost is unknown. Never infer that an unknown cost is zero.

The exact model defaults, request fixtures and ledger rows are owned by ROUTER-1 in `tests/test_voice_and_author_labels.py` and `docs/changes/ROUTER3-voice-and-author-mode-labels.md` on its MR !49 branch. Only mocks/recorded frames have been used here; a real audio probe needs the separately authorized P4-22 step.
