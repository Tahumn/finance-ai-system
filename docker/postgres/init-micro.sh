#!/bin/sh
set -eu

if [ -n "${DB_SCHEMA:-}" ]; then
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
    CREATE SCHEMA IF NOT EXISTS "${DB_SCHEMA}";
SQL
fi
