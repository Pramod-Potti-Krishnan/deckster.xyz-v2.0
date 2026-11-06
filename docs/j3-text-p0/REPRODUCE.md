# Frontend J3 source replay

This is offline diagnosis, not the missing exact live network capture. No backend requests, model calls, browser, build or package installation are involved.

Run from `/Users/pk1980/Software/Deckster/.worktrees/element3-j3-text-p0-fe-20261008`:

```sh
/opt/homebrew/bin/node docs/j3-text-p0/request-replay.mjs
```

Interpreter used: `/opt/homebrew/bin/node` v24.4.1. Existing compiler/React dependencies are loaded read-only from `/Users/pk1980/Software/Deckster/frontend/node_modules`. If that dependency directory is removed, the diagnostic script needs equivalent TypeScript and React packages; this work did not install them.

The script loads source via `git show` from these full commit IDs in this checkout's shared Git object database:

* Assigned older UAT: `ee532fab4b84a6883f8a5b50675ccab692b62240`.
* Pre-flip Studio: `6d47cae43fa406c31b2c5da21c9d2ce7de3b7872`.
* Attributed Studio deployment source: `18e0446073d62b042a9470fd4524994d3dd82e8e`.

`source-manifest.json` preserves 24 SHA-256 records across the eight relevant files and three refs. Source bodies and raw live request/response material are not preserved in this evidence folder. The reported live-source attribution is operations evidence, not independent runtime-SHA verification.

`NEXT_PUBLIC_STUDIO_V4_SHELL=true` selects the real Studio form branch. Each of four recorded selections runs with the literal #327 flag off and on. React hook state, UI leaves and fetch are mocked; only registered submit effects run. This reconstructs request fields through the actual form/client but cannot reproduce complete browser mounting, geometry/theme state or backend output. The safe output records prompt-preserved booleans rather than raw network requests.

Virtual-clock cases exercise the actual pinned theme module: missing acknowledgement, matching acknowledgement, inherited earlier-request failure, late same-request applied acknowledgement, unrelated request rejection and terminal-state protection. Each source also resolves its actual TEXT_BOX budget. These prove source mechanics, not the timing or messages of the failed live run.

Expected console output: `Completed 24 source-pinned request replays and 3 virtual-clock theme/budget comparisons; no live requests.` Results are saved in `request-replay-results.json`.
