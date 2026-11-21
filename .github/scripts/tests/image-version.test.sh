#!/usr/bin/env bash
# Tests for .github/scripts/image-version.sh against throwaway repos.
# Usage (repo root): bash .github/scripts/tests/image-version.test.sh [path-to-image-version.sh]
set -uo pipefail
SCRIPT=$(realpath "${1:-.github/scripts/image-version.sh}")
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fails=0
ok() { echo "PASS: $1"; }
bad() { echo "FAIL: $1"; fails=$((fails + 1)); }
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
g() { git -c init.defaultBranch=main "$@"; }
c() { g -C "$1" commit -q --allow-empty -m "$2"; }

# upstream: v0.1.0 -> v0.2.0 -> (rc tag) on main; v0.3.0 on a side branch
setup() {
    rm -rf "$T"/*
    g init -q "$T/up"
    c "$T/up" one; g -C "$T/up" tag v0.1.0
    c "$T/up" two; g -C "$T/up" tag v0.2.0
    c "$T/up" three; g -C "$T/up" tag v0.2.1-rc1
    g -C "$T/up" switch -q -c side; c "$T/up" side; g -C "$T/up" tag v0.3.0; g -C "$T/up" switch -q main
    g clone -q --no-tags "$T/up" "$T/work"
}
run() { (cd "$T/work" && UPSTREAM_URL="$T/up" bash "$SCRIPT") > "$T/out" 2> "$T/err"; echo $?; }

# 1. tags only upstream (clone has none): fetched, newest contained release printed; rc and side ignored
setup
[ -z "$(git -C "$T/work" tag)" ] || bad "setup: clone unexpectedly has tags"
rc=$(run)
[ "$rc" = 0 ] && [ "$(cat "$T/out")" = "0.2.0" ] && ok "prints newest contained release (0.2.0)" || bad "got rc=$rc out='$(cat "$T/out")' err='$(tail -1 "$T/err")'"

# 2. stdout is exactly the version (usable as $(...)), no fetch noise
[ "$(wc -l < "$T/out")" -le 1 ] && ok "stdout is a single line" || bad "stdout has extra lines"

# 3. no release tags anywhere -> non-zero with ::error::
rm -rf "$T"/*; g init -q "$T/up"; c "$T/up" one; g clone -q --no-tags "$T/up" "$T/work"
rc=$(run)
[ "$rc" != 0 ] && grep -q "::error::" "$T/out" "$T/err" && ok "no tags: fails with ::error::" || bad "no tags: rc=$rc out='$(cat "$T/out")'"

echo "failures: $fails"
exit $((fails > 0))
