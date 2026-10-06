# Knowledge view continuity through a temporary access check

Architect assignment, 5 October 2026. This advances the existing Knowledge functional/design parity request and the explicit limit in both accepted Knowledge reviews. It is separate from Builder 1's active Viewer/Add integration.

## Concrete starting point

Public `b0fc9b47` and Atlas's current page, graph component, Knowledge stylesheet and hook match exactly; [base receipt](evidence/knowledge-pending-work-order/BASE-RECEIPT.json). `app/(app)/knowledge/page.tsx` distinguishes temporary access `pending` from resolved `blocked` for request lifetime, but the `kg.isLoading` early AccessState return unmounts the graph child. Its local view transform can therefore be lost even when the same owner becomes ready again with unchanged graph data. Prior normal graph-refresh/intro preservation does not cover this branch. This is a source-grounded UI gap, not connected incidence or a backend diagnosis.

First reproduce the actual temporary pending→same-owner ready state with a mounted graph already panned/zoomed and a selected inspector/type filter. Contrast resolved blocked/revoked, account change and ABA. Do not assume every loading event is harmless. If the existing actual source already preserves the relevant state, return that concrete finding instead of making a speculative change.

## Exclusive ownership and outcome

Atlas owns only `app/(app)/knowledge/page.tsx`, `components/knowledge/kg-graph-view.tsx` and necessary `components/knowledge/studio-knowledge.css` changes for this outcome. The hook, settings page, sidebar, proxies, service URLs, server authorization, entitlements, backend and persistent configuration remain unchanged. Preserve all completed FE0/Knowledge/compact voice source and previews. B1 still owns Studio/shared source and the sole connected runtime/global input. No private history merge.

Complete a bounded 90–180-minute outcome preserving appropriate presentation continuity through a temporary same-owner check. Keep current real loading/access presentation, data/operation admission and immediate resolved revocation/account-switch privacy. A correction may preserve proven presentation state across child remount; it must not simply keep private graph data visible or interactive while access is unverified. Do not treat old capability/settings, a false/404 capability or the same account string after a revoked lifetime as fresh permission. Do not add cross-account or persistent browser storage. Preserve existing node/edge identity, search, selected inspector, list/map, filters, pan/zoom/fit/reset/focus, accessibility and approved short-height/readability work. If a safe solution requires changing access policy or a backend contract, stop that dependent part and report the boundary.

Use useful disjoint Sol High workers within available concurrency: lead owns the page/runtime; a worker may own graph presentation state or independently validate existing lifecycle checks. Declare ownership before editing. No overlapping app changes or duplicate global browser input. Existing 8815 Knowledge and 8885 compact previews stay available; use the lead's isolated service-disabled context with exact recorded runtime/source bindings. A different port alone is not browser isolation.

## Evidence and acceptance

Return one coherent immutable checkpoint with exact public/predecessor/result hashes, a meaningful before/after mounted-component witness and representative actual light/dark/short-height images. Show the same-owner temporary check preserves the proven view state only after readiness returns, while real blocked/revoke/account/ABA transitions retire old state and callbacks. Keep existing adversarial held graph/detail/search/import responses and no-next-batch behavior intact. Use focused checks and affected typing, reusing unchanged evidence; no broad invented test denominator or production build merely for screenshots.

The account, subscription, capability and backend responses must all be synthetic. No real settings change, consent, import, purge, graph/account query or connected test; designated test account remains unverified. Preserve fake-provider and full-app limitations explicitly. Architect reviews source, renders and focused proof before B1 selectively integrates any accepted files. No Atlas push, merge, deploy or flag activation.

Park a hard dependency after 30–45 minutes and save a precise limitation. Check the 8GiB disk floor before covered builds/renders; the earlier task-cache cleanup is complete and must not be repeated. No valuable/other-task deletion. Overall final candidate target remains 6 October11:24UTC, consolidation13:54UTC, hard stop14:24:58UTC. Completion/material blocker reports are primary; no routine reporting interruptions.
