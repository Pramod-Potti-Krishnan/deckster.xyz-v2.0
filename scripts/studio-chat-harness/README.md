# Director chat transcript harness

PASS2-DIRECTOR-CHAT, PR A. Harness only: no file under `app/`, `components/`, `hooks/` or `lib/` changed.

It replays five sanitised Director transcripts through the **real** Director WebSocket hook
(`hooks/use-deckster-websocket-v2.ts`), `MessageList`, `QuestionCard`, `StudioOutlineCard`,
`StudioWelcome`, the Studio header and notice, and the **real page handlers** (`handleActionClick`,
`onSubmitAnswers`, `preflightDirectorTurn`, `onMessage`, the typed-turn options, and every
`<MessageList .../>` prop expression), extracted by AST from `app/builder/page.tsx` and
`hooks/use-builder-session.ts`. Baselines were recorded from `origin/studio-v4-dev-preparation-code`
@ `5cc455d`, so PRs B to D can prove flag-off identity and byte-identical sends.

```
node scripts/test-studio-chat-transcripts.mjs            # compare with the baselines (also: pnpm test:studio-chat-transcripts)
node scripts/test-studio-chat-transcripts.mjs --update   # re-record (flag-off, default env only)
node scripts/test-studio-chat-transcripts.mjs --structural --env NEXT_PUBLIC_STUDIO_CHAT_<X>=true
                                                         # flag-on: everything except markup must still match
```
Other options: `--only <fixture,..>`, `--profile <studio|studio-plain|classic,..>`, `--full` (raw diffs),
`--verbose` (stacks), `--out <dir>` (write the actual snapshot), `--list`, `--crosscheck` (compare the offline
React host with react-dom's server render, diagnostic only). Runs in about 2 s. Exit 0 pass, 1 fail, 2 usage.

## What is checked, per transcript x profile

| File (under `scripts/fixtures/director-chat/baselines/<fixture>/<profile>/`) | Contents |
|---|---|
| `outbound.ndjson` | every byte put on the fake socket (`user_message` JSON, control frames, heartbeats), handshake URLs, client closes. Failures show the first differing byte with context. |
| `keys.json` | ordered React keys of `MessageList`'s children (+ role, action id, button/input counts) and the hook's ordered `message_id`s, at every checkpoint |
| `calls.json` | every handler call with its arguments: `ml.onActionClick`, `ml.onSubmitAnswers`, `ml.onEphemeralFadeComplete`, `ml.onDraftPrompt`, hook callbacks (`hook.onMessage`, `onSessionStateChange`, ...), page toasts, persistence queue |
| `state.json`, `cache.json` | hook + page state digest per checkpoint (messages, ephemeral ids, `currentStatus`, connection/reconnect state, deck urls, answered actions) and the sessionStorage cache JSON |
| `markup.json`, `markup/*.html` | sha256 of the rendered chat markup, and of header + notice, per checkpoint; full pretty-printed HTML is stored for the `studio` profile |
| `env.json`, `meta.json` | profile environment, fixture hash, diagnostics (console errors/warnings, blocked network, leftover timers) |
| `baselines/_sources.json` | dependency versions and sha256 of every page region the harness executes (a changed handler or prop expression fails here first) |

Profiles: `studio` (Studio shell, MDC cards and structured questions on), `studio-plain` (shell on, structured
questions off), `classic` (pre-Studio plain-button asks). All flag-off for the new chat flags.

## Transcripts (`scripts/fixtures/director-chat/*.json`)

1. `normal-build`: blank deck init, empty-chat welcome (starter click), typed brief, ephemeral thinking stream,
   plan gate, outline (`slide_context` + `slide_update` + `presentation_url` + approval -> combined strawman card),
   final deck, Done; then a payload matrix of direct hook sends (every optional `user_message` field, `set_theme`,
   control frames, `element_directive_result`).
2. `ask-card-flow`: structured question card (select, free text, deselect, reselect, submit with `display_text`),
   plain action fallback, answered gate, same-id re-send (upsert), `requires_input` action.
3. `reconnect-mid-build`: socket drop mid build, backoff reconnect with `skip_history=true`, `sync_response`
   (`send_delta`), replayed duplicate frame and replayed `msg_plan_confirm_<session>`, browser offline/online
   (`paused_offline`), approval sent on the new socket. Runs with `stableHandlers` so the ephemeral fade completes.
4. `error-retry`: `status_update` error, `error`, `auth_expired` (discarded `user_message`), `auth_refresh_failed`,
   resend that clears the notice, `auth_refreshed`.
5. `history-reload`: database-shaped rows restored through the Builder's own split into user turns and Director
   frames (duplicate outline replays, resend after "ready", repeated greeting), reconnect, a new turn, second reload.

Steps: `ensureConnected open frame raw close advance offline online typed send control theme elementResult click
change restore unmount mount props checkpoint expect`. Every step may carry `dt` (virtual ms before it, default 500),
`profiles` and `comment`. `expect` steps guard the fixture itself (it still exercises what it claims). Clicks select
by `{within:{key|action}, tag, text, attrs, index}`; prefer the React key, tag and visible text over classes.
All data is synthetic (`*.invalid` hosts, `synthetic-*` ids). Time is virtual and ids are deterministic.

## How it stays offline and honest

Patterns reused from the existing tests: TypeScript transpiled into `node:vm` with services refused (`test-director-chat-parity`), the reconnect plan
and constants exercised through the real hook (`test-director-websocket-reconnect`), a fake socket that records `send()` (`test-studio-director-transport`).

Repo TypeScript is transpiled into one `vm` context with fake `WebSocket`, `fetch` (only `/api/director/ws-token`
answers), timers, `Date`, storage and `console`. Node built-ins are refused by the loader and `net`/`dns`/`fetch`
are blocked in the host process. A small React host (`mini-react.mjs`) installs itself as React's hook dispatcher so the
repo's own hooks run unmodified. Its self-test (every run) pins eager `setState` updaters, effect ordering and keyed
identity, and checks that real components serialise like react-dom. Page code that references something the harness
does not provide throws a named error instead of reading `undefined`.

Fidelity limits (deliberate): no StrictMode double invoke and no concurrent rendering; the composer (`ChatInput`) is
not rendered (PR D needs a composer panel: render it from `jsxAttributes(page, 'ChatInput')` like the header);
`recoverRestoredLayoutViewerUrls` is skipped (URLs are policy-allowed); the typed-turn *commit* is mirrored from the
tail of `handleSendMessage` while its option object is the page's own expression; page state outside the chat
(templates, uploads, quota) sits at defaults; MDC flags (`CHAT_DIRECTIVES`, `CHAT_MENTIONS`) are off; icons render as
`<svg data-icon="Name">`.

## Findings while building (all pre-existing at base)

- The production `onEphemeralFadeComplete` is `clearEphemeralIds`, whose identity changes every render because
  `useSessionCache` returns a new object each render. `MessageList`'s fade effect then cancels its own 350 ms timer on
  any parent re-render and never re-arms it, so ephemeral rows stay in the DOM at `opacity-0`. `normal-build` records
  this; `reconnect-mid-build` (`stableHandlers`) records the intended fade. Not changed here.
- Most existing Director chat tests already fail on this base: `test-director-chat-parity` (unstubbed
  `@/lib/studio-director-message-policy`), `test-director-question-submit` / `typed-commit` / `action-scope`
  (`ServiceUrlConfigError` not defined), `test-studio-director-transport` / `handoff` / `history-presentation` /
  `outline-admission` / `first-send-page` / `websocket-configuration` (fixtures under `docs/studio-v4/...` are not in the
  tree), `test-studio-composer-send` / `director-presence` (git objects absent). That is why this harness is
  self-contained rather than importing them.

## Plan line references re-verified at `5cc455d` (CHAT-PLAN, WS-SAFETY-MAP, CHAT-AUDIT)

Correct as written (checked line by line): WS 64-67, 69-99, 1048-1104, 1072-1075, 1248-1263, 1296-1326, 1377, 1382, 1604-1608,
1613-1615, 1662, 1751-1754, 1774, 1786, 1962-1965, 2087-2093, 2096-2710, 2098-2108, 2110-2118, 2120-2125, 2127-2193, 2195-2258,
2326-2521, 3253, 3366-3412, 3415, 3429, 3446, 3475, 3776; PG 2176-2177, 5036, 5601, 6109, 6195, 6206-6219, 6253-6265, 7058, 7119;
ML 145, 198-199, 208-221, 255-286, 423, 432, 522-545, 630, 647, 686-708, 713, 749-810, 812; DHP 58, 84-109; CI 1031-1046;
`use-builder-session.ts` 583; `studio-director-header.tsx` 14-33. Approximate: WS 1431-1525 (`scheduleReconnect` is 1444-1520).

Corrected:

| Plan says | Actual |
|---|---|
| WS 1997 reducer `isCurrentSocket` guard | 2007 (`setStateWithCache(prev =>` at 2004) |
| WS 2000 `isDuplicate` | 2010 |
| WS 2003-2023 `shouldAddToMessages` | 2013-2033 |
| WS 2031-2052 upsert, 2034 `projectVerifiedOutlineReplay` | upsert 2040-2041 and map 2043-2063; projection call 2043 |
| WS 1832-1858 auth/transport frames | 1829-1869 |
| WS 1796-1858 pre-allowlist handlers | 1796-1869 (allowlist check follows) |
| PG 7059-7063 notice | 7060-7064 (header 7058-7059) |
| PG 7067 `TokenUsageStrip` | 7070 |
| PG 2423 "starter prefill" | `onSessionDirective` new-session auto-send. Starter prefill is `onDraftPrompt` at 7099 and never sends |
| ML ~866 standalone `QuestionCard` | 872 |
| ML ~885 plain-button fallback | 886-917 (buttons 900); the combined-strawman fallback is 720-741 |
| ML ~860 `HistoricalActionCard` call | two call sites: 710 (combined) and 862 (standalone) |
| ML ~962 "preview-ready" row | the row is 686-708; 962 is the `presentation_url` branch, which renders `null` |
| ML ~984 status pulse | `showWorkingPulse` block 983-1004 (decision at 572) |
| ML ~300-564 `useMemo` | 288-564 |
| ML ~913 legacy outline | 913-957 (`StudioOutlineCard` at 923) |
| CHAT-AUDIT ML 85-96 plain action buttons | those lines are the props interface; see 720-741 and 886-917 |

Content corrections for PR C (item 4): `QuestionCard` already shows `N of M answered` in its heading and
`Send answers (k/N)` on the button (`question-card.tsx` 118 and 188), and the outline-approval heading is
"Review your outline", not "Approval needed". Item 8 has two call sites. Items 1 and 5 touch 7 avatar/speaker
blocks (ML 622, 640, 761, 818, 867, 888, 918, 985).
