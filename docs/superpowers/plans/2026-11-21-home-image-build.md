# Home Image Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the fork's `home` branch synced with upstream (weekly automatically, manually as a fallback), and on every push to the fork's `home` branch, check the code and publish an amd64 image to `ghcr.io/the-vas/wishlist`.

**Architecture:** A single fork-only GitHub Actions workflow on `home`, with a `check` job that gates a `build` job. Upstream's workflows stay untouched; the one that would fail on the fork is disabled there.

**Tech Stack:** GitHub Actions, docker/buildx, GHCR, pnpm, Node 24; `actionlint` and `gh` through devbox.

**Spec:** `docs/superpowers/specs/2026-11-21-home-image-build-design.md`

## Global Constraints

- Work on branch `home` (worktree `/home/vince/repo/github/wishlist/.worktrees/home`). Never commit to `main`, `feat/*` or `local/*` except where Task 1 says so. Never push `main`.
- Conventional commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- YAML in block style.
- Action versions must match upstream's `build_push.yml`: `actions/checkout@v7`, `docker/setup-buildx-action@v4`, `docker/login-action@v4`, `docker/metadata-action@v6`, `docker/build-push-action@v7`. Node/pnpm setup must match `lint.yml`: `actions/setup-node@v7` with `node-version: 24`, and `pnpm/action-setup@v6`.
- Image `ghcr.io/${{ github.repository }}`, platform `linux/amd64` only, tags `home` and `sha-<short>`.
- `home-image.yml` authenticates with `GITHUB_TOKEN` only. `home-sync.yml` uses the secret `HOME_SYNC_TOKEN` (fine-grained PAT, Contents + Workflows read/write) for checkout and push.
- Run commands through `devbox run -- '<cmd>'`.

## Review Focus

1. **A push to `main` or a feature branch must not run this workflow.** Pinned by the `on.push.branches: [home]` assertion in Task 2 Step 1.
2. **A failing check must not publish an image.** Pinned by `build.needs: check` in Task 2 Step 1.
3. **Two quick pushes must not race two images onto the `home` tag.** Pinned by `concurrency` with `cancel-in-progress: true` in Task 2 Step 1.
4. **A missing `packages: write` permission makes the GHCR push fail with 403.** Pinned by the permissions assertion in Task 2 Step 1.
5. **The image must actually start.** Pinned by the local smoke run in Task 2 Step 4.
6. **A conflicting upstream merge must not push `home`, and must fail the run.** Pinned by the local conflict rehearsal in Task 3 Step 3.
7. **A diverged fork `main` must not be force-overwritten.** Pinned by the no-`--force` assertion in Task 3 Step 1 and the rehearsal in Task 4 Step 3.

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

### Task 3: Sync workflow `home-sync.yml`

**Files:**

- Create: `.github/workflows/home-sync.yml` (on `home`)

- [ ] **Step 1: Write the workflow** to match these assertions:
    - `on.schedule` with cron `17 4 * * 1`, plus `workflow_dispatch`. `concurrency.group: home-sync`, `cancel-in-progress: false`.
    - `permissions: { contents: read }` at the top. Every write goes through `HOME_SYNC_TOKEN`.
    - One job, `sync`, on `ubuntu-latest`:
        - `actions/checkout@v7` with `ref: home`, `fetch-depth: 0` and `token: ${{ secrets.HOME_SYNC_TOKEN }}`.
        - A step that fails early with a clear message if `HOME_SYNC_TOKEN` is empty.
        - Set the git identity to `github-actions[bot]` / `41898+github-actions[bot]@users.noreply.github.com`.
        - Sync `main`: `git fetch https://github.com/cmintey/wishlist.git main`, then `git push origin FETCH_HEAD:refs/heads/main`. No `--force` anywhere in the file.
        - Merge: `git fetch origin main`, record `before=$(git rev-parse HEAD)`, then `git merge --no-edit origin/main`. On failure, run `git diff --name-only --diff-filter=U`, print it as a `::error::` annotation, run `git merge --abort` and `exit 1`.
        - Push `home` only if `git rev-parse HEAD` differs from `before`; print "home already up to date" otherwise.
- [ ] **Step 2:** `devbox run -- 'actionlint .github/workflows/home-sync.yml'`. Expected: exit 0.
- [ ] **Step 3: Rehearse the merge logic locally.** Extract the merge step's shell into a temp script under the scratchpad, without changing the workflow. Run it in a throwaway clone where `origin/main` and `home` edit the same line of a file. Expected: exit 1, the conflicting file listed, `git status` clean afterwards (the merge was aborted), and no push attempted. Then a non-conflicting change: exit 0 and a push attempted (point `origin` at a local bare repo).
- [ ] **Step 4: Commit** `ci: sync home with upstream weekly`.

### Task 4: Manual fallback (local only)

**Files:**

- Create: `Taskfile.yml` on branch `local/secret-santa-dev` (main checkout). Copy it, untracked, into the `home` worktree.
- Local git config: `git remote add upstream https://github.com/cmintey/wishlist.git`.

- [ ] **Step 1:** Add the remote, then confirm with `git remote -v`, which should list `upstream`.
- [ ] **Step 2: Write `Taskfile.yml`** (Taskfile v3, block style):
    - var `HOME_WORKTREE`, default `.worktrees/home`.
    - `sync`:
        1. `git fetch upstream` and `git fetch origin`
        2. `git push origin upstream/main:main`
        3. `git -C {{.HOME_WORKTREE}} merge --no-edit origin/main`. On conflict, the task stops (non-zero exit) with the message "resolve in {{.HOME_WORKTREE}}, commit, then git -C {{.HOME_WORKTREE}} push".
        4. `git -C {{.HOME_WORKTREE}} push origin home`
    - `sync:feature`: requires var `FEATURE`. Runs `git -C {{.HOME_WORKTREE}} merge --no-edit {{.FEATURE}}`, then pushes `home`.
    - `task` is at `/usr/bin/task`, so devbox doesn't need it.
- [ ] **Step 3: Rehearse.** Point a temp copy of the Taskfile at a throwaway clone with local bare `origin` and `upstream` repos. Check `sync` with a clean merge (it pushes), with a conflict (it stops, the merge stays in progress) and with a diverged `main` (the push is rejected and nothing is merged).
- [ ] **Step 4: Commit** on `local/secret-santa-dev`: `chore: add taskfile for upstream sync`.

### Task 5: Publish (outward-facing; the owner confirms first)

- [ ] **Step 1:** The owner runs `! gh auth login` (interactive) if `devbox run -- 'gh auth status'` shows no login.
- [ ] **Step 2:** Disable upstream's push workflow on the fork: `devbox run -- 'gh workflow disable "Build and Push Docker Image" -R the-vas/wishlist'`. Expected: `gh workflow list -R the-vas/wishlist` shows it as `disabled_manually`. If Actions are disabled on the fork entirely, the owner enables them in the repo settings first.
- [ ] **Step 3:** `git push -u origin home`.
- [ ] **Step 3a (owner):** Make `home` the fork's default branch: `gh repo edit the-vas/wishlist --default-branch home`, or in Settings → General.
- [ ] **Step 3b (owner):** Create the fine-grained PAT (repository `the-vas/wishlist` only; Contents read/write, Workflows read/write) and store it with `gh secret set HOME_SYNC_TOKEN -R the-vas/wishlist`. Only the owner handles the token value.
- [ ] **Step 4:** Watch the run with `devbox run -- 'gh run watch -R the-vas/wishlist $(gh run list -R the-vas/wishlist -w "Home Image" -L 1 --json databaseId -q ".[0].databaseId")'`. Expected: both jobs succeed.
- [ ] **Step 5:** Verify the image exists: `podman pull ghcr.io/the-vas/wishlist:home`. That works without login if the package is public; otherwise the owner sets visibility first. The owner chooses public or private in the GHCR package settings.
- [ ] **Step 6:** Trigger the sync once: `gh workflow run "Home Sync" -R the-vas/wishlist --ref home`. Watch it. Expected: success, with "home already up to date" or a merge commit pushed (which then triggers a Home Image run that also succeeds).
