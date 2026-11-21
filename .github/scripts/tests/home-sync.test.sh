#!/usr/bin/env bash
# Rehearsal for .github/scripts/home-sync.sh against local bare repos.
# Usage (repo root): bash .github/scripts/tests/home-sync.test.sh [path-to-home-sync.sh]
set -uo pipefail
SCRIPT=$(realpath "${1:-.github/scripts/home-sync.sh}")
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fails=0
ok() { echo "PASS: $1"; }
bad() { echo "FAIL: $1"; fails=$((fails + 1)); }
g() { git -c user.name=t -c user.email=t@t -c init.defaultBranch=main "$@"; }

setup() {
    rm -rf "$T"/*
    g init -q --bare "$T/upstream.git"
    g init -q --bare "$T/origin.git"
    g clone -q "$T/upstream.git" "$T/seed" 2>/dev/null
    (cd "$T/seed" && printf 'a\nb\nc\n' > f.txt && g add f.txt && g commit -qm base && g tag v0.1.0 && g push -q origin main v0.1.0)
    g -C "$T/origin.git" fetch -q "$T/upstream.git" main:main
    g clone -q "$T/origin.git" "$T/work"
    (cd "$T/work" && g switch -qc home && printf 'home\n' > home.txt && g add home.txt && g commit -qm "home only" && g push -q origin home)
}
upstream_commit() { # file content msg [tag]
    (cd "$T/seed" && g pull -q --ff-only && mkdir -p "$(dirname "$1")" && printf "$2" > "$1" && g add "$1" && g commit -qm "$3" && g push -q origin main)
    if [ -n "${4:-}" ]; then (cd "$T/seed" && g tag "$4" && g push -q origin "$4"); fi
}
run() { (cd "$T/work" && GIT_AUTHOR_NAME=bot GIT_AUTHOR_EMAIL=b@b GIT_COMMITTER_NAME=bot GIT_COMMITTER_EMAIL=b@b UPSTREAM_URL="$T/upstream.git" bash "$SCRIPT") > "$T/out" 2>&1; echo $?; }
ref() { git -C "$T/$1" rev-parse "$2" 2>/dev/null; }

# 1. clean merge: upstream releases v0.2.0 -> main fast-forwarded, release merged into home and pushed
setup; upstream_commit new.txt 'n\n' "upstream new" v0.2.0
rc=$(run)
[ "$rc" = 0 ] && ok "clean: exit 0" || bad "clean: exit $rc ($(tail -3 "$T/out"))"
[ "$(ref origin.git main)" = "$(ref upstream.git main)" ] && ok "clean: fork main == upstream" || bad "clean: fork main not synced"
git -C "$T/origin.git" cat-file -e home:new.txt 2>/dev/null && git -C "$T/origin.git" cat-file -e home:home.txt && ok "clean: origin home has upstream + home files" || bad "clean: origin home missing files"
git -C "$T/origin.git" log -1 --format=%s home | grep -q "merge upstream v0.2.0 into home" && ok "clean: merge message names release" || bad "clean: merge message '$(git -C "$T/origin.git" log -1 --format=%s home)'"

# 2. already up to date -> exit 0, message, origin home unchanged
before=$(ref origin.git home); rc=$(run)
[ "$rc" = 0 ] && grep -q "home already contains v0.2.0" "$T/out" && [ "$(ref origin.git home)" = "$before" ] && ok "noop: up to date, nothing pushed" || bad "noop: rc=$rc out=$(tail -2 "$T/out")"

# 3. conflict -> exit 1, file listed as ::error::, worktree clean, origin home unchanged
setup
(cd "$T/work" && printf 'a\nHOME\nc\n' > f.txt && g commit -qam "home edits f" && g push -q origin home)
upstream_commit f.txt 'a\nUPSTREAM\nc\n' "upstream edits f" v0.2.0
before=$(ref origin.git home); rc=$(run)
[ "$rc" = 1 ] && ok "conflict: exit 1" || bad "conflict: exit $rc"
grep -q '::error::.*f.txt' "$T/out" && ok "conflict: f.txt reported" || bad "conflict: not reported ($(tail -2 "$T/out"))"
[ -z "$(git -C "$T/work" status --porcelain)" ] && [ ! -e "$T/work/.git/MERGE_HEAD" ] && ok "conflict: merge aborted, tree clean" || bad "conflict: tree dirty"
[ "$(ref origin.git home)" = "$before" ] && ok "conflict: origin home not pushed" || bad "conflict: origin home changed"

# 4. diverged fork main -> exit non-zero, fork main not overwritten, home unchanged
setup
g -C "$T/work" fetch -q origin main
(cd "$T/work" && g switch -q -c tmp origin/main && printf 'x\n' > fork.txt && g add fork.txt && g commit -qm "fork-only on main" && g push -q origin tmp:main && g switch -q home)
upstream_commit new.txt 'n\n' "upstream new" v0.2.0
main_before=$(ref origin.git main); home_before=$(ref origin.git home); rc=$(run)
[ "$rc" != 0 ] && ok "diverged: non-zero exit" || bad "diverged: exit 0"
[ "$(ref origin.git main)" = "$main_before" ] && ok "diverged: fork main untouched" || bad "diverged: fork main overwritten"
[ "$(ref origin.git home)" = "$home_before" ] && ok "diverged: origin home untouched" || bad "diverged: home changed"

# 5. upstream adds or renames a workflow -> merge still succeeds, but a ::warning:: names the file
setup; upstream_commit .github/workflows/new-upstream.yml 'name: x\n' "upstream adds workflow" v0.2.0
rc=$(run)
[ "$rc" = 0 ] && ok "new workflow: sync still succeeds" || bad "new workflow: exit $rc"
grep -q '::warning::.*new-upstream.yml' "$T/out" && ok "new workflow: warning names the file" || bad "new workflow: no warning ($(tail -2 "$T/out"))"

# 6. upstream main moves without a release -> fork main synced, home untouched
setup; upstream_commit unreleased.txt 'u\n' "unreleased upstream work"
home_before=$(ref origin.git home); rc=$(run)
[ "$rc" = 0 ] && ok "no release: exit 0" || bad "no release: exit $rc ($(tail -2 "$T/out"))"
[ "$(ref origin.git main)" = "$(ref upstream.git main)" ] && ok "no release: fork main synced" || bad "no release: fork main not synced"
[ "$(ref origin.git home)" = "$home_before" ] && ok "no release: origin home untouched" || bad "no release: home changed"

# 7. a pre-release tag (v0.2.0-rc1) is never merged
setup; upstream_commit rc.txt 'r\n' "release candidate" v0.2.0-rc1
home_before=$(ref origin.git home); rc=$(run)
[ "$rc" = 0 ] && [ "$(ref origin.git home)" = "$home_before" ] && ok "rc tag: ignored" || bad "rc tag: rc=$rc home changed=$([ "$(ref origin.git home)" != "$home_before" ] && echo yes)"

echo "failures: $fails"
exit $((fails > 0))
