#!/usr/bin/env bash
# Fork-only: print the newest upstream release (vX.Y.Z, without the "v") contained in HEAD.
# Fetches upstream's tags itself, so the fork doesn't need to store them.
set -euo pipefail

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/cmintey/wishlist.git}"

git fetch --quiet --no-tags "$UPSTREAM_URL" '+refs/tags/v*:refs/tags/v*' >&2

latest="$(git tag --merged HEAD | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -n 1 || true)"
if [ -z "$latest" ]; then
    echo "::error::No upstream release tag (vX.Y.Z) is contained in HEAD." >&2
    exit 1
fi
echo "${latest#v}"
