# Slide Composer: Frontend Slice

**Version:** Phase 0 draft  
**Date:** 2026-06-22  
**Status:** Repo-specific slice; field shapes and enums are canonical in Director  
**Owner in this repo:** Builder pop-up and Next.js proxy

Canonical contract: Director repo [docs/api/SLIDE_COMPOSER_CONTRACT.md](../../../backend/director/docs/api/SLIDE_COMPOSER_CONTRACT.md).

---

## 1. Role

The Builder `SlideGenerationPanel` will let a user request one whole slide for either:

- a brand-new deck, or
- the currently displayed Layout presentation.

The frontend must call only the local Next.js proxy:

`POST /api/slides/compose`

The proxy authenticates with NextAuth, resolves the database user id as `user.id ?? user.email`, injects that `user_id`, then forwards the compose payload to Director:

`POST /api/v1/slides/compose-one`

This flow is REST. It does not go through the Director WebSocket decision engine.

## 2. Rollout Flag

`NEXT_PUBLIC_SLIDE_COMPOSER_ENABLED=false` by default.

`SLIDE_COMPOSER_DIRECTOR_URL` is the server-side Director base URL for the Next.js proxy. It defaults to `http://localhost:8000` for local development when unset.

When false, the frontend must keep the Slide Composer UI and proxy path inert. Producer branches can merge dark without exposing the flow.

## 3. Local Mapping Rules

The exact request/response shapes and valid enum values live in the canonical Director contract.

| Compose field | Frontend source |
| --- | --- |
| `user_id` | NextAuth database user id. This matches the live WS preference of `user.id ?? user.email`. |
| `session_id` | Builder `currentSessionId` / WS hook `sessionId`. Blank Builder V2 creates a UUID before WS connect. |
| `presentation_id` | Current WS/viewer `presentationId`; blank decks use `blankPresentationId` once Director initializes it. |
| `insert_after_index` | `currentSlide - 1` when inserting after the visible slide. Omit/null to append. |
| `instruction` | SlideGenerationPanel free-text input. |
| `selections.*` | Explicit pop-up choices. Present values are authoritative. |
| `research.*` | Current Builder research toggles and uploaded-document state. |

For diagram slides, frontend choices must map to `content_type = "diagram_<variant>"`, for example `diagram_kanban_board`. `diagram_subtype` is supplementary and must stay consistent with the same variant. Values must match the exact strings Director's existing packager emits.

## 4. Response Handling

- `built`: refresh the slide strip/presentation state so the inserted slide appears at `slide_index`.
- `needs_input`: ask the returned questions in the pop-up, then resubmit with the supplied data.
- `error`: show the stage and error list without retrying automatically.

`assume_on_missing=true` is an explicit user choice only.

## 5. Confirmed Live Sources

Verified against current code on 2026-06-22:

- `hooks/use-deckster-websocket-v2.ts` connects to Director with `?session_id=...&user_id=...`.
- The WS user id source is `user.id ?? user.email`.
- `lib/auth-options.ts` writes database `token.id` to `session.user.id`.
- `hooks/use-builder-session.ts` creates a UUID for blank Builder V2 when there is no URL `session_id`.
- `hooks/use-deckster-websocket-v2.ts` captures `blankPresentationId` from `presentation_init` or legacy blank `slide_update`.
