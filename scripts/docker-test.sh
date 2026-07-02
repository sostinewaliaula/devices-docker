#!/usr/bin/env bash
set -euo pipefail

# Pulls the Docker images built by the "Docker Build" GitHub Actions workflow
# from GHCR and brings up the full stack (frontend + backend + db) locally
# via docker compose, generating a throwaway .env if one doesn't exist yet.

GHCR_OWNER="sostinewaliaula"
GHCR_REPO="devices-docker"
export CI_REGISTRY_IMAGE="ghcr.io/${GHCR_OWNER}/${GHCR_REPO}"
export TAG="${TAG:-latest}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v docker &>/dev/null; then
  echo "Docker is not installed or not on PATH." >&2
  exit 1
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
