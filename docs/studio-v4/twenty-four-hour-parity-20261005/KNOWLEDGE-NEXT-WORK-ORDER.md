# Atlas next bounded outcome — management access and readable graph

Authorized by Architect5October2026 after reviewing the completed7152 Knowledge slice and exact public/UAT management contracts. This is within PK's existing Knowledge functionality/design parity request. Target one coherent90–180-minute outcome; renewed24h deadline remains6October14:24:58UTC. No backend/API/auth/entitlement change or actual account mutation is authorized.

## Ownership

Atlas lead owns integration and its existing isolated service-disabled browser/runtime. Use useful disjoint Sol High workers:

1. **Management:** exclusively `hooks/use-knowledge-graph.ts`, `app/(app)/settings/knowledge-graph/page.tsx`, `components/settings/settings-sidebar.tsx`, and only necessary `components/knowledge/studio-knowledge-settings.css`, plus focused docs/checks. These files are explicitly transferred to Atlas for this outcome. Do not touch shared Builder/header/viewer/transport, general auth/subscription/entitlement helpers or API proxies. Read [KR-F1 decision](reviews/knowledge-management-scope/DECISION.md) and exact source pins before implementation.
2. **Graph readability:** exclusively `components/knowledge/kg-graph-view.tsx`, `components/knowledge/studio-graph-controls.css` and only necessary `components/knowledge/studio-knowledge.css`, with focused evidence. Start from accepted7152. Correct the observed1440×620/~154px drawing-area label/readability problem, preserving current controls, list/map state, actual pointer/zoom math, selection and source inspection. Retain approved map/inspector hierarchy; do not invent topic/artifact data or a new backend dependency. Prefer a deliberate usable canvas/scroll treatment over making the graph ever smaller. Compare the actual approved mock and current source; record any remaining genuine design conflict.

Lead owns cross-file coordination and must avoid overlapping edits. The already accepted Knowledge page access lifetime and intro files stay exact unless a concrete integration correction is necessary and separately reported. A locked-page management link would require a tiny explicit page-owner seam; the authenticated settings sidebar is already the primary entry. B1 remains sole connected browser/global input owner.

## Management behavior and boundaries

Restore normal authenticated retained-data settings/pause/Delete access using the **existing auth-only settings/unsubscribe/purge contracts** when current readiness is verified. Introduce an explicit settings-management hook mode or equivalent narrow wrapper used by the settings page only. Preserve the shared hook's default paid graph/Builder semantics. Management must not imply graph/search/backfill access, KG=true, paid eligibility or permission to grant/re-enable consent.

Keep the management shell available to authenticated users independently of billing resolution, while paid enrichment/new consent remains pending/locked as appropriate. Paused or downgraded owners can inspect the returned consent record, stop existing consent and reach explicit deletion confirmation if verified readiness permits. No automatic subscribe, resume, purge or optimistic completion. Do not infer graph contents/size from settings, absent dates or consent flags. The confirmation concerns retained Knowledge Graph data, not uploaded files, presentations or all account data.

Preserve account-keyed remount, click-time owner/lifetime/abort/ABA guards, busy serialization, confirm/cancel, failure/unconfirmed outcomes, returned receipt validation and recovery. Unknown or malformed results are not success. A client abort cannot roll back a dispatched server mutation. Do not weaken server proxies or bypass unavailable readiness: capabilityfalse/404/default-disabled cannot prove no retained data or usable management. Ask backend to clarify that contract; leave such actions inactive with truthful recovery guidance.

## Evidence and delivery

Use the focused cases in the exact-source KR-F1 decision and meaningful before witnesses. Verify actual mounted settings/sidebar light/dark/narrow, keyboard confirm/cancel, failed/unconfirmed/retry, paid-paused/unpaid/auth-loading/owner-switch/ABA and the unchanged default shared-hook behavior with **synthetic service-disabled fixtures only**. No real purge, import, subscribe, unsubscribe, private-account query, auth copy, UAT retry or persistent flag/config action is needed or authorized. Do not make broader tests or new build fixtures merely for screenshots.

For graph readability, demonstrate real short/wide/narrow geometry and readable selection/focus with controls/inspector reachable; preserve the already measured pointer anchoring and existing normal refresh/intro state. Reuse unchanged evidence. Return exact base/result app manifest, immutable source checkpoint, focused checks, representative before/after images and clear isolated/connected limits. Architect reviews every completed user-facing slice before B1 imports or any public release. No Builder push/merge/deploy; never private ancestry.
