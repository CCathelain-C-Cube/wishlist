#!/usr/bin/env bash
# Rehearsal for the local Taskfile's sync tasks in a throwaway repo layout:
#   $T/repo (main checkout, Taskfile.yml) + $T/repo/.worktrees/home (worktree on home)
#   remotes: origin -> $T/origin.git, upstream -> $T/upstream.git
# Usage (main checkout root, local branch with Taskfile.yml): bash .worktrees/home/.github/scripts/tests/taskfile.test.sh [path-to-Taskfile.yml]
set -uo pipefail
TF=$(realpath "${1:-Taskfile.yml}")
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fails=0
ok() { echo "PASS: $1"; }
bad() { echo "FAIL: $1"; fails=$((fails + 1)); }
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
g() { git -c init.defaultBranch=main "$@"; }

setup() {
    rm -rf "$T"/*
    g init -q --bare "$T/upstream.git"; g init -q --bare "$T/origin.git"
    g clone -q "$T/upstream.git" "$T/seed" 2>/dev/null
    (cd "$T/seed" && printf 'a\nb\nc\n' > f.txt && g add f.txt && g commit -qm base && g push -q origin main)
    g -C "$T/origin.git" fetch -q "$T/upstream.git" main:main
    g clone -q "$T/origin.git" "$T/repo"
    g -C "$T/repo" remote add upstream "$T/upstream.git"
    (cd "$T/repo" && g branch -q feat/x && g switch -q -c dev && cp "$TF" Taskfile.yml)
    g -C "$T/repo" push -q origin main:home
    g -C "$T/repo" fetch -q origin
    g -C "$T/repo" worktree add -q "$T/repo/.worktrees/home" home 2>/dev/null
    (cd "$T/repo/.worktrees/home" && g branch -q --set-upstream-to=origin/home && printf 'home\n' > home.txt && g add home.txt && g commit -qm "home only" && g push -q origin home)
}
upstream_commit() { (cd "$T/seed" && g pull -q --ff-only && printf "$2" > "$1" && g add "$1" && g commit -qm "$3" && g push -q origin main); }
runtask() { (cd "$T/repo" && task "$@") > "$T/out" 2>&1; echo $?; }
ref() { git -C "$T/$1" rev-parse "$2" 2>/dev/null; }

# 1. clean sync: fork main fast-forwarded, home merged and pushed
setup; upstream_commit new.txt 'n\n' "upstream new"
rc=$(runtask sync)
[ "$rc" = 0 ] && ok "sync clean: exit 0" || bad "sync clean: exit $rc ($(tail -3 "$T/out"))"
[ "$(ref origin.git main)" = "$(ref upstream.git main)" ] && ok "sync clean: fork main == upstream" || bad "sync clean: fork main not synced"
git -C "$T/origin.git" cat-file -e home:new.txt 2>/dev/null && ok "sync clean: origin home has upstream file" || bad "sync clean: origin home missing upstream file"

# 2. conflict: task fails, merge left in progress in the worktree, origin home unchanged, hint printed
setup
(cd "$T/repo/.worktrees/home" && printf 'a\nHOME\nc\n' > f.txt && g commit -qam "home edits f" && g push -q origin home)
upstream_commit f.txt 'a\nUPSTREAM\nc\n' "upstream edits f"
before=$(ref origin.git home); rc=$(runtask sync)
[ "$rc" != 0 ] && ok "sync conflict: non-zero exit" || bad "sync conflict: exit 0"
[ -e "$(git -C "$T/repo/.worktrees/home" rev-parse --git-dir)/MERGE_HEAD" ] && ok "sync conflict: merge left in progress" || bad "sync conflict: no merge in progress"
grep -q "resolve in" "$T/out" && ok "sync conflict: hint printed" || bad "sync conflict: no hint ($(tail -2 "$T/out"))"
[ "$(ref origin.git home)" = "$before" ] && ok "sync conflict: origin home not pushed" || bad "sync conflict: origin home changed"

# 3. diverged fork main: push rejected, nothing merged into home
setup
(cd "$T/repo" && g switch -q -c tmp origin/main && printf 'x\n' > fork.txt && g add fork.txt && g commit -qm "fork-only" && g push -q origin tmp:main && g switch -q dev)
upstream_commit new.txt 'n\n' "upstream new"
home_before=$(ref repo/.worktrees/home HEAD); main_before=$(ref origin.git main); rc=$(runtask sync)
[ "$rc" != 0 ] && ok "sync diverged: non-zero exit" || bad "sync diverged: exit 0"
[ "$(ref origin.git main)" = "$main_before" ] && ok "sync diverged: fork main untouched" || bad "sync diverged: fork main overwritten"
[ "$(ref repo/.worktrees/home HEAD)" = "$home_before" ] && ok "sync diverged: home not merged" || bad "sync diverged: home changed"

# 4. sync:feature merges the feature into home and pushes; requires FEATURE
setup
(cd "$T/repo" && g switch -q feat/x && printf 'feat\n' > feat.txt && g add feat.txt && g commit -qm feat && g switch -q dev)
rc=$(runtask sync:feature)
[ "$rc" != 0 ] && ok "sync:feature: requires FEATURE" || bad "sync:feature: ran without FEATURE"
rc=$(runtask sync:feature FEATURE=feat/x)
[ "$rc" = 0 ] && git -C "$T/origin.git" cat-file -e home:feat.txt 2>/dev/null && ok "sync:feature: merged and pushed" || bad "sync:feature: rc=$rc ($(tail -2 "$T/out"))"

echo "failures: $fails"
exit $((fails > 0))
