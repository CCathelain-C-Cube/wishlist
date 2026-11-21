# Home image build — Design (short)

Date: 2026-11-21
Status: approved

## Intent

Build a container image of the fork, including features not yet merged upstream (starting with Secret Santa), so it can run on the owner's home Kubernetes cluster. Keep every fork-only change out of upstream contributions.

## Goals

- A `home` branch: upstream `main` plus the owner's feature branches plus fork-only files. It is the only branch that gets built, and it never goes upstream.
- A workflow that runs on a push to `home` (or manually), checks the code, and publishes `ghcr.io/the-vas/wishlist`.

## Non-goals

- Kubernetes manifests.
- Forgejo builds or the Forgejo registry.
- Any change to upstream's workflows, to `main`, or to feature branches.
- arm64 images.

## Anti-goals

- A broken commit becoming an image.
- Fork-only files leaking into an upstream PR.
- Failing workflow runs whenever the fork's `main` is synced with upstream.

## Approaches

- **A. GitHub Actions to GHCR (chosen).** No infrastructure to run. It reuses upstream's proven buildx/QEMU/cache steps. The image is hosted on GitHub, and the cluster needs internet access (plus a pull secret if the package is private).
- **B. Forgejo Actions to the Forgejo registry at scm.thevas.net.** Everything stays local. It needs a Forgejo runner with a container engine and a GitHub-to-Forgejo sync. Rejected as more to run for no current need.

## Decisions

- **Branch model.** `home` was created from `main`, with `feat/secret-santa` merged in. To update it: `git switch home && git merge main && git merge feat/<x> && git push`. Feature branches are cut from upstream `main`.
- **Workflow.** `.github/workflows/home-image.yml`, triggered by `push` to `home` or by `workflow_dispatch`. Concurrency is per ref, so a newer push cancels an older run.
    - **Job `check`:** pnpm install, `pnpm check`, `pnpm lint`, `pnpm test:unit`. Node 24 and pnpm come from the same actions upstream uses in `lint.yml`. No E2E (about 10 minutes; upstream PRs run it).
    - **Job `build`:** needs `check`. Log in to GHCR with `GITHUB_TOKEN`. Permissions: `contents: read`, `packages: write`.
        - Use `docker/metadata-action` with the image `ghcr.io/${{ github.repository }}` and tags `type=raw,value=home` and `type=sha` (`sha-<short>`).
        - Then `docker/build-push-action`, platform `linux/amd64` only. Build args `SHA=${{ github.sha }}` and `VERSION=home-<short sha>`. GHA cache.
        - No QEMU step is needed for amd64 only.
    - **Action versions:** use the same versions as upstream's `build_push.yml` (checkout@v7, setup-buildx@v4, login@v4, metadata@v6, build-push@v7), so Renovate updates them together.
- **On the fork.** Disable upstream's "Build and Push Docker Image" workflow (`gh workflow disable`) so syncing `main` doesn't trigger a failing Docker Hub push.
- **Package visibility.** The owner sets it in GHCR after the first build. Public means no pull secret; private means the cluster needs an `imagePullSecret`.
- **Fork-only docs.** Fork-only docs, including this one, live on `home` only.

## Left to the builder

- The exact `VERSION` build-arg expression.
- Job and step names.
