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

222 tests pass: 190 source cases, one flag case covering six values, 13 optional companion clip cases, 15 gesture fallback/decode cases, and three exact proof-compatibility cases. The seven source suites are carried across; the avatar rig suite omits its one unrelated roster/palette case. Microphone-help and cost-meter describe blocks are extracted from the broader source input/cost suites, without their server/database/provider imports. No voice provider integration is claimed.

## P4-20 wiring notes

- Initialize `initialCallState()`. Push-to-talk maps to `{ type: "talk_start", source: "ptt" }` / `{ type: "talk_end", source: "ptt", keep }`; `worthSending` can decide `keep`.
- `reduceCall` returns `{ state, effects }`. `send_recording` means the UI should transcribe through its server/router adapter and send the final transcript to Director. There is no speech recognition in the pure reducer.
- Feed streamed text to the chunker and enqueue its returned sentences with the UI's injected audio player. On playback send `audio_started` with the current `turn`; at text completion send `reply_done`; once its sentence queue finishes send `audio_drained`. The UI owns per-sentence start/end callbacks and measured output amplitude.
- `skip`, `end`, and barge-in emit cancellation/teardown effects. The audio owner must stop playback and cancel pending requests before starting the next recording. Ignore late results by turn ID.
- `turn_failed` recovers the machine; keep user-facing error information separately in UI state. There is no additional `error` phase in the ported source reducer.
- Fetch and validate the manifest in the UI before constructing `BirdMotionRig`. Call `step(dt, { state, level })`; drive `AvatarRig` with the same state/level. The UI owns URL loading, decoded frame availability, animation scheduling, tab visibility, reduced-motion preference and canvas/DOM updates. Play full-frame gestures in sentence gaps so speech and gestures take turns.

## Existing Studio proofs

The port registers its additive files, environment block and exact test-manifest additions with `scripts/studio-later-changes.mjs`. `studio-voice-core-strip.mjs` removes only those known additions when older proofs compare their source snapshots. One older first-parent commit-scope proof is taught the voice port's commit subjects; its original runtime and source assertions remain intact. Exact-strip tests check that unrelated dependency versions and source assertions remain visible. The dependency entry sits before TypeScript so the base's final dependency line retains its original comma behavior.
