# Release-tag Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `home` follow upstream release tags and publish `ghcr.io/the-vas/wishlist-santa:<upstream version>`.

**Architecture:** A new pure script computes the version. `home-sync.sh` and the local `task sync` merge the latest release tag instead of `main`. `home-image.yml` adds a second image name with version tags.

**Tech Stack:** bash, git, GitHub Actions (`docker/metadata-action@v6`, `docker/build-push-action@v7`), go-task.

**Spec:** `docs/superpowers/specs/2026-11-21-home-image-build-design.md`, section "Revision 2026-11-21".

## Global Constraints

- Release tag pattern: `vX.Y.Z` only (`^v[0-9]+\.[0-9]+\.[0-9]+$`). Pick the highest with `sort -V`.
- Upstream URL comes from `UPSTREAM_URL`, default `https://github.com/cmintey/wishlist.git`.
- Fork-only files only. No `--force`. Conventional commits with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.
- Tests live in `.github/scripts/tests/`. Each is written first and watched fail.

## Review Focus

1. **No release tags upstream, or tags not fetched:** the build must fail, not publish `wishlist-santa:` with an empty tag. Pinned by `image-version.test.sh` (no tags → non-zero exit) and by `set -euo pipefail` in the workflow step.
2. **A tag like `v0.70.0-rc1` must never be merged into `home`.** Pinned in `home-sync.test.sh`.
3. **A newer release that isn't in `HEAD`'s history must not be reported as the version.** Pinned in `image-version.test.sh`.

### Task 1: `image-version.sh`

- Create: `.github/scripts/image-version.sh`, `.github/scripts/tests/image-version.test.sh`.
- Behaviour: run `git fetch --no-tags "$UPSTREAM_URL" '+refs/tags/v*:refs/tags/v*'`, quietly. Then from `git tag --merged HEAD`, filter the pattern, `sort -V`, take the last one, strip the `v` and print it. Exit 1 with `::error::` if none.
- [ ] Write tests:
    - `v0.1.0` and `v0.2.0` in history, `v0.3.0` on a side branch: prints `0.2.0`.
    - `v0.2.1-rc1` on HEAD: still prints `0.2.0`.
    - No tags: non-zero exit.
    - Tags only upstream (not local): prints `0.2.0` after the script's fetch.
- [ ] Run them and watch them FAIL. Implement. Watch them pass. Commit `ci: compute upstream version for home image`.

### Task 2: sync follows releases

- Modify: `.github/scripts/home-sync.sh`, `.github/scripts/tests/home-sync.test.sh`.
- Behaviour: step 1 (fast-forward the fork's `main`) is unchanged. Step 2 fetches upstream tags as in Task 1 and computes `latest` (highest `vX.Y.Z` among all fetched tags). If `git merge-base --is-ancestor "refs/tags/$latest" HEAD`, print "home already contains $latest" and exit 0. Otherwise merge `refs/tags/$latest` with `-m "chore: merge upstream $latest into home"` (keep the conflict handling and the new-workflow warning), then push.
- [ ] Update the tests:
    - The existing cases tag their upstream commits as releases.
    - New: upstream `main` moves without a release, so fork `main` is synced and origin `home` is unchanged.
    - New: a `-rc1` tag is ignored.
    - New: a release that is already contained is a no-op.
- [ ] Watch them FAIL, implement, watch them pass. Commit `ci: merge upstream releases into home instead of main`.

### Task 3: `task sync` follows releases (local branch)

- Modify: `Taskfile.yml` on `local/secret-santa-dev`, and `.github/scripts/tests/taskfile.test.sh` on `home`.
- Behaviour: `sync` fetches `upstream` with tags, fast-forwards the fork's `main` as before, computes the latest release the same way, and merges it into the `home` worktree with the same message, unless it's already contained. Conflict behaviour is unchanged.
- [ ] Update the tests the same way as in Task 2. Watch them FAIL, implement, watch them pass. Commit on both branches (Taskfile on the local branch, test on `home`).

### Task 4: workflow tags

- Modify: `.github/workflows/home-image.yml` (`build` job).
- The checkout uses `fetch-depth: 0`. A step `version` runs `.github/scripts/image-version.sh` and writes `version` and `short_sha` outputs.
- A second metadata step (`santa`) with `images: ghcr.io/${{ github.repository_owner }}/wishlist-santa` and tags `type=raw,value=${{ steps.version.outputs.version }}` and `type=raw,value=${{ steps.version.outputs.version }}-${{ steps.version.outputs.short_sha }}`.
- build-push `tags` is the two metadata outputs joined. Build arg `VERSION=${{ steps.version.outputs.version }}-${{ steps.version.outputs.short_sha }}`. Remove the old `vars` step.
- [ ] `actionlint` is clean. All four test scripts pass. Commit `ci: publish wishlist-santa image with upstream version tags`.

### Task 5: publish and verify

- [ ] Push `home` and watch Home Image.
- [ ] `podman pull ghcr.io/the-vas/wishlist-santa:0.69.0` and `:0.69.0-<sha7>`.
- [ ] Check the new package's visibility.
- [ ] Run Home Sync once. Expected: "home already contains v0.69.0".
