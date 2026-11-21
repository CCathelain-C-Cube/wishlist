#!/usr/bin/env bash
# Rehearsal for .github/scripts/check-migrations.sh. Run from the repo root inside `devbox run`.
# Usage (repo root): devbox run -- bash .github/scripts/tests/check-migrations.test.sh [path-to-check-migrations.sh]
set -uo pipefail
SCRIPT=$(realpath "${1:-.github/scripts/check-migrations.sh}")
ROOT=$(pwd)
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
fails=0
ok() { echo "PASS: $1"; }
bad() { echo "FAIL: $1"; fails=$((fails + 1)); }

copy() { rm -rf "$T/r"; mkdir -p "$T/r"; cp -r "$ROOT/prisma" "$ROOT/prisma.config.ts" "$ROOT/package.json" "$T/r/"; ln -s "$ROOT/node_modules" "$T/r/node_modules"; rm -f "$T"/r/prisma/*.db*; }
run() { (cd "$T/r" && bash "$SCRIPT") > "$T/out" 2>&1; echo $?; }

# 1. current tree: migrations apply and match the schema
copy; rc=$(run)
[ "$rc" = 0 ] && ok "clean tree: exit 0" || bad "clean tree: exit $rc ($(tail -3 "$T/out"))"

# 2. duplicate migration (same tables under another name, as if upstream adopted the feature) -> fail
copy; src=$(ls -d "$T"/r/prisma/migrations/*_add_secret_santa); cp -r "$src" "$T/r/prisma/migrations/20991231000000_add_secret_santa_upstream"
rc=$(run)
[ "$rc" != 0 ] && ok "duplicate migration: non-zero exit" || bad "duplicate migration: exit 0"

# 3. schema changed without a migration -> fail
copy; printf '\nmodel DriftCheck {\n    id String @id\n}\n' >> "$T/r/prisma/schema.prisma"
rc=$(run)
[ "$rc" != 0 ] && ok "schema drift: non-zero exit" || bad "schema drift: exit 0"
grep -qi "drift" "$T/out" && ok "schema drift: explained" || bad "schema drift: no message ($(tail -2 "$T/out"))"

echo "failures: $fails"
exit $((fails > 0))
