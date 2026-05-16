#!/usr/bin/env sh
set -eu

months="${SEED_MONTHS:-6}"
email="${SEED_EMAIL:-}"
force="${SEED_FORCE:-true}"
create_demo="${SEED_CREATE_DEMO_USER:-true}"
demo_email="${SEED_DEMO_EMAIL:-tthupphan@gmail.com}"
demo_username="${SEED_DEMO_USERNAME:-mchau}"
demo_password="${SEED_DEMO_PASSWORD:-minhchau2004}"
seed_base="${SEED_BASE:-20260412}"

args="--months ${months} --seed ${seed_base}"

case "${force}" in
  1|true|TRUE|yes|YES|y|Y) args="${args} --force" ;;
esac

if [ -n "${email}" ]; then
  args="${args} --email ${email}"
fi

case "${create_demo}" in
  1|true|TRUE|yes|YES|y|Y)
    args="${args} --create-demo-user --demo-email ${demo_email} --demo-username ${demo_username} --demo-password ${demo_password}"
    ;;
esac

echo "[seed] Running: python -m app.scripts.seed_recent_transactions ${args}"
exec python -m app.scripts.seed_recent_transactions ${args}
