#!/usr/bin/env bash
#
# backup-db.sh — daily production Postgres backup for UjamaaDAO.
#
# Why this exists: on 2026-06-01 a re-seed nulled every user's ward and there
# were NO backups on the droplet, so it was unrecoverable. This makes a
# timestamped, gzip'd dump, keeps a local rolling window, AND (optionally)
# pushes an OFF-BOX copy so losing the droplet ≠ losing the data.
#
# Cron-friendly: no TTY, no interactive prompts, non-zero exit on failure.
# Install the daily cron with:  cd backend && make prod-backup-cron
# Or by hand (crontab -e):
#   0 2 * * * /home/<user>/UJAMAA_DAO/docker/backup-db.sh >> /home/<user>/ujamaa-backups/backup.log 2>&1
#
# Config (all optional, read from docker/.env.prod or the environment):
#   POSTGRES_USER / POSTGRES_DB   — DB creds (default ujamaa_user / ujamaa_db)
#   POSTGRES_CONTAINER            — container name (default ujamaa_postgres)
#   BACKUP_DIR                    — local dir   (default $HOME/ujamaa-backups)
#   BACKUP_RETENTION_DAYS         — local + remote prune window (default 14)
#   BACKUP_RCLONE_REMOTE          — e.g. "spaces:ujamaa-backups" for off-box copy
#                                   (needs rclone installed + configured). Unset = skip.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env.prod}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Load .env.prod (POSTGRES_* etc.) without clobbering values already exported.
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

PG_USER="${POSTGRES_USER:-ujamaa_user}"
PG_DB="${POSTGRES_DB:-ujamaa_db}"
CONTAINER="${POSTGRES_CONTAINER:-ujamaa_postgres}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/ujamaa-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  log "ERROR: postgres container '$CONTAINER' is not running"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TS="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/ujamaa_${PG_DB}_${TS}.sql.gz"

log "Dumping '$PG_DB' from '$CONTAINER' -> $FILE"
# pipefail makes this fail if pg_dump fails even though gzip succeeds.
if ! docker exec "$CONTAINER" pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$FILE"; then
  log "ERROR: pg_dump failed — removing partial file"
  rm -f "$FILE"
  exit 1
fi

# Guard against an empty/corrupt dump (don't let a 0-byte file masquerade as a backup).
if [ ! -s "$FILE" ] || ! gzip -t "$FILE" 2>/dev/null; then
  log "ERROR: backup file is empty or corrupt — removing"
  rm -f "$FILE"
  exit 1
fi
log "Backup OK ($(du -h "$FILE" | cut -f1))"

# Off-box copy (the part that actually protects against droplet loss).
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1; then
    log "Copying off-box -> $BACKUP_RCLONE_REMOTE"
    if rclone copy "$FILE" "$BACKUP_RCLONE_REMOTE"; then
      log "Off-box copy done"
      rclone delete --min-age "${RETENTION_DAYS}d" "$BACKUP_RCLONE_REMOTE" 2>/dev/null || true
    else
      log "WARN: off-box copy FAILED — local backup kept, fix rclone"
    fi
  else
    log "WARN: BACKUP_RCLONE_REMOTE set but rclone not installed — skipping off-box copy"
  fi
else
  log "WARN: no BACKUP_RCLONE_REMOTE configured — backup is ON-BOX ONLY (set it before relying on this)"
fi

# Local retention prune.
find "$BACKUP_DIR" -maxdepth 1 -name 'ujamaa_*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete \
  | sed 's/^/[pruned] /' || true

log "Done."
