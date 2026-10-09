# Reproduction

Final candidate focused matrix from approved frontend worktree:

`/opt/homebrew/bin/node scripts/test-element-failure-feedback.mjs`

Existing node_modules symlink is root-owned; no installs. Output defaults to `/private/tmp/element3-fe-error-delay-proof-20261008`; set ELEMENT_FAILURE_PROOF_DIR to a new owned directory for a separate receipt. Global credential names are silently removed in the standalone process; actual VM network APIs use only fake HTTP; real fetch/http/https/socket APIs throw on attempted egress. Only status, synthetic trace/request digests/source hashes persist. No heavy/native/build job required for this6s focused harness.

Original first-run command BEFORE production edits:

`/opt/homebrew/bin/node scripts/test-element-failure-feedback.mjs --baseline`

Its original bytes are preserved in baseline-script.mjs with immutable FIRST-VERDICT. To independently reproduce that capsule, put those exact baseline-script bytes at scripts/test-element-failure-feedback.mjs in a SEPARATE worktree off30c with existing dependencies, and choose a separate output directory by ELEMENT_FAILURE_PROOF_DIR. The script locates its repo from the scripts directory; don't run the copied file directly from the artifact directory. First receipt uses exclusive write mode and cannot silently overwrite the frozen verdict. No first-case rerun was made after freeze.

Initial first expanded fixture test encountered cross-VM object prototypes; comparisons serialize outcomes through host JSON without changing production. The6ceb renamed-admission failing test was preserved, fixed by sourceworker, and passes atde49. Earlier incomplete/failed/intermediate matrices are not final green receipts; MATRIX-RESULT414 and the exact hashes are authoritative.
