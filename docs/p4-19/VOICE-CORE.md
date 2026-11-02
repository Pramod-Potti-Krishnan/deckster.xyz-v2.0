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

STT and TTS must go through model-router. No provider SDK, speech route, server key lookup, catalog, rate limiter, or usage database code is copied. The router adapter and call orchestration are integration work for P4-20 / ROUTER-1. Do not use browser speech synthesis as a fallback to bypass the router. Director receives text only, using the P4-18 `voice1` contract; Director progress lines must come from its existing status frames.

The character specification's additional clips are optional parser names: `lean_in`, `work_loop`, `look_down`, `one_moment`, `invite`, `hold`, `point_left`, `point_right`, `emphasis`, `shrug`, `thank_you`, `count`, `celebrate`. Older packs retain their required clip set and existing fallback behavior. Registering these names validates incoming packs; it does not add Director state orchestration or invent missing artwork. FRONTEND-1 owns the state-to-clip adapter and presentation choreography.

## Source and tests

Ported from the local voice core at source revision `d05252905f5f2ced9771d1138f7f8725fca2e343`, with per-file SHA-256 inventory in `source-inventory.json` (the working files are authoritative if they differ from that revision). Product wording is relabelled; the rig only needs gesture types, so the organization/bird roster and palettes are omitted.

Run `pnpm test:studio-voice-core` after installing locked dependencies. Vitest is test-only. All fixtures are generated values, fake clocks, in-memory phrase fetchers and synthetic manifests: no real audio or paid calls.

204 assertions-as-tests pass: 190 source cases, one flag case covering six values, and 13 optional companion clip cases. The seven source suites are carried across; the avatar rig suite omits its one unrelated roster/palette case. Microphone-help and cost-meter describe blocks are extracted from the broader source input/cost suites, without their server/database/provider imports. No voice provider integration is claimed.
