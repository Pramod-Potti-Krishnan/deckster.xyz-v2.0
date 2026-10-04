# Implementation brief

## Ownership and isolation

Own new files under `components/builder/voice-interactive/`, a dedicated hook/helper folder if needed, and focused tests for those files. Integrate with the smallest possible changes to `components/builder/chat/studio-director-header.tsx` and `app/builder/page.tsx`. Treat these two as shared integration seams: keep changes isolated and report them explicitly. Do not rewrite the Builder, move its live viewer/socket, replace the composer, or edit the WebSocket payload contract. Keep CSS scoped to the new feature subtree. Avatar source may be adapted within the new folder.

Read-only boundaries include `hooks/use-deckster-websocket-v2.ts`, chat question/action dispatch, existing generation/cancellation, auth/quota/billing, narration/publish/Q&A routes, navigation/Atlas workspaces, backend services, deployment configuration, database schema and user records. If a change to a boundary is essential, describe the exact seam in the handoff instead of silently broadening this slice.

## Deliver one complete slice first

1. Add the default-off flag and mount a small call controller beside the existing Director header. Preserve exact header/chat behavior when it is off.
2. Voice view: keep full chat and its real composer mounted. Add compact avatar, honest activity state, mute/output control and End. Interactive view: render the existing avatar large, live text/captions and current real question/actions; retain typed fallback through the existing composer. Switching modes must not reconnect the socket or replace the active session.
3. Route submitted typed or confirmed speech text through Builder’s existing `handleSendMessage` admission path. Reuse existing structured question/action callbacks for selected options. Preserve requires-input, approval, disabled, quota, connection and stale-target checks. Never interpret arbitrary recognized words such as “yes” as privileged execution. Spoken approval needs an explicit visible confirmation using the existing action identity before any submission.
4. End stops capture/output and pending callbacks, restores chat focus and keeps actual conversation history. Ending media must not cancel an in-progress generation job; keep those controls separate. Reset media on session/deck/account change, lost access, unmount, hidden tab and reload. Do not auto-start a microphone or auto-resume calls. Avoid promising persisted call history until the real persistence path supports it.
5. Complete responsive light/dark states and relevant focused checks. If time remains, connect only proven available device speech output/input; disabled states are required wherever the real dependency is absent. Never invent provider endpoints, account entitlements or pricing from the mock.

## Flag and rollback

Proposed new flag: `NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE`. Enable only when both it and the existing `NEXT_PUBLIC_STUDIO_V4_SHELL` equal the literal string `true`. Missing, empty, `false`, `TRUE`, `1`, or any other value means OFF. Centralize this check. The new flag must not turn on existing narration/Q&A or change authorization.

Default OFF in source and example configuration. The frontend public environment value is compiled into the client build; activation or rollback requires a dev rebuild/redeploy by Architect. Enable by setting both flags to literal `true` in the isolated dev configuration; disable by removing the new flag or setting it to `false` and rebuilding. Verify the disabled artifact contains no mounted call controls, microphone request, media timer, speech playback or new network requests. Do not claim an immediate runtime kill switch unless one is actually implemented and verified. Do not use localStorage as a hidden authorization bypass.

## What to verify

- OFF/unset/invalid flags: existing Builder DOM, sends, composer inputs/options, question callbacks and published narration/Q&A are preserved; no new media permission request or transport.
- ON: chat → voice → interactive → chat retains session/deck identity, unsent draft and one mounted viewer/socket. Actual sends use the same admission/transport path and appear once. Socket queueing is not proof of a server reply.
- Real supported speech only: explicit start, denial/unsupported/error handling, editable transcript before Send, mute, output interruption, no overlap/double send, stale callback refusal, complete media cleanup. Do not test against another person’s records.
- Current question/choice presentation preserves every action value, input requirement, confirmation and target. A stale spoken answer cannot approve a newer question or a different deck.
- End, hidden tab, account/deck/session change, lost eligibility, unmount and reload stop media. Permission denied and unavailable voices keep text usable. Reduced motion pauses avatar motion appropriately; captions remain readable.
- Keyboard access, Escape/focus return, accessible button names, visible status; test wide light, short dark and narrow mobile for clipping and usable composer/End controls. Match the supplied avatar and pane treatment.
- Run targeted checks appropriate to changed files and the relevant existing Director ownership/send checks. Report actual compiler/test results and inherited failures honestly; a screenshot or fixture is not a connected service pass.

## Time box and return

At 02:50 AM Eastern stop adding scope and finish focused checks/screenshots. At **03:00 AM Eastern on 4 October 2026 stop work** and hand back the coherent branch/commit or patch, changed files, flag activation/rollback, three representative screenshots, check results, and a short working/unavailable/remaining list. Do not deploy, run a database migration, alter existing-user records, bypass login/quotas or start a new provider setup to consume the remaining session budget.
