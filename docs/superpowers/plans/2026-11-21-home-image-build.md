# Home Image Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On every push to the fork's `home` branch, check the code and publish an amd64 image to `ghcr.io/the-vas/wishlist`.

**Architecture:** A single fork-only GitHub Actions workflow on `home`, with a `check` job that gates a `build` job. Upstream's workflows stay untouched; the one that would fail on the fork is disabled there.

**Tech Stack:** GitHub Actions, docker/buildx, GHCR, pnpm, Node 24; `actionlint` and `gh` through devbox.

**Spec:** `docs/superpowers/specs/2026-11-21-home-image-build-design.md`

## Global Constraints

- Work on branch `home` (worktree `/home/vince/repo/github/wishlist/.worktrees/home`). Never commit to `main`, `feat/*` or `local/*` except where Task 1 says so. Never push `main`.
- Conventional commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- YAML in block style.
- Action versions must match upstream's `build_push.yml`: `actions/checkout@v7`, `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `docker/metadata-action@v6`, `docker/build-push-action@v7`. Node/pnpm setup must match `lint.yml`: `actions/setup-node@v7` with `node-version: 24`, and `pnpm/action-setup@v6`.
- Image `ghcr.io/${{ github.repository }}`, platform `linux/amd64` only, tags `home` and `sha-<short>`.
- Authentication through `GITHUB_TOKEN` only.
- Run commands through `devbox run -- '<cmd>'`.

## Review Focus

1. **A push to `main` or a feature branch must not run this workflow.** Pinned by the `on.push.branches: [home]` assertion in Task 2 Step 1.
2. **A failing check must not publish an image.** Pinned by `build.needs: check` in Task 2 Step 1.
3. **Two quick pushes must not race two images onto the `home` tag.** Pinned by `concurrency` with `cancel-in-progress: true` in Task 2 Step 1.
4. **A missing `packages: write` permission makes the GHCR push fail with 403.** Pinned by the permissions assertion in Task 2 Step 1.
5. **The image must actually start.** Pinned by the local smoke run in Task 2 Step 4.

---

### Task 1: Dev tools

**Files:**

- Modify: `devbox.json` on branch `local/secret-santa-dev` (main checkout `/home/vince/repo/github/wishlist`). Add packages `actionlint@latest` and `gh@latest`.
- Copy the updated `devbox.json` and `devbox.lock` into the `home` worktree. They stay untracked there, excluded through `.git/info/exclude`.

- [ ] **Step 1:** Add both packages and run `devbox run -- 'actionlint -version && gh --version'`. Expected: both print a version.
- [ ] **Step 2:** Commit on `local/secret-santa-dev`: `chore: add actionlint and gh to devbox`.

### Task 2: Workflow `home-image.yml`

**Files:**

- Create: `.github/workflows/home-image.yml` (on `home`)

**Interfaces:**

- Produces: workflow name `Home Image`, jobs `check` and `build`.

- [ ] **Step 1: Write the workflow** to match these assertions, each checkable by reading the file:
    - `on.push.branches` is exactly `[home]`, plus `workflow_dispatch`.
    - `concurrency.group: ${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true`.
    - Top-level `permissions: { contents: read }`. Job `build` has `permissions: { contents: read, packages: write }`.
    - Job `check` runs on `ubuntu-latest`. Steps: checkout, setup-node 24, pnpm setup, the pnpm store cache exactly as in `lint.yml`, then `pnpm install --frozen-lockfile`, `pnpm svelte-kit sync`, `pnpm prisma generate`, `pnpm run check`, `pnpm run lint`, `pnpm run test:unit`.
    - Job `build` has `needs: check` and runs on `ubuntu-latest`. Steps:
        - checkout
        - setup-buildx
        - login to `ghcr.io` with `username: ${{ github.repository_owner }}` and `password: ${{ secrets.GITHUB_TOKEN }}`
        - a step that sets output `short_sha` to the first 7 characters of `github.sha`
        - metadata-action with `images: ghcr.io/${{ github.repository }}` and tags `type=raw,value=home` and `type=sha`
        - build-push-action with `context: ./`, `file: ./Dockerfile`, `platforms: linux/amd64`, `push: true`, the tags and labels from metadata, build-args `SHA=${{ github.sha }}` and `VERSION=home-${{ steps.<id>.outputs.short_sha }}`, `cache-from: type=gha` and `cache-to: type=gha,mode=max`
    - No QEMU step and no Docker Hub login.
- [ ] **Step 2: Lint it.** Run `devbox run -- 'actionlint .github/workflows/home-image.yml'`. Expected: no output, exit 0.
- [ ] **Step 3: Run the check job's commands locally:** `devbox run -- 'pnpm install --frozen-lockfile && pnpm svelte-kit sync && pnpm prisma generate && pnpm run check && pnpm run lint && pnpm run test:unit'`. Expected: 0 errors, 32 unit tests pass.
- [ ] **Step 4: Smoke-test the image locally** with the same build args:
    - `podman build --platform linux/amd64 --build-arg SHA=$(git rev-parse HEAD) --build-arg VERSION=home-$(git rev-parse --short=7 HEAD) -t localhost/wishlist:home .`
    - `podman run -d --rm --name wishlist-home-smoke -p 3299:3280 -e ORIGIN=http://localhost:3299 localhost/wishlist:home`
    - `curl -s -o /dev/null -w '%{http_code}' http://localhost:3299/` must return `200` or a `3xx` redirect to the setup wizard. Then `podman stop wishlist-home-smoke`.
- [ ] **Step 5: Commit** `ci: build home image to ghcr`.

### Task 3: Publish (outward-facing; the owner confirms first)

- [ ] **Step 1:** The owner runs `! gh auth login` (interactive) if `devbox run -- 'gh auth status'` shows no login.
- [ ] **Step 2:** Disable upstream's push workflow on the fork: `devbox run -- 'gh workflow disable "Build and Push Docker Image" -R the-vas/wishlist'`. Expected: `gh workflow list -R the-vas/wishlist` shows it as `disabled_manually`. If Actions are disabled on the fork entirely, the owner enables them in the repo settings first.
- [ ] **Step 3:** `git push -u origin home`.
- [ ] **Step 4:** Watch the run with `devbox run -- 'gh run watch -R the-vas/wishlist $(gh run list -R the-vas/wishlist -w "Home Image" -L 1 --json databaseId -q ".[0].databaseId")'`. Expected: both jobs succeed.
- [ ] **Step 5:** Verify the image exists: `podman pull ghcr.io/the-vas/wishlist:home`. That works without login if the package is public; otherwise the owner sets visibility first. The owner chooses public or private in the GHCR package settings.
