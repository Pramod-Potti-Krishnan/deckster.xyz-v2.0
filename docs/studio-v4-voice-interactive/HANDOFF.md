# Studio v4 Director voice & interactive avatar: handoff

Branch `studio-v4-voice-interactive` (local, not pushed), cut from `origin/studio-v4-dev` at `574091f`. It is not merged, pushed to a deployed branch, or deployed. It needs the Architect's review and approval before integration.

## What it does

When the flag is on, the Director header gets two entry buttons: **Voice call** and **Interactive Director**. Both open a call layer above the existing chat, inside the same pane.

- **Voice**: a compact strip under the header. It has call controls (mic, spoken replies, view switch, End), the Director's portrait with an honest activity line, a pinned "Director asks" pointer, and the full chat and real composer underneath.
- **Interactive**: the supplied cap-and-notebook Director, shown large. It has a "Camera not used" self tile, the activity line, the "Director asks" pointer, captions of the latest You/Director turns, and a "Type to the Director" button. The real chat and composer stay mounted below it.

Neither view owns a transport. Messages, questions, approvals, the composer and drafts are the Builder's existing ones. Typed turns go through the unchanged `handleSendMessage` / `ChatInput` path. Answers go through the unchanged `QuestionCard` callbacks.

The "Director asks" pointer only scrolls to the real question card and focuses it. It never answers, so action values, requires-input, confirmations and targets are untouched.

## Capability truth

| Capability | State | Why |
|---|---|---|
| Typed conversation in a call | **Works** | Same session, socket, send path and admission checks as chat |
| Voice input (mic / dictation) | **Disabled, by design** | No approved Director speech-input contract exists. Browser recognition may send audio to the browser vendor. The mic button is always disabled and the reason is visible. `getUserMedia` and `SpeechRecognition` are never called. |
| Spoken replies | **Works where an on-device voice exists, opt-in** | `speechSynthesis` is used only with a `localService` voice, and only after the user presses "Read replies aloud". Only replies that arrive after opt-in are read; long replies are clipped and the full text stays in chat. The control is disabled with the reason when there is no synthesis or no local voice. |
| Avatar motion | Decorative, state-driven | idle / thinking (awaiting reply) / noting (building) / speaking (local playback). It is never "listening", because nothing listens. The supplied motion hook handles reduced motion, hidden tabs and offscreen pausing. |
| Spoken approvals | **Not implemented** | Nothing is recognised, so nothing can approve. Approvals stay on the real card. |
| Call history / summary | Not implemented | There is no persistence path, so nothing is promised. |
| Cross-workspace continuation | Not implemented | Leaving the Builder unmounts the call, and everything stops. |

## Lifecycle

- **End** stops speech, turns output off, returns to chat and focuses the composer. It does **not** cancel a generation; Stop stays on its own control.
- **Hidden tab or pagehide** stops speech and turns output off. **Unmount** cancels speech.
- **Scope change** ends the call when the account, session or deck switches from a known value or is lost. A first assignment does not end it (null → a new session or deck created during the call).
- **Escape** inside the call layer returns focus to the composer and leaves the call open.
- Nothing auto-starts and nothing auto-resumes after a reload.

## Flag: activation and rollback (rebuild required)

The feature is on only when **both** of these are the literal string `true`:

```
NEXT_PUBLIC_STUDIO_V4_SHELL=true
NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE=true
```

Any other value is OFF, including missing, empty, `false`, `TRUE`, `1` or `" true"`. The check lives in one place, `lib/studio-voice-interactive.ts` (`STUDIO_VOICE_INTERACTIVE_ENABLED`). `.env.example` defaults it to `"false"`.

These are `NEXT_PUBLIC_*` values, so they are compiled into the client bundle.

- **Activate:** set both in the isolated dev Vercel project, then rebuild and redeploy.
- **Roll back:** remove the new flag or set it to `false`, then rebuild and redeploy.

There is no runtime kill switch, and localStorage is not consulted.

When OFF:
- The header gets `actions={undefined}`, so its DOM is unchanged.
- The panel is not rendered.
- The hook returns `mode: "chat"` and refuses `start`. All of its timer, listener, capability and speech effects are gated on an open call, so no microphone, timer, speech or network activity starts.

## Files

New:
- `lib/studio-voice-interactive.ts`: the flag, capability truth and pure helpers.
- `components/builder/voice-interactive/use-director-call.ts`: call state, timer, opt-in local speech output and lifecycle.
- `components/builder/voice-interactive/director-call.tsx` and `director-call.css`: entry buttons, voice strip, interactive stage, ask pointer. Scoped CSS that uses the Studio `--ss-*` tokens, so light and dark both work.
- `components/builder/voice-interactive/director-character.tsx`, `director-character.css`, `use-director-motion.ts`: the supplied avatar. The art and motion are byte-identical; CSS selectors are scoped under `.director-character`, and there is a named export.
- `scripts/test-studio-voice-interactive.mjs`, run with `npm run test:studio-voice-interactive`.
- `docs/studio-v4-voice-interactive/`: this handoff and the screenshots.

Changed (shared seams, kept small):
- `components/builder/chat/studio-director-header.tsx`: an optional `actions` prop, rendered after the status.
- `app/builder/page.tsx`: three imports, the `voiceInteractive` constant, one `useDirectorCall(...)` call, header `actions`, and one gated `<DirectorCallPanel>`. Nothing else in the Builder, socket hook, composer or question card changed.
- `package.json`: one test script.
- `.env.example`: the default-off flag, with a comment.

## Verification (4 Oct, seat-2 Mac)

| Check | Result |
|---|---|
| `npm run test:studio-voice-interactive` (new) | 55/55 pass: flag truth table, capability truth, local-voice choice, reply text, pending ask, static OFF/no-media guards |
| Existing checks: `builder-presentation-ownership`, `director-websocket-reconnect`, `director-sync-recovery`, `user-message-attachments`, `deck-identity`, `build-narration`, `qa`, `narration` | All pass |
| `tsc --noEmit` | No new errors. 11 pre-existing errors in Stripe and `mock-token` files are unrelated; on this Mac they come from the local `node_modules` versions. |
| `next build --experimental-build-mode=compile` with flags on | Compiles, exit 0. Compile mode defers env inlining, so the OFF bundle was checked at runtime instead (next row). |
| Live headless Chromium on `next dev`, using a temporary harness route that mirrors the Builder wiring (deleted afterwards) | All pass. Flag ON: entry buttons; voice/interactive switch with no timer reset and the draft kept; opt-in speech reads only new replies, newest wins, never overlaps; no local voice disables the control with its reason; hidden tab stops speech; session/deck switch ends the call while a first assignment does not; End restores focus to the composer; Escape returns focus to the composer; Tab order and accessible names; reduced motion gives `data-motion="reduced"`; "Answer in chat" focuses the real card; a keyboard start puts focus on the call section (re-run at `5dc39e5`). Flag OFF (unset and `TRUE`): header has exactly its original 3 children, no call DOM, and zero `getUserMedia`, `speechSynthesis`, timer or WebSocket activity. |
| Scope-change end while focus is inside the call: focus now goes to the composer instead of BODY (added after the last live run; covered only by tsc and the static tests) | Not re-run live |
| Signed-in Builder end to end | **Not run.** It needs a real sign-in, and no auth bypass was used. The first enablement on the dev app should do a typed turn in voice and in interactive, answer a real question card, and End during a build to confirm generation continues. |

Screenshots: `light-wide.png`, `dark-short.png` and `narrow-mobile.png` are static renders of the real components with the shell tokens. `live-*.png` come from the live harness in headless Chromium. None of them is the signed-in Builder.

## Visual departures from the mockups (functionality first)

1. The mockups show the question on top of the avatar. Here the **real** question card stays in the chat, and the call layer shows a pinned "Director asks" pointer that jumps to it. This avoids a second answer path that could drift from action identity and confirmation.
2. The mockups show the composer as a sheet. Here the real composer stays docked and mounted in both views, which keeps drafts, options and uploads intact. "Type to the Director" focuses it.
3. The mockups say "Recording to chat" and show a live Talk button. Here it reads "Typed turns · voice input off" and the mic is disabled, because nothing records.
4. The mockups show a "Camera off" self tile with initials. Here it reads "Camera not used": no camera is involved and no profile data is shown.

## Needs Architect attention

- The two shared seams (`page.tsx`, `studio-director-header.tsx`) for merge order with other Studio work.
- Speech input needs an approved contract (provider, privacy, budget) before the mic can be enabled. A spoken-approval read-back policy is needed after that.
- In the interactive view on short screens, the stage (clamped to 150–380 px) leaves less room for the transcript. A collapsible stage could be added later.
- The repo has no ESLint config, so lint was not run.
