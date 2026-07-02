#!/usr/bin/env bash
set -euo pipefail

# Pulls the Docker images built by the "Docker Build" GitHub Actions workflow
# from GHCR and brings up the full stack (frontend + backend + db) locally
# via docker compose, generating a throwaway .env if one doesn't exist yet.

GHCR_OWNER="sostinewaliaula"
GHCR_REPO="devices-docker"
export CI_REGISTRY_IMAGE="ghcr.io/${GHCR_OWNER}/${GHCR_REPO}"
export TAG="${TAG:-latest}"

# Raw GitHub base used to self-fetch the compose file + schema when this
# script is run standalone (curl'd on its own, without a full repo checkout).
RAW_BASE="https://raw.githubusercontent.com/${GHCR_OWNER}/${GHCR_REPO}/docker-deploy-setup"

if ! command -v docker &>/dev/null; then
  echo "Docker is not installed or not on PATH." >&2
  exit 1
fi

# This script only needs docker-compose.yml + the DB bootstrap schema in the
# current directory - it does not need a full repo checkout. Fetch whatever
# is missing so it also works when curl'd down on its own.
if [ ! -f docker-compose.yml ]; then
  echo "docker-compose.yml not found - fetching from GitHub..."
  curl -fsSL -o docker-compose.yml "${RAW_BASE}/docker-compose.yml"
fi

if [ ! -f backend/database/schema.sql ]; then
  echo "backend/database/schema.sql not found - fetching from GitHub (needed for DB bootstrap)..."
  mkdir -p backend/database
  curl -fsSL -o backend/database/schema.sql "${RAW_BASE}/backend/database/schema.sql"
fi

# GHCR packages are private by default. Either make the packages public in
# GitHub (repo -> Packages -> package settings -> Change visibility), or
# export GHCR_TOKEN to a PAT with `read:packages` scope before running this.
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "Logging in to ghcr.io as ${GHCR_OWNER}..."
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_OWNER" --password-stdin
else
  echo "GHCR_TOKEN not set - skipping docker login (only works if the GHCR packages are public)."
fi

if [ ! -f .env ]; then
  echo "No .env found - generating one for local testing (throwaway credentials, not for production)..."
  gen_secret() { openssl rand -hex "$1" 2>/dev/null || node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; }
  JWT_SECRET="$(gen_secret 32)"
  DB_PASSWORD="$(gen_secret 12)"
  DB_ROOT_PASSWORD="$(gen_secret 12)"
  cat > .env <<EOF
DB_CLIENT=mariadb
DB_HOST=db
DB_PORT=3306
DB_USER=app_user
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=assets_management
DB_ROOT_PASSWORD=${DB_ROOT_PASSWORD}
DB_SSL=false

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

PORT=3001
NODE_ENV=production
TZ=Africa/Nairobi

FRONTEND_URL=http://localhost
FRONTEND_URLS=

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
EOF
  echo "Generated .env with random DB/JWT secrets."
fi

echo "Pulling images from ${CI_REGISTRY_IMAGE} (tag: ${TAG})..."
docker compose pull
docker compose up -d

echo ""
echo "Stack starting. Check status with: docker compose ps"
echo "Frontend:   http://localhost/"
echo "Health:     http://localhost/health"
echo "API sample: http://localhost/api/departments"
