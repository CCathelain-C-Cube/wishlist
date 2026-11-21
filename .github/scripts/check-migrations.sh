#!/usr/bin/env bash
# Fork-only: fail if the Prisma migrations don't apply cleanly to an empty database, or if the
# migrated database doesn't match prisma/schema.prisma. Upstream's entrypoint starts the server
# even when `migrate deploy` fails, so this has to be caught before an image is published.
set -euo pipefail

db_dir="$(mktemp -d)"
trap 'rm -rf "$db_dir"' EXIT
export DATABASE_URL="file:${db_dir}/ci.db"

echo "Applying migrations to an empty database"
pnpm prisma migrate deploy

echo "Comparing migrated database with prisma/schema.prisma"
set +e
pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
rc=$?
set -e
case "$rc" in
    0) echo "Migrations match the schema" ;;
    2)
        echo "::error::Schema drift: prisma/schema.prisma differs from the migrated database (missing or conflicting migration)."
        exit 1
        ;;
    *) exit "$rc" ;;
esac
