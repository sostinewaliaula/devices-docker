#!/bin/bash

# Caava Group Devices Management System - Self-Hosting Setup Script

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

GHCR_OWNER="sostinewaliaula"
GHCR_REPO="devices-docker"
BRANCH="docker-deploy-setup"
REPO_RAW_URL="https://raw.githubusercontent.com/${GHCR_OWNER}/${GHCR_REPO}/${BRANCH}"
export CI_REGISTRY_IMAGE="ghcr.io/${GHCR_OWNER}/${GHCR_REPO}"

echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}              Caava Group - Devices Management System                  ${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Self-Hosting Management Script${NC}\n"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

env_var() {
    grep "^${1}=" .env 2>/dev/null | head -n1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" | tr -d '\r'
}

show_menu() {
    echo -e "${BOLD}Select an action you want to perform:${NC}"
    echo -e "   1) ${GREEN}Setup / Install${NC} (Fetch compose file + schema, generate .env)"
    echo -e "   2) ${BLUE}Pull Latest Images${NC}"
    echo -e "   3) ${BLUE}Start Services${NC} (docker compose up)"
    echo -e "   4) ${YELLOW}Stop Services${NC} (docker compose down)"
    echo -e "   5) ${BLUE}Restart Services${NC}"
    echo -e "   6) ${BLUE}View Logs${NC}"
    echo -e "   7) ${GREEN}Backup Data${NC} (Database + Backups Volume + Config)"
    echo -e "   8) ${RED}Restore Data${NC} (Select from saved backups)"
    echo -e "   9) ${RED}Wipe Instance Data${NC} (Reset all volumes)"
    echo -e "   10) ${YELLOW}Re-apply Schema${NC} (Fills in any missing tables)"
    echo -e "   11) ${GREEN}Apply New Migrations${NC} (Add tables/columns without touching data)"
    echo -e "   12) Exit"
    echo -ne "\nAction [3]: "
}

# ─────────────────────────────────────────────────────────────────────────────
# SETUP
# ─────────────────────────────────────────────────────────────────────────────

setup_env() {
    echo -e "\n${YELLOW}Setting up orchestration files...${NC}"

    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${BLUE}Downloading docker-compose.yml...${NC}"
        curl -fsSL -o docker-compose.yml "${REPO_RAW_URL}/docker-compose.yml"
    else
        echo -e "${BLUE}i${NC} docker-compose.yml already exists, skipping download."
    fi

    if [ ! -f "backend/database/schema.sql" ]; then
        echo -e "${BLUE}Downloading backend/database/schema.sql...${NC}"
        mkdir -p backend/database
        curl -fsSL -o backend/database/schema.sql "${REPO_RAW_URL}/backend/database/schema.sql"
    else
        echo -e "${BLUE}i${NC} schema.sql already exists, skipping download."
    fi

    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}Generating .env with fresh secrets...${NC}"
        gen_secret() { openssl rand -hex "$1" 2>/dev/null || node -e "console.log(require('crypto').randomBytes($1).toString('hex'))"; }
        JWT_SECRET="$(gen_secret 32)"
        DB_PASSWORD="$(gen_secret 12)"
        DB_ROOT_PASSWORD="$(gen_secret 12)"
        cat > .env <<EOF
CI_REGISTRY_IMAGE=${CI_REGISTRY_IMAGE}
TAG=latest

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

HOST_HTTP_PORT=8080
EOF
        echo -e "${GREEN}✓${NC} Generated .env (HOST_HTTP_PORT defaults to 8080 - edit if needed)"
    else
        echo -e "${BLUE}i${NC} .env already exists, skipping generation."
    fi
}

pull_images() {
    echo -e "\n${YELLOW}Pulling latest images...${NC}"
    docker compose pull
    echo -e "${GREEN}✓ Done.${NC}"
}

start_services() {
    echo -e "\n${GREEN}Starting services...${NC}"
    docker compose up -d
    PORT_IN_USE="$(env_var HOST_HTTP_PORT)"
    echo -e "\n${GREEN}Services started! Visit http://localhost:${PORT_IN_USE:-8080}/${NC}"
}

stop_services() {
    echo -e "\n${YELLOW}Stopping services...${NC}"
    docker compose down
}

restart_services() {
    echo -e "\n${BLUE}Restarting services...${NC}"
    docker compose restart
}

view_logs() {
    docker compose logs -f
}

# ─────────────────────────────────────────────────────────────────────────────
# BACKUP
# ─────────────────────────────────────────────────────────────────────────────

backup_data() {
    BACKUP_DIR="./backups"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    TMP="./backup_tmp_${TIMESTAMP}"
    mkdir -p "$BACKUP_DIR" "$TMP"

    DB_ROOT_PASSWORD=$(env_var DB_ROOT_PASSWORD)
    DB_NAME=$(env_var DB_NAME)
    DB_NAME=${DB_NAME:-assets_management}

    echo -e "\n${BOLD}Starting backup — ${TIMESTAMP}${NC}"

    echo -e "${BLUE}[1/3] Dumping MariaDB database '${DB_NAME}'...${NC}"
    docker compose exec -T db mariadb-dump -u root -p"${DB_ROOT_PASSWORD}" "${DB_NAME}" > "$TMP/database.sql" 2>/dev/null
    if [ $? -ne 0 ] || [ ! -s "$TMP/database.sql" ]; then
        echo -e "${RED}✗ Database dump failed. Aborting.${NC}"
        rm -rf "$TMP"
        return
    fi
    DB_SIZE=$(du -sh "$TMP/database.sql" | cut -f1)
    echo -e "${GREEN}  ✓ Database dumped (${DB_SIZE})${NC}"

    echo -e "${BLUE}[2/3] Archiving generated backup/upload files...${NC}"
    BACKUPS_VOL=$(docker volume ls -q | grep backend-backups | head -n 1)
    if [ -n "$BACKUPS_VOL" ]; then
        docker run --rm \
            -v "${BACKUPS_VOL}:/data:ro" \
            -v "$(pwd)/${TMP}:/backup" \
            alpine tar czf /backup/backend-backups.tar.gz -C /data . 2>/dev/null
        VOL_SIZE=$(du -sh "$TMP/backend-backups.tar.gz" | cut -f1)
        echo -e "${GREEN}  ✓ Volume archived (${VOL_SIZE})${NC}"
    else
        echo -e "${YELLOW}  ⚠ No backend-backups volume found — skipping${NC}"
        touch "$TMP/backend-backups.tar.gz"
    fi

    echo -e "${BLUE}[3/3] Saving configuration (.env) and packaging...${NC}"
    cp .env "$TMP/devices.env"
    BACKUP_FILE="${BACKUP_DIR}/devices_backup_${TIMESTAMP}.tar.gz"
    tar czf "$BACKUP_FILE" -C "$TMP" .
    rm -rf "$TMP"

    TOTAL_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
    echo -e "\n${GREEN}${BOLD}✓ Backup complete!${NC}"
    echo -e "   File    : ${BOLD}${BACKUP_FILE}${NC}"
    echo -e "   Size    : ${TOTAL_SIZE}"
    echo -e "\n${YELLOW}Tip: Copy this file offsite for safety.${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# RESTORE
# ─────────────────────────────────────────────────────────────────────────────

restore_data() {
    BACKUP_DIR="./backups"
    echo -e "\n${BOLD}Available Backups:${NC}"

    mapfile -t BACKUPS < <(ls -t "${BACKUP_DIR}"/devices_backup_*.tar.gz 2>/dev/null)

    if [ ${#BACKUPS[@]} -eq 0 ]; then
        echo -e "${YELLOW}No backups found in ${BACKUP_DIR}/${NC}"
        echo -ne "Enter full path to a backup file (or press Enter to cancel): "
        read manual_path
        if [ -z "$manual_path" ] || [ ! -f "$manual_path" ]; then
            echo -e "${BLUE}Restore cancelled.${NC}"
            return
        fi
        SELECTED="$manual_path"
    else
        for i in "${!BACKUPS[@]}"; do
            BFILE="${BACKUPS[$i]}"
            BNAME=$(basename "$BFILE")
            BSIZE=$(du -sh "$BFILE" | cut -f1)
            echo -e "   $((i+1))) ${BLUE}${BNAME}${NC}  ${BSIZE}"
        done
        MANUAL_OPT=$((${#BACKUPS[@]}+1))
        echo -e "   ${MANUAL_OPT}) Enter path manually"
        echo -ne "\nSelect backup [1]: "
        read choice
        choice=${choice:-1}

        if [ "$choice" -eq "$MANUAL_OPT" ] 2>/dev/null; then
            echo -ne "Enter full path to backup file: "
            read manual_path
            if [ ! -f "$manual_path" ]; then
                echo -e "${RED}File not found.${NC}"
                return
            fi
            SELECTED="$manual_path"
        elif [ "$choice" -ge 1 ] && [ "$choice" -le "${#BACKUPS[@]}" ] 2>/dev/null; then
            SELECTED="${BACKUPS[$((choice-1))]}"
        else
            echo -e "${RED}Invalid selection.${NC}"
            return
        fi
    fi

    echo -e "\n${RED}${BOLD}WARNING: This will overwrite your current data!${NC}"
    echo -e "Selected : ${BOLD}$(basename "$SELECTED")${NC}"
    echo -ne "Are you sure? (y/N): "
    read confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Restore cancelled.${NC}"
        return
    fi

    echo -e "${YELLOW}Extracting backup...${NC}"
    TMP="./restore_tmp"
    mkdir -p "$TMP"
    tar -xzf "$SELECTED" -C "$TMP"

    if [ -f "$TMP/backend-backups.tar.gz" ] && [ -s "$TMP/backend-backups.tar.gz" ]; then
        echo -e "${BLUE}Restoring backup/upload files volume...${NC}"
        BACKUPS_VOL=$(docker volume ls -q | grep backend-backups | head -n 1)
        docker run --rm \
            -v "$(pwd)/${TMP}:/backup" \
            -v "${BACKUPS_VOL}:/export" \
            alpine sh -c "rm -rf /export/* && tar xzf /backup/backend-backups.tar.gz -C /export"
        echo -e "${GREEN}  ✓ Volume restored${NC}"
    else
        echo -e "${YELLOW}  ⚠ No volume archive in this backup — skipping${NC}"
    fi

    echo -e "${BLUE}Restoring database...${NC}"
    DB_ROOT_PASSWORD=$(env_var DB_ROOT_PASSWORD)
    DB_NAME=$(env_var DB_NAME)
    DB_NAME=${DB_NAME:-assets_management}

    echo -e "${YELLOW}  Resetting database '${DB_NAME}'...${NC}"
    docker compose exec -T db mariadb -u root -p"${DB_ROOT_PASSWORD}" -e "DROP DATABASE IF EXISTS ${DB_NAME}; CREATE DATABASE ${DB_NAME};"

    echo -e "${YELLOW}  Importing data...${NC}"
    docker compose exec -T db mariadb -u root -p"${DB_ROOT_PASSWORD}" "${DB_NAME}" < "$TMP/database.sql"
    echo -e "${GREEN}  ✓ Database restored${NC}"

    rm -rf "$TMP"
    echo -e "\n${GREEN}${BOLD}✓ Restore complete!${NC}"
    echo -e "${YELLOW}Run option 5 (Restart Services) to bring the backend back up cleanly.${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# WIPE / SCHEMA
# ─────────────────────────────────────────────────────────────────────────────

wipe_data() {
    echo -e "${RED}${BOLD}🚨 WARNING: This will permanently delete your database and all volumes!${NC}"
    echo -ne "Are you sure you want to completely reset this instance? (y/N): "
    read confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Wiping all instance data...${NC}"
        docker compose down -v
        echo -e "${GREEN}✓ Done. Instance has been reset to a clean state.${NC}"
    else
        echo -e "${BLUE}Wipe cancelled.${NC}"
    fi
}

reapply_schema() {
    echo -e "${YELLOW}Re-fetching latest schema.sql and re-applying table structure only...${NC}"
    echo -e "${BLUE}i${NC} Only CREATE TABLE statements are replayed (idempotent) - seed/admin data is skipped so it won't collide with existing rows."
    curl -fsSL -o /tmp/schema_reapply_full.sql "${REPO_RAW_URL}/backend/database/schema.sql?cb=$(date +%s)"

    # Strip everything from the seed-data marker onward, keeping only DDL
    sed '/-- REFERENCE \/ SEED DATA/,$d' /tmp/schema_reapply_full.sql > /tmp/schema_reapply_ddl.sql

    DB_ROOT_PASSWORD=$(env_var DB_ROOT_PASSWORD)
    DB_NAME=$(env_var DB_NAME)
    DB_NAME=${DB_NAME:-assets_management}

    docker compose exec -T db mariadb -u root -p"${DB_ROOT_PASSWORD}" "${DB_NAME}" < /tmp/schema_reapply_ddl.sql
    rm -f /tmp/schema_reapply_full.sql /tmp/schema_reapply_ddl.sql
    echo -e "${GREEN}✓ Table structure re-applied.${NC}"
}

apply_migrations() {
    echo -e "\n${YELLOW}Checking for new migrations...${NC}"

    DB_ROOT_PASSWORD=$(env_var DB_ROOT_PASSWORD)
    DB_NAME=$(env_var DB_NAME)
    DB_NAME=${DB_NAME:-assets_management}

    # Ensure the tracking table exists, in case this instance predates it
    docker compose exec -T db mariadb -u root -p"${DB_ROOT_PASSWORD}" "${DB_NAME}" -e \
        "CREATE TABLE IF NOT EXISTS schema_migrations (filename VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);" 2>/dev/null

    # Cache-bust: raw.githubusercontent.com can serve a stale copy for a
    # few minutes right after a push otherwise.
    curl -fsSL -o /tmp/migrations_manifest.txt "${REPO_RAW_URL}/deploy/migrations/manifest.txt?cb=$(date +%s)"

    APPLIED_COUNT=0
    SKIPPED_COUNT=0

    while IFS= read -r filename || [ -n "$filename" ]; do
        filename="$(echo "$filename" | tr -d '\r')"
        [[ -z "$filename" || "$filename" == \#* ]] && continue

        ALREADY=$(docker compose exec -T db mariadb -u root -p"${DB_ROOT_PASSWORD}" -N -s "${DB_NAME}" \
            -e "SELECT COUNT(*) FROM schema_migrations WHERE filename='${filename}';" 2>/dev/null | tr -d '\r')

        if [ "$ALREADY" = "1" ]; then
            echo -e "${BLUE}i${NC} ${filename} already applied, skipping."
            SKIPPED_COUNT=$((SKIPPED_COUNT+1))
            continue
        fi

        echo -e "${BLUE}Applying ${filename}...${NC}"
        curl -fsSL -o /tmp/migration_apply.sql "${REPO_RAW_URL}/deploy/migrations/${filename}?cb=$(date +%s)"
        docker compose exec -T db mariadb -u root -p"${DB_ROOT_PASSWORD}" "${DB_NAME}" < /tmp/migration_apply.sql

        if [ $? -eq 0 ]; then
            docker compose exec -T db mariadb -u root -p"${DB_ROOT_PASSWORD}" "${DB_NAME}" \
                -e "INSERT INTO schema_migrations (filename) VALUES ('${filename}');"
            echo -e "${GREEN}  ✓ Applied${NC}"
            APPLIED_COUNT=$((APPLIED_COUNT+1))
        else
            echo -e "${RED}✗ Migration ${filename} failed - stopping here. Fix it and re-run this option.${NC}"
            rm -f /tmp/migration_apply.sql /tmp/migrations_manifest.txt
            return
        fi
    done < /tmp/migrations_manifest.txt

    rm -f /tmp/migration_apply.sql /tmp/migrations_manifest.txt
    echo -e "\n${GREEN}${BOLD}✓ Done.${NC} Applied: ${APPLIED_COUNT}, already up to date: ${SKIPPED_COUNT}"
}

while true; do
    show_menu
    read choice
    if [ -z "$choice" ]; then choice=3; fi

    case $choice in
        1) setup_env ;;
        2) pull_images ;;
        3) start_services ;;
        4) stop_services ;;
        5) restart_services ;;
        6) view_logs ;;
        7) backup_data ;;
        8) restore_data ;;
        9) wipe_data ;;
        10) reapply_schema ;;
        11) apply_migrations ;;
        12) exit 0 ;;
        *) echo -e "${RED}Invalid option, please try again.${NC}" ;;
    esac
    echo -e "\n"
done
