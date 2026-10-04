# Studio v4 voice and interactive avatar handoff

Build only the Director voice call and interactive avatar mode inside Studio’s existing conversation pane. Reuse the accepted cap-and-notebook Director character supplied here. Deliver a coherent, reviewable frontend slice behind a new default-off flag. The hard stop is **3:00 AM Eastern on 4 October 2026** (07:00 UTC). Check the current time at start; do not assume a fresh 90 minutes.

## Start here

1. Read this file, then [the implementation brief](IMPLEMENTATION.md).
2. Open [the visual reference guide](VISUALS.md); the nine screenshots are the accepted v4 mockups, not evidence that voice services are connected.
3. Reuse the actual [avatar component](reference-source/director-character.tsx.txt), [styles](reference-source/director-character.css), and [motion hook](reference-source/use-director-motion.ts.txt). Do not reconstruct the avatar from screenshots.
4. Read [the source map](SOURCE-MAP.md) for current application integration points and boundaries.
5. Return the changed-file list, checkpoint/patch, flag instructions, screenshots, focused check results, and any remaining contract gaps by the hard stop.

## Development target

- App: https://deckster-studio-v4-dev.vercel.app
- Repository: https://github.com/Pramod-Potti-Krishnan/deckster.xyz-v2.0/tree/studio-v4-dev
- Application baseline inspected: `a1dac11f0ffe22c3ce32e89e5b4807accc3b854c` on `studio-v4-dev`.
- Work on a separate branch/worktree from the current dev branch. Preserve later dev changes; this SHA is provenance, not permission to reset the branch.
- The frontend repository has `app/`, `components/`, and `hooks/` at its root. Prototype provenance paths in this package refer to the parent polyrepo’s `frontend/prototypes/` tree; those prototypes are supplied here because they are absent from the public dev checkout.
- Architect owns shared integration and deployment. Do not push directly to the deployed branch or trigger production/UAT deployments. Deliver your isolated checkpoint for integration.

## What these sections mean

**Voice mode** is an audio-oriented Director call strip above the existing chat. **Interactive mode** is the larger illustrated Director/avatar view with captions, choices, and access to the same composer. The accepted design calls this “Video”; it does not require the user’s camera or a human video connection. Both are channels for the same Director conversation and must retain its exact session, target, permissions, tools, and send path.

Existing published-deck narration, public viewer Q&A, narration voices, presenter likeness, profile avatars, and account settings are separate features. Preserve their behavior; do not rebuild or extend them in this assignment. Cross-workspace call continuation is design intent, but the first delivery may end/pause cleanly on leaving Studio rather than changing Atlas navigation or shared app state.

## Capability truth

The supplied prototype uses sample utterances, local choreography, and optional on-device speech output. It has **no microphone capture, speech recognition provider, or live avatar service**. Existing application code has a real Director text transport and separate published narration/Q&A paths. This package does not establish a supported Director speech-input/provider contract.

Implement supported browser/device capabilities only with explicit start, actual availability detection, and truthful permission/error states. If there is no approved speech-recognition contract, complete the avatar/call shell, typed interaction and available on-device playback, and leave unavailable voice capture clearly disabled. Never make simulated listening, generated sample replies, or timed animation appear to be connected voice work. Do not add a new backend or substitute published-viewer credentials/budgets for Director authoring.

## Contents and sharing

This package is intended for public dev sharing. It contains nine inspected mockup images, reusable source art, selected prototype reference code, and an asset manifest with SHA-256 hashes. The displayed “AM” and sample deck are prototype content. It contains no account screenshots, environment files, authentication material, private logs, or real user records. [The paste note](PASTE-TO-CLAUDE.md) is ready for PK to share. The planned hosted location is `/dev-handoffs/voice-interactive/` on the dev app; availability must be confirmed by the publishing owner.

TypeScript reference files are delivered with a `.txt` suffix so the dev app does not compile prototype examples. Remove only the final `.txt` when porting them into your isolated feature folder. The room/Ask examples still need adaptation; they are not production components.
