# Change the theme and export from chat: one free live check (after merge)

FRONTEND-2, Pass 3. Studio flags `NEXT_PUBLIC_CHAT_THEME_CHANGE` and `NEXT_PUBLIC_CHAT_EXPORT` (this PR, independent of each other). Director
`DIRECTOR_MDC_THEME_CHANGE_ENABLED` and `DIRECTOR_MDC_EXPORT_ENABLED` (+ `CHAT_CAP_CHANGE_THEME`, `CHAT_CAP_EXPORT`; Director !513, merged to
`uat`, off). Offline proof: `scripts/test-studio-chat-theme-export.mjs`. This plan is the first check against deployed services.

**Nothing in it is a paid generation.** The model turn that decides `change_theme` / `export_deck` is Director's ordinary chat turn, and so are
the Download service's conversions (no LLM). **A theme change WRITES the deck** (Director's `set_theme` re-themes the presentation through
Theme Builder and Layout, and Layout versions it), and UAT shares the production Supabase. Run it on a throwaway deck only (below).

## Preconditions (OPS-2)

1. Director !513 is deployed on UAT with `MULTI_INTENT_ENABLED`, `DIRECTOR_MDC_THEME_CHANGE_ENABLED=true` and `DIRECTOR_MDC_EXPORT_ENABLED=true`.
   Check `/health`: `feature_flags.<FLAG>` and `<FLAG>_RAW_PRESENT` both true, and `chat_capabilities_effective.change_theme` / `.export` true.
2. Studio is built with `NEXT_PUBLIC_CHAT_THEME_CHANGE=true`, `NEXT_PUBLIC_CHAT_EXPORT=true` and `NEXT_PUBLIC_CHAT_DIRECTIVES=true`. These are
   build-time values, so the Studio deployment is rebuilt after setting them. It must be the Studio v4 deployment, with every
   `NEXT_PUBLIC_*_URL` (incl. `NEXT_PUBLIC_WS_URL` and `NEXT_PUBLIC_DOWNLOAD_SERVICE_URL`) pointed at UAT, or it silently talks to production.
3. A THROWAWAY deck: duplicate an existing built deck (more than one slide) into a new session, or use one made for testing. Never a deck
   someone uses. Do not build a new one for this.
4. One person driving the browser, DevTools open on the Director WebSocket frames and the Network tab. Treat UAT data as production data: no
   screenshots or HAR files that include tokens.
5. Chrome first; then repeat rows 4 to 6 in Safari (download behaviour differs, see "Browser downloads").

## The check (about 15 minutes)

| # | Do | Expect (WS frames / chat) | Proves |
|---|----|---------------------------|--------|
| 1 | Open the throwaway deck. Type "hello". | `user_message.data.client_caps` = `["mdc1","theme1","export1"]`. | Both Studio flags are on and built in. |
| 2 | Type "Switch the deck to the dark theme". | Inbound `theme_directive {selection:{mode:"preset", preset_id:"corporate_dark"}}` (never a chat bubble), then "Changing the theme to Corporate Dark. One moment while it applies to the deck." Outbound `set_theme {request_id:<a Studio uuid>, theme:{mode:"preset", preset_id:"corporate_dark"}, presentation_id:<the deck>}`; inbound `theme_sync` `syncing` then `applied` for that request id; outbound `element_directive_result {status:"applied", error_code:null}`; Director: "Done. The deck now uses Corporate Dark." The slides re-render dark; the theme picker shows Corporate Dark. | Directive delivery; the picker's apply on a BUILT deck (the picker itself stays locked: row 3); Studio's own request id; the result frame; Director's closing line. |
| 3 | Open the theme picker. | It still says the build selections are locked (as before this PR): Apply is disabled. | The picker's lock is unchanged; only the chat directive passes it. |
| 4 | Type "Use our brand colour #1A73E8 for the deck". | `theme_directive {selection:{mode:"custom", primary_hex:"#1a73e8"}}`; `set_theme` with that selection; `applied`; "Done. The deck now uses your brand colour #1a73e8." | The brand-colour path. |
| 5 | Type "Export this as a PDF". | `export_directive {format:"pdf"}`; Network: one `POST <downloads>/convert/pdf` with `quality:"high"`; the browser saves `<deck id>_<date>.pdf`; `element_directive_result {status:"done"}`; "Done. Your PDF is downloading now." | The Download menu's path from chat, its default quality, `done` = download started. |
| 6 | Right after row 5, type "Download it as PowerPoint". | `export_directive {format:"pptx"}`; `POST /convert/pptx` with the deck's `slide_count`; a `.pptx` saved, or the browser's "multiple downloads" prompt (see below); `status:"done"`. | The PPTX path, and the browser's second-download rule. |
| 7 | Restore the deck: type "Switch to the light theme" (or use Version history). | `applied`; the deck is back to Corporate Light. | Leaves the throwaway deck as it was. |

Pass: every row matches, the directives never show as chat bubbles, nothing appears twice, the turn unlocks after each receipt line, and the
console shows no errors from the runner.

## Browser downloads (Studio cannot see this; this row is why the check exists)

A download started from a WebSocket message is NOT a user gesture. `downloadPDF` / `downloadPPTX` fetch the file and click a hidden anchor
(`lib/api/download-service.ts triggerDownload`), and they report success once that click is made. If the browser then blocks the file or asks
first, Studio still reports `done`: it cannot detect it, so it never sends `download_blocked` (or `dismissed` for a refused prompt). Record per
browser:
- Chrome: is the first chat export saved without a prompt (row 5)? Does the second one in a row (row 6) raise "This site is trying to download
  multiple files" with Allow / Block? What does Block do (nothing saved, no error in the page)? Does Allow persist for the site?
- Safari: is the first chat export saved, or blocked as not user-initiated? Does it ask "Do you want to allow downloads on …"?
- If any browser blocks the FIRST chat export without a prompt, `done` is misleading there: report it to FRONTEND-2 before any flip to users
  (the fix would be a Studio follow-up, e.g. a "Download ready" button in the chat that the user clicks).

## Also worth seeing (free, optional)

- Type "Make it neon": Director asks which theme (no directive). Type "Download the deck": it asks PDF or PowerPoint.
- While a slide is being composed, ask for a theme change: Director's "Work on the deck is still in progress…" (G5), no directive.
- A chat export shows no feedback in the Download menu (the menu's toast and status line belong to the menu); Director's line is the feedback.

## Rollback

Anything unexpected: turn the Studio flag(s) off and rebuild (the chat is then exactly as before; Director answers a client without the cap
with its text fallback that names the picker or the Download menu). Director's own flags off stop it on Director's side too. A theme change made
during the check is undone by row 7 or by Version history.

## What this needs

- From OPS-2: the Studio v4 deployment target and its env check, the throwaway deck, the flag flips in the same environment, a free slot.
- From PK (via PROGRAM-1): the flip decision. Note for it: from chat, a theme change applies to a BUILT deck, which the theme picker refuses
  ("Build selections locked"); this follows E4a and the contract (§6.3), and the picker itself is unchanged.
