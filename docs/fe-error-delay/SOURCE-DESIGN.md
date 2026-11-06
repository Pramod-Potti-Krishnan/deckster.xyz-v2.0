> Historical first-handback document from source7bea5949. The reviewed rework, current source binding and qualifications are in [REWORK-1.md](REWORK-1.md). Original failed verdicts and receipt files remain unchanged.

# FE-ERROR-DELAY source-first design

Read-only first phase; no production change or new execution. Approved source/target: `30c9fc9e62cdb56601e6090486914ab1780c072d`, branch `element3/fe-error-delay`, target `studio-v4-dev-preparation-code`. Source is distinct from earlier operations-attributed running Studio18e. Root freezes the baseline failing verdict before implementation. Root owns commits/integration; this worker owns hook/minimal helper/docs; test worker owns the new focused script only.

## Proved code ordering, not live incident attribution

`hooks/use-textlabs-generation.ts` formats full backend reason and request/downstream references, timeout/network fallback and retry strategy in catch1787–1845. It then awaits partial-insertion rollback1860 and, if tracking had been removed, placeholder restoration1890. First final panel error/retry publication is1951/1954. Restoration can invoke `resumePanelForElement`1923/1932, whose implementation clears error synchronously (`hooks/use-generation-panel.ts:196–212`). Outer finally1968 also awaits overlay cleanup but ordinary catch feedback is already published before that cleanup. This proves a shared source mechanism for delaying catch feedback during recovery; it does not establish the timing/join of the prior Shape live observation.

Additional compensation-before-feedback boundaries: blank/refine progress-overlay catches540–592 await generating:false then publish error; known failed original-refine deletion1732 awaits rollback before throwing the final reason to the outer catch. Pure preflight error/return paths (identity/geometry/theme/context/research/image/layout intent) already set error before outer lifecycle cleanup; preserve their messages and transport/payload behavior. Session ensure and request/insertion failures converge on the main catch. Successful create-first insertion/receipt reconciliation and original retirement remain unchanged.

`components/generation-panel/shared/generation-input.tsx:80–107` renders error even while generating. Retry/Generate stay disabled by the existing generation lease, so immediate feedback needs no early unlock, detached recovery or overlapping request. `activeGenerationKeysRef` holds same-target single-flight through awaited cleanup. The generation panel's state tracks generating per target key.

Viewer read-only timing contract: `presentation-viewer.tsx:566–588` uses30s mutation/overlay commands (45s cited upsert),8s read commands,5s fallback. `lib/layout-command-result.ts` reconciles command timeouts through receipt reads; unknown state yields ambiguity/do_not_retry. No timeout, viewer, mutation, reconciliation, retry or backend changes proposed.

## Minimal flag-on slice

NEW `NEXT_PUBLIC_ELEMENT_FAILURE_IMMEDIATE_FEEDBACK_ENABLED` defaults off, literal true only. Keep the existing failure formatter and reference/strategy contracts (including additive future PR336 guidance); move no formatter semantics. ON publish the authoritative failure synchronously before any compensating await, retaining isGenerating and the active-generation lease until ordinary recovery/finally finish. After failed rollback, append only the existing recovery warning while retaining original reason/references/strategy. Never replace the original reason with cleanup failure.

Capture presentation epoch/lease and panel intent revision (`getIntentRevision`) at invocation; immediate/late panel publication must still own the original blank or refine target and unchanged intent. A close/reopen of the same ID is distinct intent. Own synchronous resume may advance the expected revision and re-publish error/retry in the same synchronous boundary to avoid resume clearing visible feedback; unrelated resume/panel/owner must receive no old feedback. Restoration/tracking still complete safely; no detached promises or early lease release. Multiple targets/new attempts cannot receive stale feedback. All awaits/rejections stay in current guarded try/catch/finally.

OFF leaves existing call/state/message/order/requests/Layout/lifecycle behavior exact. Helper, if introduced, must not change client/schema/UI/transport. No production writes until root signals frozen failing baseline. No broad jobs launched by this worker.

## Focused proof boundaries for the test owner

Pristine/current OFF event-sequence equality; partial insert failure with blocked rollback; removed tracking with blocked restore and synchronous resume; overlay-start failure with blocked compensating clear; refine-original-delete known failure with blocked rollback; rollback/restore rejection retains original error/ref/strategy; normal backend/no-elements/session/timeout/network/preflight failures; all component families; ambiguous mutation remains no-retry/no unsafe rollback; close/reopen sameID, other-target generation, presentation epoch/lease change and unmount suppress late UI writes; no new sends before original cleanup; explicit edited later generation after cleanup makes one send. Actual hook/client and actual feedback render prove source/UI boundary; no live browser/service/save/reload claim.

## Approved implementation refinements after baseline freeze

Root published the frozen baseline at715e93f0, then authorized production work. Read-only audit found and root approved two scoped corrections: effective activation is Studio-only, because legacy non-Studio panel intent revision does not track same-ID reopen; renamed-ID panel resume is deferred through cleanup because actual panel busy state belongs to its draft key. Same-ID resume remains synchronous/error-preserving. Closed/direct-chat failures use one immediate toast, including early non-null preflight setter and missing-viewer errors, with no drawer/workspace activation or fabricated request reference. Root explicitly authorized ON stale-owner/intent safety exceptions for subsequent commands/tracking/resume/feedback effects while requiring OFF identity.
