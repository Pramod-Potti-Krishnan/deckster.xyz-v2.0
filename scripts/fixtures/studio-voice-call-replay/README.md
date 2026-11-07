# P4-18 voice contract: recorded Director frames ($0, offline)

Recorded by `p418/record.py` (derived from DIRECTOR-2's `pk-f03/record.py`) against the REAL Director code of branch `seat2/director-p4-18-voice`
(head `3d32637e7baa`, base origin/uat `501e1e53cb1dc6e59f1678710f9a7e3506828fb2`). Provider keys unset, no network, nothing sent to UAT, prod, Supabase or a model.
The contract itself is in `CONTRACT.md`. These files are for FRONTEND-1 / ELEMENT-3 to develop against.

## Files
- `scenario-V1.json`: the voice dialogue, flag ON (68 outbound, 3 inbound; 21 frames with `spoken`, 44 with `companion_state`).
- `scenario-V2.json`: V1, then two more voice turns: an ask the Director honestly declines, and an add-slide whose background job fails (74 outbound, 5 inbound; 24 frames with `spoken`, 48 with `companion_state`).
- `scenario-V0.json`: the V1 dialogue TYPED (no `mode` on any message), flag ON, client still sends `voice1` (68 outbound, 3 inbound; 0 frames with `spoken`, 0 with `companion_state`). Byte-identical to flag off.
- `identity-check.json`: the digests behind the identity table below.
Every file: every frame in order (`frames[]`: `seq`, `turn`, `direction`, `t_ms`, `dt_ms`, `frame`), ids and timestamps normalised (`<id#n>`, `<ts>`) with ORDER and
relative ms kept, `voice_table[]` (per outbound frame: `spoken`, `companion_state`), the flag set, the base sha, `stage_timeline`, `run_notes`.
`t_ms` is offline wall-clock (every provider is a zero-latency stub, the Slide Builder poll interval is shortened): ORDER and relative spacing only, not UAT latency.

## What is real and what is stubbed
Real (production code): `WebSocketHandler()`, `handle_connection` (connect + receive loop), `_process_message_off_loop` / `_process_message` (where the voice hook sits),
the `DecisionEngine.decide()` prompt cards and guard layer (G12 "can't yet" coerces the V2 decline), `_handle_ask_questions` / `_handle_propose_plan` /
`_handle_generate_strawman` (Stage 4a v3 and 4b, V2 packaging), the auto-proceed gate (F-11 under the J1 guard), `_handle_content_generation` -> the real
`SlideBuilderClient`, `handle_sb_progress`, `BuildNarrator`, `SessionManagerV4`, `voice_contract` (the code under test) and the socket-level decoration.
Stubbed (outside world only): every model (decision agent scripted, one decision per model turn; Strategic Analyzer on a `FunctionModel`; Stage 3 brief; Stage 4a outline;
narrative framework), Layout / Deck Builder (blank + outline presentation), Theme Builder, Slide Builder (HTTP via `httpx.MockTransport`, one progress callback per slide),
the slide-compose job table, the composer in V2's last turn (raises on purpose), Supabase (in memory).

## Flags
`flags_set.uat_feature_flags_bool` = the 208 names + booleans read from Director UAT `/health` at `501e1e5` (saved by DIRECTOR-2; no secret entries), plus
`STRAWMAN_AUTO_PROCEED=true` (so F-11's auto-proceed under the J1 guard fires: the build starts with no outline click) and `DIRECTOR_VOICE_CONTRACT_ENABLED=true`.
PROVISIONAL settings `/health` does not report (same as the pk-f03 recording): blank deck on connect, Slide Builder v2 path, Stage 4 v3, the V2 packager, and the 24 chat
capabilities (`CHAT_CAP_*`), inherited from the pk-f03 `/health` read of `749df53e` because the 501e1e5 file has no capability map.
`client_caps` on every message = Studio's current list from pk-f03 + `voice1`.

## Frame counts
V1: 68 outbound, 3 inbound; 21 frames with `spoken`, 44 with `companion_state`. V2: 74 outbound, 5 inbound; 24 frames with `spoken`, 48 with `companion_state`. V0: 68 outbound, 3 inbound; 0 frames with `spoken`, 0 with `companion_state`.
Auto-proceed fired in V1 and V2 (`run_notes.auto_proceed_fired`): the outline gate (`accept_strawman`) never appeared; the build ran inside the plan-accept turn.

## Flag-off identity (digest of every masked frame, in order, no timing)
The same scripted dialogue was run on a clean origin/uat `501e1e5` tree (no voice code), on this branch with the flag off, on this branch with the flag on and typed
messages (V0), and on this branch with the flag on and voice messages (V1, V2).
| scenario | base 501e1e5 | branch, flag off | branch, flag on | flag on, `spoken`/`companion_state` removed | keys added | flag off = base | flag on minus the 2 keys = base |
|---|---|---|---|---|---|---|---|
| V0 | `a850bba81e4fd067` | `a850bba81e4fd067` | `a850bba81e4fd067` | `a850bba81e4fd067` | 0 | yes | yes |
| V1 | `7d5d1146ab9a19c3` | `7d5d1146ab9a19c3` | `48469def0bd4690b` | `7d5d1146ab9a19c3` | 65 | yes | yes |
| V2 | `b32c24e9d95e2a1f` | `b32c24e9d95e2a1f` | `c5eb7f630800de46` | `b32c24e9d95e2a1f` | 72 | yes | yes |
The base run is deterministic (two base runs of V1 give the same digest: yes). V0's "flag on" digest equals base: a typed turn
changes nothing. V1 / V2 with the flag on differ from base ONLY by the added keys, same frames, same order, same count.

## V1: turns
| turn | inbound (mode) | outbound frames, in order |
|---|---|---|
| 0 | WebSocket connect (no client frame) | build_control_capability > theme_sync > presentation_init > theme_sync > chat_message |
| 1 | `Help me pitch a new onboarding flow to our leadership team` (mode `voice`) | action_request |
| 2 | `Leadership team of 8, 10 slides, focus on time-to-productivity and cost` (mode `voice`) | status_update > chat_message > action_request |
| 3 | `Yes, let's build it!` (mode `voice`, action_value `accept_plan`) | status_update > build_phase > chat_message > build_event > chat_message > build_event > chat_message > build_event > chat_message > build_event > theme_sync > slide_context > build_phase > slide_update > chat_message > build_phase > status_update > chat_message > build_phase > theme_sync > status_update x0 > chat_message x0 > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > build_phase > presentation_url > chat_message > action_request > build_phase > token_usage |

## V1: per-frame table (`spoken` / `companion_state`)
| seq | turn | t_ms | frame | companion_state | spoken |
|---|---|---|---|---|---|
| 2 | 0 | 0.1 | build_control_capability |  |  |
| 3 | 0 | 4.5 | theme_sync |  |  |
| 4 | 0 | 8.7 | presentation_init op=full_update slides=1 (blank canvas: slide_id blank_slide_1) |  |  |
| 5 | 0 | 10.7 | theme_sync |  |  |
| 6 | 0 | 18.8 | chat: "Hello! I'm your presentation assistant. I can help you create professi" |  |  |
| 8 | 1 | 986.6 | action_request +question_set actions=['skip_questions'] | waiting | Happy to help you pitch this. A few quick questions so I can tailor it: Who is in the room, and how many people? How long should the deck be? What should leadership take away or decide? |
| 10 | 2 | 1756.9 | status_update | thinking | Analyzing presentation strategy |
| 11 | 2 | 1794.3 | chat: 'Here\'s my proposed plan for your presentation:\n\n**Core Message (The "S' | reporting | Here's my proposed plan for your presentation: A redesigned onboarding flow gets new customers productive faster and cuts the cost to serve them. |
| 12 | 2 | 1794.4 | action_request actions=['accept_plan', 'reject_plan'] | waiting | Does this structure work for you? |
| 14 | 3 | 2260.7 | status_update | thinking | Generating presentation outline |
| 15 | 3 | 2260.9 | build_phase {phase=planning, slide_count=None} | working | Designing your deck plan |
| 16 | 3 | 2260.9 | chat(ephemeral): 'Reviewing your topic and audience…' | working |  |
| 17 | 3 | 2261.0 | build_event {scope=deck, stage=framing, status=progress, slide_index=None} | working | Reviewing your topic and audience |
| 18 | 3 | 2371.4 | chat(ephemeral): 'Drafting the deck outline…' | working |  |
| 19 | 3 | 2371.5 | build_event {scope=deck, stage=outline, status=progress, slide_index=None} | working | Drafting the deck outline |
| 20 | 3 | 2402.9 | chat(ephemeral): 'Choosing layouts for each slide…' | working |  |
| 21 | 3 | 2403.0 | build_event {scope=deck, stage=slide_layouts, status=progress, slide_index=None} | working | Choosing layouts for each slide |
| 22 | 3 | 2424.0 | chat(ephemeral): 'Packaging your outline and picking a theme…' | working |  |
| 23 | 3 | 2424.1 | build_event {scope=deck, stage=package, status=progress, slide_index=None} | working | Packaging your outline and picking a theme |
| 24 | 3 | 2608.4 | theme_sync |  |  |
| 25 | 3 | 2621.3 | slide_context |  |  |
| 26 | 3 | 2621.5 | build_phase {phase=strawman, slide_count=10} | working | Outline ready — shaping your slides |
| 27 | 3 | 2623.7 | slide_update op=full_update slides=10 |  |  |
| 28 | 3 | 2626.0 | chat: "I've created an outline with 10 slides for **Pitch for a new customer " | reporting | I've created an outline with 10 slides for Pitch for a new customer onboarding flow. Building the full deck now — watch it take shape on the canvas. |
| 29 | 3 | 2626.3 | build_phase {phase=building, slide_count=10} | working | Building your slides |
| 30 | 3 | 2626.5 | status_update |  | Generating presentation content |
| 31 | 3 | 2626.5 | chat(ephemeral): 'Preparing your approved outline for slide generation…' | working |  |
| 32 | 3 | 2626.6 | build_phase {phase=building, slide_count=10} | working | Building your slides |
| 33 | 3 | 2628.7 | theme_sync |  |  |
| 34 | 3 | 2628.8 | status_update |  | Syncing with preview changes |
| 35 | 3 | 2636.2 | status_update |  | Composing 10 slides |
| 36 | 3 | 2636.2 | chat(ephemeral): 'Handing 10 slides to the Slide Builder…' | working |  |
| 37 | 3 | 2663.5 | chat(ephemeral): 'Building slide 1/10 - Pitch for a new customer onboarding flow' | working |  |
| 38 | 3 | 2663.5 | build_event {scope=slide, stage=render, status=done, slide_index=0} |  |  |
| 39 | 3 | 2663.6 | slide_built {slide_index=0, slide_count=10} | pleased |  |
| 40 | 3 | 2693.2 | chat(ephemeral): 'Building slide 2/10 - Where new customers get stuck today' | working |  |
| 41 | 3 | 2693.2 | build_event {scope=slide, stage=render, status=done, slide_index=1} |  |  |
| 42 | 3 | 2693.3 | slide_built {slide_index=1, slide_count=10} | pleased |  |
| 43 | 3 | 2717.1 | chat(ephemeral): 'Building slide 3/10 - What slow onboarding costs us' | working |  |
| 44 | 3 | 2717.2 | build_event {scope=slide, stage=render, status=done, slide_index=2} |  |  |
| 45 | 3 | 2717.2 | slide_built {slide_index=2, slide_count=10} | pleased |  |
| 46 | 3 | 2740.6 | chat(ephemeral): 'Building slide 4/10 - The new flow in one picture' | working |  |
| 47 | 3 | 2740.7 | build_event {scope=slide, stage=render, status=done, slide_index=3} |  |  |
| 48 | 3 | 2740.8 | slide_built {slide_index=3, slide_count=10} | pleased |  |
| 49 | 3 | 2764.1 | chat(ephemeral): 'Building slide 5/10 - How the guided steps work' | working |  |
| 50 | 3 | 2764.2 | build_event {scope=slide, stage=render, status=done, slide_index=4} |  |  |
| 51 | 3 | 2764.2 | slide_built {slide_index=4, slide_count=10} | pleased |  |
| 52 | 3 | 2787.3 | chat(ephemeral): 'Building slide 6/10 - Time-to-productivity: before and after' | working |  |
| 53 | 3 | 2787.4 | build_event {scope=slide, stage=render, status=done, slide_index=5} |  |  |
| 54 | 3 | 2787.5 | slide_built {slide_index=5, slide_count=10} | pleased |  |
| 55 | 3 | 2811.2 | chat(ephemeral): 'Building slide 7/10 - Cost to serve: before and after' | working |  |
| 56 | 3 | 2811.3 | build_event {scope=slide, stage=render, status=done, slide_index=6} |  |  |
| 57 | 3 | 2811.3 | slide_built {slide_index=6, slide_count=10} | pleased |  |
| 58 | 3 | 2835.2 | chat(ephemeral): 'Building slide 8/10 - Pilot plan and timeline' | working |  |
| 59 | 3 | 2835.3 | build_event {scope=slide, stage=render, status=done, slide_index=7} |  |  |
| 60 | 3 | 2835.3 | slide_built {slide_index=7, slide_count=10} | pleased |  |
| 61 | 3 | 2858.3 | chat(ephemeral): 'Building slide 9/10 - Risks and how we manage them' | working |  |
| 62 | 3 | 2858.4 | build_event {scope=slide, stage=render, status=done, slide_index=8} |  |  |
| 63 | 3 | 2858.4 | slide_built {slide_index=8, slide_count=10} | pleased |  |
| 64 | 3 | 2882.1 | chat(ephemeral): 'Building slide 10/10 - Pitch for a new customer onboarding flow' | working |  |
| 65 | 3 | 2882.2 | build_event {scope=slide, stage=render, status=done, slide_index=9} |  |  |
| 66 | 3 | 2882.3 | slide_built {slide_index=9, slide_count=10} | pleased |  |
| 67 | 3 | 2928.8 | build_phase {phase=finalizing, slide_count=10} | working | Finishing your deck |
| 68 | 3 | 2941.3 | presentation_url |  |  |
| 69 | 3 | 2943.6 | chat: '🎉 Your presentation is ready!\n\n**Pitch for a new customer onboarding f' | reporting | Your presentation is ready! Pitch for a new customer onboarding flow - 10 slides. |
| 70 | 3 | 2943.6 | action_request actions=['complete_presentation', 'request_adjustments'] | waiting | What would you like to do next? |
| 71 | 3 | 2943.7 | build_phase {phase=complete, slide_count=10} | pleased | Your deck is ready |
| 72 | 3 | 2946.7 | token_usage |  |  |

## V2: turns
| turn | inbound (mode) | outbound frames, in order |
|---|---|---|
| 0 | WebSocket connect (no client frame) | build_control_capability > theme_sync > presentation_init > theme_sync > chat_message |
| 1 | `Help me pitch a new onboarding flow to our leadership team` (mode `voice`) | action_request |
| 2 | `Leadership team of 8, 10 slides, focus on time-to-productivity and cost` (mode `voice`) | status_update > chat_message > action_request |
| 3 | `Yes, let's build it!` (mode `voice`, action_value `accept_plan`) | status_update > build_phase > chat_message > build_event > chat_message > build_event > chat_message > build_event > chat_message > build_event > theme_sync > slide_context > build_phase > slide_update > chat_message > build_phase > status_update > chat_message > build_phase > theme_sync > status_update x0 > chat_message x0 > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > chat_message > build_event > slide_built > build_phase > presentation_url > chat_message > action_request > build_phase > token_usage |
| 4 | `Please translate the whole deck into French` (mode `voice`) | chat_message > token_usage |
| 5 | `Add a slide after slide 2 about the risks and how we manage them` (mode `voice`) | chat_message > token_usage > slide_failed > chat_message |

## V2: per-frame table, turns 4 and 5 (the decline and the failed add)
| seq | turn | t_ms | frame | companion_state | spoken |
|---|---|---|---|---|---|
| 74 | 4 | 3805.2 | chat: "I can't translate the deck yet. You can keep building and editing on t" | reporting | I can't translate the deck yet. You can keep building and editing on the canvas, and I can answer questions about the deck meanwhile. |
| 75 | 4 | 3805.3 | token_usage |  |  |
| 77 | 5 | 4620.3 | chat: 'On it — I\'m building a new slide after slide 2: "risks and how we mana' | reporting | On it — I'm building a new slide after slide 2: "risks and how we manage them". You can keep chatting while it builds; I'll confirm when it lands. |
| 78 | 5 | 4620.4 | token_usage |  |  |
| 79 | 5 | 4630.0 | slide_failed | concerned |  |
| 80 | 5 | 4632.2 | chat: "That slide didn't build cleanly — nothing was changed. Want me to try " | reporting | That slide didn't build cleanly — nothing was changed. Want me to try again with a different brief? |

## Gaps and notes
- Reconnect (`skip_history=true`), the greeting de-duplication path, a typed `stop` during a build and a live Slide Builder are not recorded.
- Voice turn 3 of V1 (`Yes, let's build it!` + `action_value` `accept_plan`, `mode` voice) is PROVISIONAL: it assumes Studio sends the plan card's own chip text and value with `mode: "voice"` when a spoken yes picks the chip.
- V2's honest decline arrives as a `chat_message`, so its state is `reporting` (the brief's map). The only `concerned` frame is `slide_failed` (seq 79).
- Progress lines lose parenthetical and bracketed asides, so the existing status copy "Composing 10 slides (v2 path)..." is spoken as "Composing 10 slides" (seq 35). Other informative status copy such as "Syncing with preview changes..." is still spoken as is (not generic); filtering it further is the client's call.

## Hygiene scan of this folder
Scanned every file in this folder for provider API-key prefixes, JWTs, PEM blocks, bearer tokens, `api_key` / `secret` / `token` string values, emails, UUIDs, local paths and hosts
other than `layout.synthetic.invalid`: none found. The only 40+ character hex strings are the base sha and the frame digests. The control token is masked as `<secret>`.
Session / user ids are fake (`s_p418_v`, `u_test`).

## Re-run
```
env -u OPENAI_API_KEY -u OPENROUTER_API_KEY -u ANTHROPIC_API_KEY -u GEMINI_API_KEY GOOGLE_APPLICATION_CREDENTIALS=/nonexistent \
  PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=<director checkout> nice -n 10 <venv>/bin/python -B record.py --director <director checkout> \
  --flags uat-flags-501e1e5.json --caps-from <a /health file with chat_capabilities_effective> --scenario V1|V2|V0 --voice-flag on|off|unset --out <dir>
```
(each scenario takes about 6 s; `--voice-flag unset` is for a tree without the code.) `identity_check.py` builds `identity-check.json` from the runs.
