# P4-19 — Director voice core gate result

Core restacked by merge onto Studio dev `7ccc857be71ac5b4dd74b05838ffe77537fbb9ae` (#559); awaiting OPS-2 / PROGRAM-1 integration gate. Review branch: `element3/p4-19-voice-core`, [Studio PR #558](https://github.com/Pramod-Potti-Krishnan/deckster.xyz-v2.0/pull/558).

Latest post-#559 merge refresh is light only, per PROGRAM-1's Mac memory/disk hold: no Vitest, suites, type-check job or builds rerun. The merge preserves the strawman and template-match features, leaves the voice core and its fixtures byte-identical to `ad5b5232`, and leaves application trees byte-identical to `7ccc857b`. All 19 normalized proof/metadata views restore exactly to that new target; JavaScript syntax, whitespace and clean merge-tree checks pass. OPS-2 owns seat-2 install/types/suite/build/route gate. The 29-proof and 225-fixture results below remain evidence from the earlier `1f7b9fc2` refresh, not fresh results on `7ccc857b`.

The earlier authorized feature-branch merge preserved the `1f7b9fc2` target's strawman changes. Against that earlier target, all 29 affected Studio proofs pass on both baseline and branch, 225 voice fixtures pass, and strict client-core TypeScript passes. The initial branch pass found a second raw-diff check in theme-export and two timeouts; exact-edit normalization fixes the check, and all six dependent/timeout checks pass serially with original internal assertions and limits. Nineteen normalized proof/metadata views restore exactly to the target. Existing app pages, components, hooks, assets, styles and types are byte-identical to that target. No Studio dev push, PR merge or deploy was performed.

The full inventory below is historical evidence on `abf52d4d`, not a new full-suite run on `1f7b9fc2`. The delivered client core is byte-identical to its full-suite checkpoint; the refresh reruns cover the affected proof files and new strawman/stage checks. Detailed baseline, initial failures, serial results and log hashes appear in `targetRefresh` in the comparison evidence.

The client-safe core includes sentence chunking, energy VAD, call-state reduction, filler/progress decisions, tone, avatar rig, motion playback and manifest parsing, microphone recovery, duration and running cost helpers. Optional companion clips retain legacy-pack fallbacks. `NEXT_PUBLIC_STUDIO_VOICE_CALL` defaults off and enables only on literal `true`.

The existing app pages, components, hooks, assets, styles, types and production dependencies remain byte-identical to the base. P4-20 owns microphone/audio/UI orchestration; STT and TTS must use model-router. Key lookup stays server-only.

| Validation | Result |
| --- | --- |
| Voice and compatibility fixtures | 225 passed across 11 files |
| Strict client-core TypeScript check | Passed |
| Studio inventory | Base and branch: 212 passed, 79 existing assertion failures, 1 runtime-dependent check excluded |
| New failures / additional failure diagnostics | 0 / 0 |
| Focused and dependent proof reruns | 27 passed |
| Recorded Director spoken text | All 21 V1 and 24 V2 lines preserved, including question cards; typed V0 has none |
| Paid calls / real provider audio | $0 / none |

The full Studio inventories ran sequentially under the program heavy-job lock. Branch checks used two separate worktrees of one immutable checkpoint. Initial baseline timeouts were rerun with a larger allowance. One branch mutation-heavy proof was rerun alone after reaching the parallel allowance; its original assertions and mutation checks were retained.

Older source proofs recognize only this port's exact test metadata and bounded commit subjects. All 16 taught proof files, package metadata, lockfile and registry restore exactly to their baseline views. Unknown dependency/source edits remain checked. This preserves the original assertions while accommodating the new test runner and additive flag.

The full branch inventory tested `466fc250`; subsequent proof-only compatibility changes were validated at the focused checkpoints recorded in the [detailed matrix](studio-comparison.json). The delivered client core is unchanged from that full run. Unchanged evidence was reused; focused fixes and their tested heads/logs are recorded separately.

Local environment: Node 24.4.1, TypeScript 5.9.3 and Vitest 5.0.3, using existing local dependencies. Node 22 clean-install/build CI remains part of the program gate. `test-studio-dev-server.mjs` was excluded on both revisions because it needs a separately owned compiled runtime on port 8843. The evidence covers local source execution and recorded text, with connected voice/UI operation left to P4-20/P4-22.

See the [consumer contract](VOICE-CORE.md), [source inventory](source-inventory.json), and [full comparison evidence](studio-comparison.json). Next: OPS-2 gate review; PROGRAM-1's named GO controls a dark merge.
