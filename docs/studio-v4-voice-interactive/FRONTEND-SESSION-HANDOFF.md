# Director voice & interactive avatar: handoff to the frontend session

Built on seat 2 (PK's second Mac) overnight on 4 Oct 2026, against the brief in `public/dev-handoffs/voice-interactive/`. Start here, then read [HANDOFF.md](HANDOFF.md) for the full detail: capability truth, lifecycle, verification table and visual departures.

## Where it is

- **Branch:** `studio-v4-voice-interactive` on `origin` (GitHub `Pramod-Potti-Krishnan/deckster.xyz-v2.0`). It is **not** merged into `studio-v4-dev` and **not** deployed.
- **Base:** `studio-v4-dev` at `574091f`.
- **Commits:**
  - `4fa0801` feature
  - `5dc39e5` keyboard focus lands in the call on start
  - `e45f91c` scope-change end focus, handoff docs and screenshots
  - plus the commit that adds this file
- **Rule from the brief:** do not merge without the Architect's review and explicit approval.

```
git fetch origin studio-v4-voice-interactive
git log --oneline origin/studio-v4-dev..origin/studio-v4-voice-interactive
```

## What it is, in one paragraph

A default-off flag, `NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE`, which also requires `NEXT_PUBLIC_STUDIO_V4_SHELL`; both must be the literal `true`. With it on, the Director header gets two entry buttons:

- **Voice call** opens a compact strip: avatar portrait, activity line and controls.
- **Interactive Director** opens the large supplied avatar, with captions and a "Type to the Director" button.

Both views sit above the **existing** chat, question cards and composer, and use the same session and send path. The call owns no transport.

Voice input is **disabled on purpose**: there is no approved speech-input contract. Spoken replies are opt-in and use an on-device `speechSynthesis` voice only.

A "Director asks" strip points to the real question card (it scrolls to the card and focuses it) and never answers anything itself.

## Files

New (owned by this feature):
- `lib/studio-voice-interactive.ts`
- `components/builder/voice-interactive/` (6 files)
- `scripts/test-studio-voice-interactive.mjs`
- `docs/studio-v4-voice-interactive/`

Shared seams (small, gated edits):
- `app/builder/page.tsx`: about 25 lines
  - 3 imports
  - `const voiceInteractive = STUDIO_VOICE_INTERACTIVE_ENABLED`
  - one `useDirectorCall(...)` call
  - header `actions` prop
  - one gated `<DirectorCallPanel>`
- `components/builder/chat/studio-director-header.tsx`: an optional `actions?: ReactNode` slot.
- `package.json`: the `test:studio-voice-interactive` script.
- `.env.example`: the flag, set to `"false"`.

## ⚠ Integration: conflicts with current `studio-v4-dev`

`studio-v4-dev` has moved on to `308746b`, ten commits ahead of this branch's base. A test merge conflicts in **`app/builder/page.tsx` only**. There are three hunks, and every one is "keep both sides":

1. **Imports, around line 66.** Keep our 3 voice-interactive imports **and** upstream's `import { classifyStudioCanvasLifecycle } from '@/lib/studio-canvas-lifecycle'`.
2. **Around line 2810.** Keep our `const directorCall = useDirectorCall({...})` block, then upstream's whole `const studioCanvasLifecycle = classifyStudioCanvasLifecycle({...})` block and upstream's new `const studioWelcome = studioShell && studioCanvasLifecycle.showLanding`. **Drop our side's old two-line `studioWelcome`.**
3. **The Director header in the chat pane, around line 6040.** Order:
   - our header line, which passes `actions={voiceInteractive ? <DirectorCallEntry … /> : undefined}`;
   - upstream's `<StudioDirectorNotice …/>` and `handoffStorageWarning` block, with the `)}` that closes it;
   - our `{voiceInteractive && ( <DirectorCallPanel … /> )}` block.

   The `)}` that follows the conflict markers closes whichever block comes last. Keep exactly one per block.

After resolving, check that `const voiceInteractive = STUDIO_VOICE_INTERACTIVE_ENABLED` is still present (it merges cleanly, around line 1201). Then run the checks below. The merged result has **not** been built or tested yet.

## Verify after integrating

```
npm run test:studio-voice-interactive
npx tsc --noEmit
```

The test script should report 55 passing checks. For `tsc`, compare against the base: seat 2 saw only 11 errors there, in the Stripe and `mock-token` files, and they came from its local `node_modules`.

Also re-run the existing checks: `builder-presentation-ownership`, `director-websocket-reconnect`, `director-sync-recovery`, `user-message-attachments`, `deck-identity`, `build-narration`, `qa` and `narration`. All of them passed at `e45f91c`.

Seat 2 could not run these because they need a real sign-in, and it used no auth bypass. Run them once in the signed-in dev Builder with both flags on:
- a typed turn in the voice view and in the interactive view, which should appear once, through the normal path;
- answer a real question card through "Answer in chat";
- End during a build, which should leave generation running;
- a session or deck switch, which should end the call;
- with the flag OFF, the Director header should be unchanged and there should be no mic, speech or timer activity.

## Activation and rollback

These are build-time `NEXT_PUBLIC_*` values, so both directions need a rebuild and redeploy of the dev project. There is no runtime kill switch.

- **Activate:** set `NEXT_PUBLIC_STUDIO_V4_SHELL=true` and `NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE=true`, then rebuild.
- **Roll back:** remove the new flag or set it to `false`, then rebuild.

## Open items for the Architect

- Merge order for the two shared seams with other Studio work.
- The mic stays disabled until there is an approved speech-input contract (provider, privacy, budget) and a policy for reading spoken approvals back.
- Visual departures, chosen for function:
  - the real question card stays in the chat instead of over the avatar;
  - the composer stays docked instead of opening as a sheet;
  - the call reads "Typed turns · voice input off" rather than "Recording to chat";
  - the self tile reads "Camera not used".
- On short screens, the interactive stage (clamped to 150–380 px) leaves less room for the transcript.
