# Knowledge connectors (Google Drive) — end-to-end status

Audited 2026-11-09 against live refs: Researcher `origin/uat` (uploads-v1.0), Director `origin/uat` (director-v4.0),
Studio `origin/studio-v4-dev-preparation-code` + open PRs. Every hop is dark (flag off by default).

| # | Hop | Status | Where (file:line) | Flag |
|---|---|---|---|---|
| 1 | Studio OAuth start/callback (state + nonce, drive.file) | OPEN-DRAFT PR #566 | `lib/connectors-gdrive-server.ts` handleStart/handleCallback; `app/api/connectors/gdrive/{start,callback}/route.ts` | `NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED` |
| 2 | Researcher code exchange + encrypted token store | MERGED (uat) | `routers/connectors.py:122` exchange; `services/connectors/crypto.py`, `store.py:32` | `RESEARCHER_CONNECTORS_ENABLED` + `RESEARCHER_CONNECTOR_GDRIVE_ENABLED` (`main.py:284-295`) |
| 3 | Picker access token → Google Picker | MERGED (Researcher `connectors.py:147`) / OPEN-DRAFT Studio #566 (`lib/gdrive-picker-loader.ts`) | | same |
| 4 | Pick files → library items + enqueue fetch | MERGED | `connectors.py:336` POST items; worker `services/connectors/fetch_task.py:53` | same |
| 5 | Ingest (parse/index) via upload queue, swap-on-ready refresh | MERGED | `services/connectors/lifecycle.py:33`; `connectors.py:314` refresh | + `RESEARCHER_CONNECTOR_GDRIVE_SYNC_ENABLED` |
| 5b | Scheduled sync + folder picks | OPEN-FROZEN !251 | branch `knowledge/connectors-gdrive-sync-folders` | `..._GDRIVE_SCHEDULED_SYNC_ENABLED` |
| 5c | Library-session E2E test (worker→indexer→retrieval) | OPEN-FROZEN !258 (targets deleted branch; retarget pending PK) | `tests/test_connectors_lib_session_e2e.py` | test only |
| 6 | Link library items into a chat session (Researcher) | MERGED | `connectors.py:408` POST / `:433` DELETE session-links | + `RESEARCHER_CONNECTOR_SESSION_LINKS_ENABLED` |
| 6s | Link items from Studio (server route) + `linked_item_ids` on build message | **WAS MISSING → this PR** | `app/api/connectors/gdrive/session-links/route.ts`, `lib/connectors-gdrive-session-links.ts`, `hooks/use-deckster-websocket-v2.ts` (`linkedItemIdsField`) | **new** `NEXT_PUBLIC_STUDIO_CONNECTORS_SESSION_LINKS_ENABLED` |
| 6u | Builder UI: "Add from Drive" in the chat source tray calling 6s | MISSING (not built; needs PK UX call) | — | — |
| 7 | Director honours linked items as upload sources | MERGED dark (!623, audit !626) | `src/utils/connector_linked_items.py`; `src/handlers/websocket.py:3174`, `:5384`; `config/settings.py:1642` | `DIRECTOR_CONNECTOR_LINKED_ITEMS_ENABLED` |
| 8 | Retrieval scopes linked items | MERGED | Researcher `services/per_slide_rag_retriever.py:717` → `session_links.py:58` | session-links flag |
| 9 | Provenance on citations (title/url/modified) | MERGED (Researcher) | `services/slide_detail_service_v2.py:395-410`, `services/connectors/provenance.py:42`, `session_links.py:106` | session-links flag |
| 9s | Studio shows a Drive source badge on citations | **BUILT dark** (slide strip on the canvas while it builds; the slide's own footer is Slide Builder's, untouched). Reads `slide_context.slides[].content.source_citations[].source_origin` (`source_type` "gdrive", `title`, `source_url`); needs Director `DIRECTOR_CITATION_SOURCE_ORIGIN_ENABLED` + signed WS admission | `lib/connectors-gdrive-citations.ts`, `components/builder/studio-citation-sources.tsx`, `components/build-narration/slide-context-card.tsx` | `NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED` |
| 10 | Disconnect: revoke + mark items + unlink | MERGED | `connectors.py:357` (`content_erased: False`, TODO K-07 at `:368`) | gdrive flags |
| 10e | Disconnect real erase (owner erase `item` scope) | OPEN-FROZEN !262 | `services/connectors/providers.py` `disconnect_cleanup` / `erase_items` | `RESEARCHER_CONNECTOR_PROVIDER_UNIFY_ENABLED` + `RESEARCHER_OWNER_ERASE_ENABLED` |
| 11 | Remove ONE item with real erase (CJ6) | **WAS MISSING → Researcher draft MR (stacked on !262)** | `DELETE /api/v1/connectors/gdrive/items`, `providers.erase_one_item` | **new** `RESEARCHER_CONNECTOR_ITEM_REMOVE_ENABLED` |
| 11s | Studio proxy + UI for remove-one-item | MISSING (follow-up once 11 lands) | — | — |
| — | Notion / OneDrive (out of scope here) | OPEN-FROZEN !260 / !261 | | own flags |
| — | Owner = cuid on chat upload | OPEN-DRAFT PR #586 | | `NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED` |

## Blocked on PK
- Retarget !258 (deleted target branch); land/retarget the frozen stack !251→!260→!261→!262, then retarget the new item-remove MR to `uat`.
- Google OAuth client for the connector (`GOOGLE_CONNECTOR_CLIENT_ID` / `_SECRET`, Picker key/app id) + redirect URI on the UAT host — names only, not set here.
- Tier gate decision C1 (connector currently reuses Knowledge entitlement).
- UX for the Builder "Add from Drive" tray (6u) and Drive citation badge (9s).
- Any live probe (real Google account, paid model calls) — none were run.
