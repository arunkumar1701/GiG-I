#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCHEMA_PATH="${ROOT_DIR}/backend/prisma/schema.prisma"

if [[ -z "${DB_URL:-}" ]]; then
  echo "DB_URL is required. Example:"
  echo "  export DB_URL='postgresql://gigi:gigi@localhost:5432/gigi?schema=public'"
  exit 1
fi

export DATABASE_URL="${DB_URL}"

python -m prisma generate --schema "${SCHEMA_PATH}"
python -m prisma migrate dev --schema "${SCHEMA_PATH}" --name "${1:-init}"
