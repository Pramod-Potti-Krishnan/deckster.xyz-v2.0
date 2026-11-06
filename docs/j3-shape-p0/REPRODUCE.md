# Reproduce the bounded source checks

Pinned baseline: bb26903c5ab9e0313380691c7c3789bd93a07e0e. Native candidate:4e8f4f14c1fa0e545b070ea0bb5eb4cb8c5b8fb2. Final typechecked production source:cb87b32c7796ca6089ce5ecb62eccdf6255bbb26. This published documentation checkpoint retains identical production and focused-script bytes to cb. The source/receipt manifest pins SHA256s.

Existing interpreter was `/opt/homebrew/bin/node` v24.4.1, with dependency symlink to `/Users/pk1980/Software/Deckster/frontend/node_modules`; no dependency installation. Fixture inputs are synthetic. The complete existing suite is not all green; preserve native raw lists and catalog SKIP distinction.

The sole full pair command was:

```sh
/Users/pk1980/Software/deckster-workspace/tools/ops/heavy.sh lockf -k /tmp/deckster-suite-frontend.lock /opt/homebrew/bin/node /private/tmp/element3-j3-shape-fe-native-proof-20261008/runner.mjs
```

The bounded final command (one matched baseline catalog case, candidate tsc and exact emitted-JS comparison; no full pair rerun) was:

```sh
/Users/pk1980/Software/deckster-workspace/tools/ops/heavy.sh lockf -k /tmp/deckster-suite-frontend.lock /opt/homebrew/bin/node /private/tmp/element3-j3-shape-fe-native-proof-20261008/repair-validate.mjs
```

Both scripts and deny-network preload are preserved in `evidence/`. They explicitly identify their original isolated source paths. For future reproduction, copy them to an owned temporary proof directory, adjust only checkout/proof paths, and materialize clean worktrees from the exact Git SHAs. Each runner creates its own TMPDIR inside locks and removes it; credential-name environment is cleared and outbound sockets/fetch denied. Require current manual permission, no HOLD, >=5GiB and existing heavy/repo locks for any new broad rerun. The original receipts must not be overwritten.

Pristine detached scratch reconstruction from the canonical frontend repository or this worktree's common Git source:

```sh
git worktree add --detach /private/tmp/element3-j3-shape-fe-native-base-20261008 bb26903c5ab9e0313380691c7c3789bd93a07e0e
ln -s /Users/pk1980/Software/Deckster/frontend/node_modules /private/tmp/element3-j3-shape-fe-native-base-20261008/node_modules
```

Only if absent: do not replace an existing checkout. Shared dependency target is never a disposable output.

Root's single new fixture-only consumer (no23-matrix rerun): from this final candidate checkout, set `SHAPE_TYPED_FAILURE_RESPONSE_FIXTURE` to a safe mapped Text Labs JSON fixture (response itself or wrapper.response), and `SHAPE_TYPED_PROOF_OUT` to a new owned output directory. Run `/opt/homebrew/bin/node scripts/test-shape-typed-failure.mjs` with the network-denying preload. This exercises actual candidate client/hook/GenerationInput feedback for one typed refusal, single send, retained blank, existing reference and guidance. Record upstream fixture/model source and HTML/error hashes separately; no claim of the whole live pipeline, UI or successful persisted reload follows from it.
