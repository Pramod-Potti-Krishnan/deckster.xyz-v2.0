#!/bin/zsh
set -eu
proof_tmpdir=$(mktemp -d /private/tmp/element3-fe-error-delay-typecheck-owned.XXXXXX)
trap '/bin/rm -rf "$proof_tmpdir"' EXIT
export TMPDIR="$proof_tmpdir"
/opt/homebrew/bin/node /private/tmp/element3-fe-error-delay-typecheck-20261008/run.mjs
