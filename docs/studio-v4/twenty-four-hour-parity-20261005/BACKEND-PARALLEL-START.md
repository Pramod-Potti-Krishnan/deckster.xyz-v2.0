> **Historical priority note, preserved below.** Earlier deadlines, active assignments and dispatch wording are superseded by [the current backend report](BACKEND-INTEGRATION-AND-ISSUES.md) and [work order](WORK-ORDER.md). QUEUE LIVE/path is still pending; this note grants no message, queue, test-account, backend or rollout authority.

# Backend work can start now

Prepared 5 October 2026 for PK and the backend leads. The frontend run continues until 6 October14:24:58UTC /10:24:58EDT, or finishes earlier. **Do not wait for that run to finish before investigating the following contracts and defects.** This note authorizes no backend rollout: follow PK's separate backend review/approval gate. Keep the working UAT backend unchanged while fixes are investigated and built on branches.

Use the existing [complete frontend/backend evidence package](../eight-hour-parity-20261005/Studio-v4-Eight-Hour-Parity-Handoff-20261005.zip) and [detailed backend report](../eight-hour-parity-20261005/BACKEND-INTEGRATION-AND-ISSUES.md). Those contain screenshots, supported paths, source leads and limits. This note prioritizes them and incorporates today's feedback. Correct our source interpretations where necessary; an observed failure does not by itself establish backend ownership.

## Start three workstreams in parallel

| Priority / owner | Concrete first outcome | Closure evidence |
| --- | --- | --- |
| P1 — Layout Service / native viewer | Confirm authoritative slide identity/order/count, preview validity after insertion, and editor save/readback/reopen contracts. Investigate lost Image/Infographic radius/opacity and Chart title/axes/editor reopening. Reconcile same-ID chart replacement geometry. | Exact served viewer/editor revision, supported command/payload, correlated ACK and real readback, saved fields, ordinary reopen. Three supplied previews became zero after a middle Blank Add despite correct native order; investigate with frontend rather than presume service fault. |
| P1 — Director / composition / grounding | Trace topic and explicit-constraint fidelity; Tapioca/home-culinary became business strategy. Diagnose generated Table KeyError and repeated Auto/Single Chart questions despite supplied facts/numbers. Confirm greeting/reconnect/session event identity and durable history semantics. | Sanitized trace from exact user prompt/options through effective brief, grounding, template/renderer and output, with request IDs and deployed revisions. Explicit negative constraints, labels, quotes and counts must survive. We own frontend duplicate-greeting/restoration fixes; do not change the backend just to suppress a frontend replay. |
| P1 for Knowledge parity — Researcher / Knowledge | Confirm the currently supported graph readiness/settings/consent, graph/stats/search/node detail, evidence and bounded import contracts. State which richer mock features exist versus need new APIs. Clarify corpus owner identity and effective sources supplied to Director. | Versioned example responses for ready/empty/paused/unavailable/forbidden states, owner/consent rules, pagination/errors and sanitized owned fixture. No private account/session dumps. Existing UAT graph must remain usable independently of a future richer graph. |

Then **Text Labs / Elementor**, with **Illustrator and the relevant leaf generator**, should address fresh Label422, Structured Infographic refusal and refinement that changes explicitly retained labels/icons/card counts. Route Image/Diagram/Analytics investigation through the actual generating path. Add Element and Director Add Slide are different contracts; success in one does not validate the other.

Theme Builder should confirm application acknowledgement and recovery semantics once the core work is underway. Templates/Themes, Models/usage/preferences, Decks/account and publish/download contract requests are already organized by section in the [accepted integration index](../eight-hour-parity-20261005/backend-packet/ATLAS-INTEGRATION-INDEX.md). The 222 overlapping source-documentation rows are an inventory, not 222 failing features or connected passes.

## Knowledge Graph: what is known today

Current frontend source already includes graph/stat/search/node-detail requests and a server-side Researcher proxy. The Knowledge page has capability/access/consent states. This supports investigating existing UAT parity now; it does not establish that the dev graph is connected or that a new graph is required.

The settings route first checks /api/v1/kg/capabilities and then owner settings. The graph proxy calls /api/v1/kg/{owner}/graph. Source uses KNOWLEDGE_SERVICE_URL with a default, a server credential when configured, normal login and live entitlement checks. Atlas will compare exact UAT/dev source and presentation. Do not change routing, credentials, readiness or entitlement to make a demo pass. If configuration differs, report non-secret metadata and the exact needed approval separately.

Richer mock concepts—an artifact library, topic coverage, “Included for Director,” and “Ask Knowledge”—need confirmed contracts before they become live capabilities. Ask the Knowledge and Director owners to define the effective source set, inclusion/exclusion timing, citations/provenance, ingestion status and failure/retry semantics. A new service is not presumed necessary; identify existing endpoints first. See [Research/Knowledge evidence](../eight-hour-parity-20261005/backend-packet/research-knowledge/README.md).

## Frontend work already assigned; do not compensate for it in a backend

- Repeated greeting on Studio return, initial blank/generated placeholder admission and genuine build-state animation.
- Correct Presentation/Download/Publish placement and removing the duplicate top replay control.
- Chapter-specific intro scenes. The current scene component never receives the changing chapter state: this is a confirmed frontend gap.
- Generated-slide selection restoration, stale questions after changing selection, remaining Director event mapping and conservative formatting admission.
- Existing graph presentation/mapping where current UAT contracts already support it.

The voice/avatar branch652bb48 is under frontend review. Its mic remains disabled, and its speech output is opt-in/on-device. **No speech backend is needed to review that existing branch.** Real microphone input would need an explicitly approved speech-input contract, auth/session ownership, privacy/consent, cancellation, cost/limits and interaction with real question/approval gates. Do not start a speculative speech integration under the avatar review.

## Integration agreement for every backend response

1. Use an issue ID, service owner, baseline/deployed revision and a proposed branch/commit. Distinguish observed connected evidence, exact-source findings and hypotheses. Earlier health pins are dated metadata, not proof of an individual cached iframe/request.
2. Return the authoritative endpoint or postMessage command, request/response examples, auth/ownership, idempotency/correlation, asynchronous status/ACK/errors, retry/cancel and persistence semantics. Explicitly mark existing, changed and proposed fields. Supply a minimal sanitized fixture and expected result.
3. Preserve existing UAT behavior and backward compatibility. Resolve changes with the frontend orchestrator before activation; no silent schema/flag/default changes. Build proposed fixes locally/on branches and use the backend lead's review plus PK approval before switching them on.
4. The frontend lead integrates the agreed contract against those fixtures, preserves real gates and errors, then Architect reviews source, design and functional evidence. The same owned connected scenario must prove the actual effect, save/reopen and failure/recovery when applicable. A200/Saved message alone is insufficient.
5. Return a concise result per issue: fix or contract correction, evidence, remaining limits and proposed rollout/rollback. Frontend deploy and backend rollout are separately recorded. No claim of full parity from a handful of examples.

## Copyable kickoff note

Please start parallel investigation now; do not wait for the frontend's24-hour run. Prioritize Layout viewer/persistence, Director composition/grounding and Researcher/Knowledge contracts. Use the attached existing evidence package plus this priority note. First return the supported versioned contracts, sanitized traces/fixtures, confirmed frontend versus backend ownership and a proposed branch/verification plan. Keep working UAT unchanged and put any implementation through your backend lead and PK's approval before activation. The frontend Architect will reconcile contracts, integrate reviewed changes and run the corresponding connected scenarios. Do not implement a new graph or speech backend merely because the mock illustrates one; confirm existing capabilities first.
