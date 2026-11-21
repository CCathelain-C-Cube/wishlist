#!/usr/bin/env bash
# Fork-only: sync the fork's main with upstream, then merge it into the checked-out home branch.
# Run from a checkout of `home`. Exits non-zero (without pushing home) if the fork's main has
# diverged from upstream or if the merge conflicts.
set -euo pipefail

UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/cmintey/wishlist.git}"
REMOTE="${REMOTE:-origin}"

# 1. Fast-forward the fork's main to upstream. A plain push is fast-forward only, so a diverged
#    main is rejected instead of overwritten.
git fetch --no-tags "$UPSTREAM_URL" main
git push "$REMOTE" FETCH_HEAD:refs/heads/main

# 2. Merge the fork's main into home.
git fetch --no-tags "$REMOTE" main
before="$(git rev-parse HEAD)"
if ! git merge --no-edit "$REMOTE/main"; then
    conflicts="$(git diff --name-only --diff-filter=U | tr '\n' ' ')"
    echo "::error::Merging main into home conflicts in: ${conflicts}- resolve locally with 'task sync'."
    git merge --abort
    exit 1
fi

# 3. Push home only if the merge changed it.
if [ "$(git rev-parse HEAD)" = "$before" ]; then
    echo "home already up to date"
    exit 0
fi

# Upstream workflows arrive enabled on the fork; flag new or renamed ones so they can be
# disabled (gh workflow disable) before they run against the fork.
new_workflows="$(git diff --name-only --diff-filter=AR "$before" HEAD -- .github/workflows | tr '\n' ' ')"
if [ -n "$new_workflows" ]; then
    echo "::warning::Upstream added or renamed workflows: ${new_workflows}- review and disable on the fork if needed."
fi
git push "$REMOTE" HEAD:refs/heads/home
