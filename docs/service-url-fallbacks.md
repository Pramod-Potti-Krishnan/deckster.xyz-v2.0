# Service-URL fallbacks (J8.0, R-20261007-frontend-22)

Every backend URL in this app used to be written `process.env.X || <built-in default>`, where the
default is a PRODUCTION host or `localhost`. A deployment that forgets `X` silently talks to
production (`CLAUDE.md` gotcha #2). This page is the inventory of every such default in `uat`, what
this change does about the server-side ones, and what it deliberately leaves alone.

Line numbers are at the `uat` base (`ee532fa`). Names only: no configured values appear here, and
the hosts are the public defaults already in the source.

## The flag

`DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED` (server-only, default off, exact string `true` turns it on,
same convention as `COUPON_AUTH_ENABLED` / `PUBLIC_QA_ENABLED`).

| | flag off (today) | flag on |
|---|---|---|
| variable set | uses it, exactly as before | uses it (validated by `requireServiceUrl`, trailing slash stripped) |
| variable unset | uses the built-in production/localhost default, plus **one** `console.warn` per process per variable chain (names only, never a URL) | **503** `{ "error": "service_url_not_configured", "code": "SERVICE_URL_NOT_CONFIGURED", "service", "variables": [...] }`, and the handler never reaches `fetch` |
| variable invalid | used as is | 503 `service_url_invalid` (no fallthrough to another alias) |

`lib/service-url.ts` is copied byte for byte from `origin/studio-v4-dev-preparation-code`
(`requireServiceUrl`, `inspectServiceUrl`, `ServiceUrlConfigError`), so a later merge of the Studio line
adds an identical file. Everything new is in two separate files: `lib/server-service-url.ts` (pure:
flag, resolver, warn-once) and `lib/service-url-response.ts` (maps the error to the 503).

URLs are now resolved inside each handler, after auth/validation and before the first outbound request,
never at module load, so `next build` is unaffected by a missing variable.

The frontend has no `/health`; `/api/version` is public and fixed-shape, and no other flag (`COUPON_AUTH_ENABLED`,
`PUBLIC_QA_ENABLED`, ...) is exposed anywhere, so the flag is not surfaced on a route (that would change
flag-off bytes). Whether it is on is visible by the absence of the `[service-url]` warning and by a 503 on a
missing variable.

## Server-side sites (covered by the flag)

| # | file:line (base) | env var(s), in order | default class | feature / route | `main` | this PR |
|---|---|---|---|---|---|---|
| 1 | `app/api/templates/route.ts:16` | `DIRECTOR_API_URL` | PRODUCTION (Director) | template list / save (GET, POST) | same | guarded |
| 2 | `app/api/templates/[id]/route.ts:7` | `DIRECTOR_API_URL` | PRODUCTION (Director) | template get / delete | same | guarded |
| 3 | `app/api/templates/[id]/blueprint/route.ts:6` | `DIRECTOR_API_URL` | PRODUCTION (Director) | blueprint PATCH | same | guarded |
| 4 | `app/api/templates/[id]/enrich/route.ts:6` | `DIRECTOR_API_URL` | PRODUCTION (Director) | template enrich | same | guarded |
| 5 | `app/api/themes/route.ts:6` | `DIRECTOR_API_URL` | PRODUCTION (Director) | theme list / create | same | guarded |
| 6 | `app/api/themes/[id]/route.ts:6` | `DIRECTOR_API_URL` | PRODUCTION (Director) | theme get / patch / delete | same | guarded |
| 7 | `app/api/themes/standard/route.ts:6` | `DIRECTOR_API_URL` | PRODUCTION (Director) | standard theme get / clear | same | guarded |
| 8 | `app/api/themes/[id]/standard/route.ts:6` | `DIRECTOR_API_URL` | PRODUCTION (Director) | set standard theme | same | guarded |
| 9 | `app/api/ingest-jobs/[jobId]/route.ts:15` | `DIRECTOR_API_URL` | PRODUCTION (Director) | template-ingest job polling | **absent** | guarded |
| 10 | `app/api/director/sessions/[sourceSessionId]/handoff/route.ts:8-10` | `DIRECTOR_API_URL`, `NEXT_PUBLIC_DIRECTOR_API_URL` | PRODUCTION (Director) | session handoff | same | guarded |
| 11 | `app/api/slides/compose/route.ts:8` (chain 17-19) | `SLIDE_COMPOSER_DIRECTOR_URL`, `DIRECTOR_API_URL`, `NEXT_PUBLIC_DIRECTOR_API_URL` | localhost (`:8000`) | slide composer compose (also forwards the KG key header when KG is on) | same (line 7) | guarded |
| 12 | `app/api/slides/refine/route.ts:7` (chain 16-18) | same three | localhost | slide refiner | same | guarded |
| 13 | `app/api/slides/jobs/[jobId]/route.ts:7` (chain 16-18) | same three | localhost | compose job polling | same | guarded |
| 14 | `lib/kg-proxy.ts:14-15` (`KG_BASE`) | `KNOWLEDGE_SERVICE_URL` | PRODUCTION (Researcher) | the nine `app/api/knowledge-graph/*` routes (backfill, graph, nodes/[nodeId], purge, search, settings, stats, subscribe, unsubscribe) | per-route `const KG_BASE` in only `purge`, `settings`, `subscribe`; the other six routes and `lib/kg-proxy.ts` are **absent** | guarded; `KG_BASE` export removed, routes resolve per request |
| 15 | `lib/config.ts:9` read by `lib/knowledge-service-client.ts:12` | `NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL`, `KNOWLEDGE_SERVICE_URL` | PRODUCTION (Researcher) | `app/api/upload` (create session, upload file) | same | guarded (client resolves per call; route refuses before any DB write) |
| 16 | `lib/layout-service-client.ts:14` | `NEXT_PUBLIC_LAYOUT_SERVICE_URL` | PRODUCTION (Layout) | **server** use: `app/api/narration/{manifest,render,script}` (`script` also WRITES via `updateSlideNarration`); browser use is row B6 | same file; narration routes **absent** | server presence check in the three narration routes; the browser constant is untouched |
| 17 | `lib/publish/service-urls.ts:19-21` | `LAYOUT_SERVICE_URL` / `NEXT_PUBLIC_LAYOUT_SERVICE_URL`; `NEXT_PUBLIC_DOWNLOAD_SERVICE_URL`; `RESEARCHER_SERVICE_URL` / `KNOWLEDGE_SERVICE_URL` | PRODUCTION (Layout, Downloads, Researcher) | publish snapshot create/delete, publish downloads, published-deck Q&A | Layout and Downloads constants only (no Researcher) | already refused a fallback from a non-production deployment (`NEXT_PUBLIC_APP_URL` not `deckster.xyz`); flag on removes the fallback for production too; flag off adds the warning |

Not changed, on purpose:

| file:line (base) | env var | class | why |
|---|---|---|---|
| `lib/publish/serialize.ts:14` | `NEXT_PUBLIC_APP_URL` | PRODUCTION (own origin `deckster.xyz`) | builds the published-deck link; no outbound call. Unset in UAT yields a prod-origin link, not a prod call. Needs a decision before it can fail closed. |
| `app/sitemap.ts:4` (absent on `main`) | `NEXT_PUBLIC_APP_URL` | PRODUCTION (own origin) | sitemap host only |

Already fail-closed (no default; UAT or loopback only, `requireComposerServiceUrl`): `app/api/composer-library/[...path]/route.ts:37`
(`COMPOSER_DIRECTOR_URL`) and `components/builder/composer-library-dialog.tsx:65,110,135`
(`NEXT_PUBLIC_LAYOUT_SERVICE_URL`, `NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL`). Both absent on `main`.

## Browser-side sites (`NEXT_PUBLIC_*`, inlined at build): listed, behaviour NOT changed

A missing `NEXT_PUBLIC_*` at build time keeps the production default in the shipped JS. No runtime flag
can change that, so the control is the build-time check script below.

| # | file:line (base) | env var | default class | feature | `main` |
|---|---|---|---|---|---|
| B1 | `hooks/use-deckster-websocket-v2.ts:664` (uses at 1289, 2972) | `NEXT_PUBLIC_WS_URL` | PRODUCTION (Director WebSocket) | chat to build, build control endpoint | same (line 466) |
| B2 | `components/build-version-guard.tsx:19-20` | `NEXT_PUBLIC_ELEMENTOR_URL` | PRODUCTION (Text Labs) | build/diagram-catalog version badge | same |
| B3 | `lib/diagram-catalog.ts:431` (default parameter) | `NEXT_PUBLIC_ELEMENTOR_URL` | PRODUCTION (Text Labs) | diagram catalog fetch | same |
| B4 | `lib/elementor-client.ts:33` | `NEXT_PUBLIC_ELEMENTOR_URL` | PRODUCTION (Text Labs) | element generation | same |
| B5 | `lib/textlabs-client.ts:32` | `NEXT_PUBLIC_ELEMENTOR_URL` | PRODUCTION (Text Labs) | chat/infographic/canvas generation | same |
| B6 | `lib/layout-service-client.ts:14` | `NEXT_PUBLIC_LAYOUT_SERVICE_URL` | PRODUCTION (Layout) | viewer iframe origin, slide CRUD, manual deck | same |
| B7 | `lib/api/download-service.ts:10` | `NEXT_PUBLIC_DOWNLOAD_SERVICE_URL` | PRODUCTION (Downloads) | PDF / PPTX download | same |
| B8 | `lib/config.ts:9` (`hooks/use-file-upload.ts:15`, `lib/researcher-upload.ts:14`) | `NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL` | PRODUCTION (Researcher) | browser file upload (also row 15 server side) | same |
| B9 | `lib/config.ts:10` (`components/builder/chat-input.tsx:229`) | `NEXT_PUBLIC_THEME_BUILDER_URL` | PRODUCTION (Theme Builder) | theme builder call | same |
| B10 | `lib/config.ts:5` | `NEXT_PUBLIC_API_URL` | PRODUCTION (legacy host) | no consumer found (`config.api.baseUrl` unused) | same |
| B11 | `lib/config.ts:6` | `NEXT_PUBLIC_WS_URL` | PRODUCTION (custom domain `api.deckster.xyz`) | no consumer found (`config.api.wsUrl` unused); a second, different default for the variable of B1 | same |

No fallback, listed for completeness: `lib/api/layout-service.ts:10` (`NEXT_PUBLIC_LAYOUT_SERVICE_URL`, only a
console warning when unset), `NEXT_PUBLIC_SUPABASE_URL` (checked, missing is reported), `NEXT_PUBLIC_ERROR_REPORTING_ENDPOINT`,
`lib/config.ts:7` `NEXT_PUBLIC_UPLOAD_URL` (relative `/api/upload`, not a service). Hard-coded, not env-driven: `app/layout.tsx:30,37`
(`metadataBase`, own origin), `lib/slide-compose-async.ts:281`, `lib/template-save-gate.ts:35` (a dummy base for URL parsing).

## Counts (uat base `ee532fa`)

| class | sites | notes |
|---|---|---|
| PRODUCTION host, service | 25 | 10 Director route files + `kg-proxy` + 4 in `lib/config.ts` + 3 `PROD_*` publish constants + `layout-service-client`, `download-service`, `diagram-catalog`, `elementor-client`, `textlabs-client`, `build-version-guard`, ws hook |
| PRODUCTION host, own origin | 2 | `lib/publish/serialize.ts`, `app/sitemap.ts` |
| UAT host | 0 | UAT hosts appear only as the approved allow-list of `requireComposerServiceUrl` (2 files), never as a fallback |
| localhost | 3 | slide composer compose / refine / jobs |
| other | 1 | `NEXT_PUBLIC_UPLOAD_URL` relative path |

`main` has the same patterns on a subset of the files (no `ingest-jobs`, `sitemap`, narration, `composer-library`, `lib/kg-proxy.ts`,
`PROD_RESEARCHER_URL`; the three KG routes that exist there carry their own `const KG_BASE`). This PR targets `uat` only; the same
change is a separate, smaller port for `main`.

## Build-time check for the `NEXT_PUBLIC_*` sites (not wired into the build)

```
node scripts/check-public-service-urls.mjs --env uat     # or --env prod
node scripts/check-public-service-urls.mjs --list         # variable, scope, default host, feature
```

Prints names and a status, never a value. Exit 1 when a required variable is unset (and, for `--env uat`, when one is set to the
production default host). `--env local` and `VERCEL_ENV=development` are report-only. Without `--env`, `VERCEL_ENV=preview|production`
is strict. Use `--env`: the UAT and prod Vercel projects both build with `VERCEL_ENV=production`
(`.github/workflows/deploy-uat.yml` runs `vercel build --prod`), so `VERCEL_ENV` alone cannot tell them apart.

How OPS could wire it (suggestion only, nothing is wired): in `.github/workflows/deploy-uat.yml` (and `deploy-production.yml` with `--env prod`)
add a step between "Pull Vercel UAT environment" and "Build Vercel UAT":

```
- name: Check service URLs
  run: |
    set -a; . .vercel/.env.production.local; set +a
    node scripts/check-public-service-urls.mjs --env uat
```

Start it as report-only (`|| true`), then make it blocking once the Vercel variables below are confirmed.

## Set these in Vercel UAT and prod BEFORE turning the flag on

Names only. Server-side variables take effect on the next deploy; `NEXT_PUBLIC_*` need a rebuild (inlined at build). Verify each in
BOTH Vercel projects; the UAT runbook (`documents/07-uat-environment.md`) lists the UAT hosts, production is not recorded there.

Required by the flag (a missing one returns 503 on its routes once the flag is on):

- `DIRECTOR_API_URL`: templates, themes, ingest-jobs (these accept only this name), and handoff / slide composer (these also accept the aliases below)
- `KNOWLEDGE_SERVICE_URL`: the nine knowledge-graph routes, publish Q&A (or `RESEARCHER_SERVICE_URL`), and `/api/upload` (or `NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL`)
- `NEXT_PUBLIC_LAYOUT_SERVICE_URL`: narration routes, publish public layout origin and (unless `LAYOUT_SERVICE_URL` is set) publish snapshots; also the browser viewer (B6)
- `NEXT_PUBLIC_DOWNLOAD_SERVICE_URL`: publish downloads (and the browser, B7)

Accepted aliases / optional: `SLIDE_COMPOSER_DIRECTOR_URL`, `NEXT_PUBLIC_DIRECTOR_API_URL` (slide composer and handoff chains),
`LAYOUT_SERVICE_URL`, `RESEARCHER_SERVICE_URL`, `NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL`.

Not covered by the flag but needed so the browser bundle does not ship a production default (use the check script): `NEXT_PUBLIC_WS_URL`,
`NEXT_PUBLIC_ELEMENTOR_URL`, `NEXT_PUBLIC_LAYOUT_SERVICE_URL`, `NEXT_PUBLIC_DOWNLOAD_SERVICE_URL`, `NEXT_PUBLIC_KNOWLEDGE_SERVICE_URL`,
`NEXT_PUBLIC_THEME_BUILDER_URL`, `NEXT_PUBLIC_APP_URL`, and (advisory) `NEXT_PUBLIC_API_URL`.

The flag itself: `DECKSTER_SERVICE_URL_FAIL_CLOSED_ENABLED=true` (server-only, set last, then redeploy). Roll back by unsetting it.

## Tests

`node scripts/test-service-url-fail-closed.mjs` (`npm run test:service-url-fail-closed`). For every handler in the table above, under an
env matrix (unset, each alias alone, all set, trailing slash, blank, empty, fetch failing), it compares flag-off behaviour (outgoing URL,
method, headers, body, response status/body, other logs) with a golden hash recorded from the `uat` source, and with the `uat` source
itself when `BASE_REF` (default `origin/uat`) is readable. It also covers the warn-once rule, flag-on fail-closed with no outbound call,
flag-on with the variable set, publish service URLs, the narration guard, the `requireServiceUrl` semantics and the check script.
