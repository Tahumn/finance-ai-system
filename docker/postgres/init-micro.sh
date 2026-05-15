#!/bin/sh
set -eu

# Optional schema bootstrap for Postgres init container.
# Uses standard Postgres envs with safe defaults.
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"
DB_SCHEMA="${DB_SCHEMA:-}"

if [ -n "${DB_SCHEMA}" ]; then
  psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${POSTGRES_DB}" <<-SQL
    CREATE SCHEMA IF NOT EXISTS "${DB_SCHEMA}";
SQL
fi
