# J3-TEXT-P0 frontend repair candidate

This draft repairs the proved short browser budget and stale theme-preflight recovery message. It does not claim to resolve the Word output or the backend's three-item result. The saved first verdict remains bounded: existing frontend timeout mechanisms predate today's flip, and the onset of the live backend failures is unknown.

Permanent candidate base is `studio-v4-dev-preparation-code` at `18e0446073d62b042a9470fd4524994d3dd82e8e`, own isolated branch `element3/j3-text-p0-studio`, target `studio-v4-dev-preparation-code`. PROGRAM approved this exact source/target exception via OPS-3 (workspace main492ff252 /15:10 relay). Original Studio-owned worktrees/branches remain untouched. UAT draft #334 from ee532 is reference only; no Studio feature commits are imported into UAT. The reported deployed-source attribution is operations evidence, not independent runtime-SHA verification.

## Changes and default-off behavior

* `NEXT_PUBLIC_TEXTBOX_PLANNED_TIMEOUT_ENABLED` enables a180,000ms aggregate browser budget only for research-off `TEXT_BOX`. Unset, `false` and other literals retain30,000ms. Existing research-on150,000ms, diagram150,000ms and infographic300,000ms budgets remain unchanged.180seconds covers session acquisition and the whole Text Labs response; it is not a backend leaf deadline. Backend source review identifies Text Labs `AtomicClient(timeout=60.0)`, which this patch does not change. Multi-stage work can still exceed either bounded deadline.
* `NEXT_PUBLIC_ELEMENT_THEME_PREFLIGHT_RECOVERY_ENABLED` records the exact failed handshake from the authoritative wait result, with presentation, semantic fingerprint, request ID, presentation epoch and original blank identity. A late same-request/same-theme Applied acknowledgement can replace only that still-current error with “Deck theme is now ready. Try again to generate this element.” The prompt/form and placeholder remain. No generation runs automatically.
* Explicit Retry can reissue/reuse the existing theme handshake once only when the current failed request and selected theme still match that recovery context. Existing composer, Template Mode, local-pending-theme and presentation guards remain. Unrelated Applied events, another error, closed/changed panel, changed blank or presentation retire recovery without dismissing the error.
* The authoritative wait optionally returns a copy of the failed sync state only for opted-in calls. This covers an acknowledgement arriving between failure and error publication; recovery cannot accidentally bind to a newer request. Guard errors without a failed handshake are never converted to ready.

Only literal `true` enables either flag. The existing shared abort controller, generation singleflight, request construction, insertion/create-first replacement and cleanup are retained. There is no new Text Labs retry loop, backend attempt protocol or automatic paid dispatch. Explicit TEXT_BOX retry remains the existing user action; exactly-once backend deduplication has not been proved.

## Focused evidence

`permanent-focused-results.json` records34 executed runtime scenarios on the actual permanent candidate, pristine18e baseline, four production hashes plus test-script hash, and the tested commit. The summary covers strict OFF parity and the functional cases below; it is distinct from the earlier temporary overlay hashes.

`scripts/test-textbox-planned-recovery.mjs` runs actual pinned generation hooks, Text Labs client functions and extracted page-owned theme functions with virtual timers and synthetic transport/viewer receipts. It exercises:

* strict off-state request, command, error, abort and actual input markup identity against pristine source;
* success after45seconds and a later-log-aligned141,363ms response plus1-second session delay, one controller across session/message, repeated-click one-send behavior, and session time consuming the same180-second ceiling;
*30/180-second abort, original-blank retention, overlay cleanup, explicit cancellation, unmount and changed presentation/theme preventing stale insertion;
* late matching acknowledgement, acknowledgement/error-publication race, unrelated/superseded context rejection, and no automatic Text Labs send;
* explicit shared theme retry with one WebSocket send, missing acknowledgement, failed send, composer/Template Mode/pending local theme restrictions.

No real model, live UI, service or data edit is involved. Input markup serialization is an offline test, not a visual acceptance proof. The existing24 form/client request replays and3 theme-source comparisons are reused as source evidence; they are reconstructed selections, not exact captured live network records.

Run focused checks in the permanent Studio candidate (the harness defaults to pristine18e and Studio shell/#327 enabled):

```sh
node scripts/test-textbox-planned-recovery.mjs
```

The actual pristine18e/permanent-Studio-candidate native test-file sweep and TypeScript check run through `heavy.sh`, with frontend repository locks and an individual TMPDIR created inside the lock for each suite. Their result will be recorded in `native-pair-results.json`. This is local verification, not an OPS-1 official gate.

## Studio source divergence, permanent port and integration hold

UAT and reported Studio source diverge at merge-base `1f1214fbab4d2c67361f7e836fdda7cdebc15a9e`: UAT has14 unique commits, Studio59; UAT ee532 is not an ancestor of Studio18e. UAT #334 remains reference only; the approved permanent candidate is built directly from18e.

The exact minimal four-file port is preserved in `studio-port.patch`, with pristine and adapted SHA-256 records in `studio-overlay-hashes.json`. Three files apply cleanly; the generation hook has one conflict where UAT uses `generationPanel.setError(readiness.error)` while Studio uses its authority-safe `setGenerationError(readiness.error)`. The permanent port retains the new failure snapshot capture and Studio's `setGenerationError` call, plus all Studio lifecycle/ownership/placeholder/context code. Its four production-file hashes exactly match the preserved adapted hashes. No owned Studio branch or original source checkout changed.

Focused tests passed against the actual permanent candidate, with Studio shell and the existing #327 fidelity flag enabled, comparing new flags-off against pristine18e. The exact minimal port/source hashes survive temporary cleanup. Permanent source/target selection is approved; official Studio integration, native/typed verification and connected acceptance remain pending. No blanket import or merge of divergent Studio/UAT history is needed.

The earlier temporary proof can also be replayed independently:

```sh
TEXTBOX_RECOVERY_SOURCE_ROOT=/private/tmp/element3-j3-fe-studio-overlay-20261008 \
TEXTBOX_RECOVERY_SOURCE_FALLBACK_REF=18e0446073d62b042a9470fd4524994d3dd82e8e \
TEXTBOX_RECOVERY_BASELINE_REF=18e0446073d62b042a9470fd4524994d3dd82e8e \
TEXTBOX_RECOVERY_STUDIO_SHELL=true \
node scripts/test-textbox-planned-recovery.mjs
```

If temporary files are removed, retrieve the four pristine files at18e into a new owned proof directory and apply `studio-port.patch`; the harness reads all unchanged dependencies from Git via the fallback ref. Verify the four adapted hashes before replay. The compiler/React dependencies are existing read-only packages, with no install.

No merge, flag flip, deploy, official gate, live UI or paid call is authorized by this draft. OPS-1 alone owns release gates; Studio integration, connected retries and user-visible acceptance remain pending.

## Later sanitized timing evidence

After the frozen first verdict, OPS-1's sanitized logs (`streams/element/J3-TEXT-P0-LOGS.md`, workspace origin/main10180355) record Sections TS start14:00:16.265 UTC and completion14:02:37.638 UTC:141,363ms. The frontend aborted around14:00:46; no matching Text Labs completion is recorded. This supports the browser-budget mismatch while leaving actual cancellation behavior and regression onset unknown. The new offline141,363ms response scenario succeeds within the180-second aggregate browser ceiling. It assumes transport survives; the separate Text Labs60-second AtomicClient read ceiling requires its independently flagged backend repair, and this frontend patch does not change it. Director theme HTTP200 and WebSocket1001 reconnects do not constitute the missing matching ACK transcript.

## Existing native source-fingerprint limitation

The untouched `test-studio-theme-refusal-readiness.mjs` fails its first assertion (`exact reverse of guard restores pinned readiness body`, line54) on pristine18e: its pinned c17 callback uses `LAYOUT_SERVICE_URL`, whereas18e already uses `getLayoutServiceUrl()`. The candidate also changes this callback behind the new flags, so the same old body-identity assertion fails there. `legacy-source-fingerprint-results.json` records exact baseline/candidate IDs and the first failure. No existing assertion is removed or loosened. The actual18e OFF behavioral comparison remains the relevant preservation proof; the complete baseline/candidate native and typed pair is still queued.
