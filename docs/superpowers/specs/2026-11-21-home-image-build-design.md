# Home image build — Design (short)

Date: 2026-11-21
Status: approved (revised 2026-11-21: upstream sync added)

## Intent

Build a container image of the fork, including features not yet merged upstream (starting with Secret Santa), so it can run on the owner's home Kubernetes cluster. Keep every fork-only change out of upstream contributions.

## Goals

- A `home` branch: upstream `main` plus the owner's feature branches plus fork-only files. It is the only branch that gets built, and it never goes upstream.
- A workflow that runs on a push to `home` (or manually), checks the code, and publishes `ghcr.io/the-vas/wishlist`.
- Easy updates from upstream: a scheduled sync keeps the fork's `main` and `home` current and rebuilds the image. A one-command manual sync is the fallback for conflicts.

## Non-goals

- Kubernetes manifests.
- Forgejo builds or the Forgejo registry.
- Any change to upstream's workflows, to `main`, or to feature branches.
- arm64 images.

## Anti-goals

- A broken commit becoming an image.
- Fork-only files leaking into an upstream PR.
- Failing workflow runs whenever the fork's `main` is synced with upstream.
- A sync that half-applies: `home` pushed with conflict markers, or the fork's `main` diverging from upstream.
- A sync that silently stops working: a conflict must fail the run loudly, and the owner gets GitHub's failed-run email.

## Approaches

- **A. GitHub Actions to GHCR (chosen).** No infrastructure to run. It reuses upstream's proven buildx/QEMU/cache steps. The image is hosted on GitHub, and the cluster needs internet access (plus a pull secret if the package is private).
- **B. Forgejo Actions to the Forgejo registry at scm.thevas.net.** Everything stays local. It needs a Forgejo runner with a container engine and a GitHub-to-Forgejo sync. Rejected as more to run for no current need.

Upstream sync:

- **A. Manual only:** an `upstream` remote plus `task sync`. Full control, but nothing happens unless the owner remembers.
- **B. Scheduled workflow, with A as the fallback (chosen).** Weekly and on-demand. Clean merges build automatically. Conflicts fail the run, and the owner resolves them locally with `task sync`.

## Decisions

- **Branch model.** `home` was created from `main`, with `feat/secret-santa` merged in. To update it: `git switch home && git merge main && git merge feat/<x> && git push`. Feature branches are cut from upstream `main`.
- **Workflow.** `.github/workflows/home-image.yml`, triggered by `push` to `home` or by `workflow_dispatch`. Concurrency is per ref, so a newer push cancels an older run.
    - **Job `check`:** pnpm install, `pnpm check`, `pnpm lint`, `pnpm test:unit`. Node 24 and pnpm come from the same actions upstream uses in `lint.yml`. No E2E (about 10 minutes; upstream PRs run it).
    - **Job `build`:** needs `check`. Log in to GHCR with `GITHUB_TOKEN`. Permissions: `contents: read`, `packages: write`.
        - Use `docker/metadata-action` with the image `ghcr.io/${{ github.repository }}` and tags `type=raw,value=home` and `type=sha` (`sha-<short>`).
        - Then `docker/build-push-action`, platform `linux/amd64` only. Build args `SHA=${{ github.sha }}` and `VERSION=home-<short sha>`. GHA cache.
        - No QEMU step is needed for amd64 only.
    - **Action versions:** use the same versions as upstream's `build_push.yml` (checkout@v7, setup-buildx@v4, login@v4, metadata@v6, build-push@v7), so Renovate updates them together.
- **Sync workflow.** `.github/workflows/home-sync.yml` on `home`, triggered by `schedule` (weekly, Monday 04:00 UTC) and `workflow_dispatch`. One job:
    1. Check out `home` with full history, using the token below.
    2. Fast-forward the fork's `main` to upstream: fetch `https://github.com/cmintey/wishlist.git` `main`, then `git push origin FETCH_HEAD:main`. A normal push is fast-forward only, so a diverged fork `main` fails the run instead of being overwritten.
    3. Merge `origin/main` into `home` with `--no-edit`, as the `github-actions[bot]` identity. On conflict: `git merge --abort`, print the conflicting files, exit 1.
    4. Push `home` only if it changed. That push triggers `home-image.yml` (see the token), so the sync workflow does not build anything itself.
- **Sync token (owner action).** Updating `main` pushes upstream's changes to `.github/workflows/*`, which happen often (Renovate). The built-in `GITHUB_TOKEN` is not allowed to push workflow-file changes, and its pushes don't trigger other workflows. The owner therefore creates a fine-grained PAT scoped to `the-vas/wishlist` only, with permissions Contents: read/write and Workflows: read/write, and stores it as the repo secret `HOME_SYNC_TOKEN`. Expiry is the owner's choice; when it expires, sync runs fail loudly.
- **`home` becomes the fork's default branch (owner action).** GitHub runs `schedule` triggers only from the default branch. This doesn't affect upstream PRs, because their base is chosen per PR. A side effect is that clones of the fork check out `home`.
- **Manual fallback (local).** Add an `upstream` remote (`https://github.com/cmintey/wishlist.git`) and a `Taskfile.yml` on `local/secret-santa-dev` (a local dev file, never pushed), with these tasks:
    - `task sync`: fetch `upstream` and `origin`; `git push origin upstream/main:main` (fast-forward only); in the `home` worktree (`.worktrees/home`, overridable with a var), merge `origin/main`. It stops on conflict and leaves the merge in progress for the owner to resolve. On a clean merge it pushes `home`.
    - `task sync:feature FEATURE=feat/<x>`: merges a feature branch into `home` in the worktree and pushes.
- **Keeping syncs quiet.** Fork-only changes live only in new files (the two workflows and the docs). `home` never edits upstream files except through merged feature branches.
- **Once upstream merges a feature,** the same change arrives through `main`. Git usually reconciles identical content; if upstream modified it, expect a one-time conflict.
- **Inactivity.** GitHub disables scheduled workflows in public repos after 60 days without repository activity. If that happens, re-enable it in the Actions tab; `task sync` still works meanwhile.
- **On the fork.** Disable upstream's "Build and Push Docker Image" workflow (`gh workflow disable`) so syncing `main` doesn't trigger a failing Docker Hub push.
- **Package visibility.** The owner sets it in GHCR after the first build. Public means no pull secret; private means the cluster needs an `imagePullSecret`.
- **Fork-only docs.** Fork-only docs, including this one, live on `home` only.

## Left to the builder

- The exact cron minute and the shell details of the conflict report.

- The exact `VERSION` build-arg expression.
- Job and step names.
