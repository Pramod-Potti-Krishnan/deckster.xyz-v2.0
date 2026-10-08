# J3-TEXT-P0 frontend repair candidate

This draft repairs the proved short browser budget and stale theme-preflight recovery message. It does not claim to resolve the Word output or the backend's three-item result. The saved first verdict remains bounded: existing frontend timeout mechanisms predate today's flip, and the onset of the live backend failures is unknown.

Candidate base is actual UAT `ee532fab4b84a6883f8a5b50675ccab692b62240`, own branch `element3/j3-text-p0`; requested draft target is `uat`. No Studio feature commits are imported into UAT. The reported live Studio source is separately attributed to `18e0446073d62b042a9470fd4524994d3dd82e8e`, not independently established by runtime SHA.

## Changes and default-off behavior

* `NEXT_PUBLIC_TEXTBOX_PLANNED_TIMEOUT_ENABLED` enables a180,000ms aggregate browser budget only for research-off `TEXT_BOX`. Unset, `false` and other literals retain30,000ms. Existing research-on150,000ms, diagram150,000ms and infographic300,000ms budgets remain unchanged.180seconds covers session acquisition and the whole Text Labs response; it is not a backend leaf deadline. Backend source review identifies Text Labs `AtomicClient(timeout=60.0)`, which this patch does not change. Multi-stage work can still exceed either bounded deadline.
* `NEXT_PUBLIC_ELEMENT_THEME_PREFLIGHT_RECOVERY_ENABLED` records the exact failed handshake from the authoritative wait result, with presentation, semantic fingerprint, request ID, presentation epoch and original blank identity. A late same-request/same-theme Applied acknowledgement can replace only that still-current error with “Deck theme is now ready. Try again to generate this element.” The prompt/form and placeholder remain. No generation runs automatically.
* Explicit Retry can reissue/reuse the existing theme handshake once only when the current failed request and selected theme still match that recovery context. Existing composer, Template Mode, local-pending-theme and presentation guards remain. Unrelated Applied events, another error, closed/changed panel, changed blank or presentation retire recovery without dismissing the error.
* The authoritative wait optionally returns a copy of the failed sync state only for opted-in calls. This covers an acknowledgement arriving between failure and error publication; recovery cannot accidentally bind to a newer request. Guard errors without a failed handshake are never converted to ready.

Only literal `true` enables either flag. The existing shared abort controller, generation singleflight, request construction, insertion/create-first replacement and cleanup are retained. There is no new Text Labs retry loop, backend attempt protocol or automatic paid dispatch. Explicit TEXT_BOX retry remains the existing user action; exactly-once backend deduplication has not been proved.

## Focused evidence

`scripts/test-textbox-planned-recovery.mjs` runs actual pinned generation hooks, Text Labs client functions and extracted page-owned theme functions with virtual timers and synthetic transport/viewer receipts. It exercises:

* strict off-state request, command, error, abort and actual input markup identity against pristine source;
* success after45seconds, one controller across session/message, repeated-click one-send behavior, and session time consuming the same180-second ceiling;
*30/180-second abort, original-blank retention, overlay cleanup, explicit cancellation, unmount and changed presentation/theme preventing stale insertion;
* late matching acknowledgement, acknowledgement/error-publication race, unrelated/superseded context rejection, and no automatic Text Labs send;
* explicit shared theme retry with one WebSocket send, missing acknowledgement, failed send, composer/Template Mode/pending local theme restrictions.

No real model, live UI, service or data edit is involved. Input markup serialization is an offline test, not a visual acceptance proof. The existing24 form/client request replays and3 theme-source comparisons are reused as source evidence; they are reconstructed selections, not exact captured live network records.

Run focused UAT checks:

```sh
node scripts/test-textbox-planned-recovery.mjs
```

The baseline/candidate native test-file sweep and TypeScript check run through `heavy.sh`, with frontend repository locks and an individual TMPDIR created inside the lock for each suite. Their result will be recorded in `native-pair-results.json`. This is local verification, not an OPS-1 official gate.

## Studio source divergence and integration hold

UAT and reported Studio source diverge at merge-base `1f1214fbab4d2c67361f7e836fdda7cdebc15a9e`: UAT has14 unique commits, Studio59; UAT ee532 is not an ancestor of Studio18e. A UAT draft cannot be treated as a compatible live Studio release.

The exact minimal four-file port is preserved in `studio-port.patch`, with pristine and adapted SHA-256 records in `studio-overlay-hashes.json`. Three files apply cleanly; the generation hook has one conflict where UAT uses `generationPanel.setError(readiness.error)` while Studio uses its authority-safe `setGenerationError(readiness.error)`. The temporary proof retains the new failure snapshot capture and Studio's `setGenerationError` call, plus all Studio lifecycle/ownership/placeholder/context code. No owned Studio branch or original source checkout changed.

Focused tests passed against this adapted actual18e source with `NEXT_PUBLIC_STUDIO_V4_SHELL=true` and the existing #327 fidelity flag true, comparing flags-off against pristine18e. The exact minimal port/source hashes survive temporary cleanup. This is temporary source compatibility evidence; a permanent compatible candidate/target exception and official Studio integration remain coordinator decisions. A separate permanent proof branch is explicitly held pending that decision.

To replay the existing temporary proof:

```sh
TEXTBOX_RECOVERY_SOURCE_ROOT=/private/tmp/element3-j3-fe-studio-overlay-20261008 \
TEXTBOX_RECOVERY_SOURCE_FALLBACK_REF=18e0446073d62b042a9470fd4524994d3dd82e8e \
TEXTBOX_RECOVERY_BASELINE_REF=18e0446073d62b042a9470fd4524994d3dd82e8e \
TEXTBOX_RECOVERY_STUDIO_SHELL=true \
node scripts/test-textbox-planned-recovery.mjs
```

If temporary files are removed, retrieve the four pristine files at18e into a new owned proof directory and apply `studio-port.patch`; the harness reads all unchanged dependencies from Git via the fallback ref. Verify the four adapted hashes before replay. The compiler/React dependencies are existing read-only packages, with no install.

No merge, flag flip, deploy, official gate, live UI or paid call is authorized by this draft. OPS-1 alone owns release gates; Studio integration, connected retries and user-visible acceptance remain pending.
