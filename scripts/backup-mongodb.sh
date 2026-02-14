#!/usr/bin/env bash
#
# MongoDB Backup Script for CryoProcess
#
# Creates timestamped mongodump backups with gzip compression.
# Cleans up backups older than RETENTION_DAYS.
# Optionally uploads to S3 if BACKUP_S3_BUCKET is set.
#
# Usage:
#   ./scripts/backup-mongodb.sh
#
# Environment variables (from .env or exported):
#   MONGODB_URI        - MongoDB connection string (required)
#   BACKUP_DIR         - Backup directory (default: ./backups)
#   RETENTION_DAYS     - Days to keep backups (default: 14)
#   BACKUP_S3_BUCKET   - S3 bucket for offsite copy (optional)
#

set -euo pipefail

# Load .env if it exists
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# Configuration
MONGODB_URI="${MONGODB_URI:?ERROR: MONGODB_URI is not set}"
BACKUP_DIR="${BACKUP_DIR:-$SCRIPT_DIR/../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="cryoprocess_backup_${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo "============================================"
echo "CryoProcess MongoDB Backup"
echo "============================================"
echo "Time:       $(date)"
echo "Backup Dir: ${BACKUP_DIR}"
echo "Retention:  ${RETENTION_DAYS} days"
echo ""

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Run mongodump
echo "[1/4] Running mongodump..."
mongodump \
  --uri="${MONGODB_URI}" \
  --out="${BACKUP_PATH}" \
  --gzip \
  --quiet

if [[ $? -ne 0 ]]; then
  echo "ERROR: mongodump failed"
  exit 1
fi

# Create tarball
echo "[2/4] Creating tarball..."
TARBALL="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
tar -czf "${TARBALL}" -C "${BACKUP_DIR}" "${BACKUP_NAME}"

# Remove raw dump directory (keep only tarball)
rm -rf "${BACKUP_PATH}"

TARBALL_SIZE=$(du -h "${TARBALL}" | cut -f1)
echo "       Created: ${TARBALL} (${TARBALL_SIZE})"

# Upload to S3 (optional)
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "[3/4] Uploading to S3..."
  if command -v aws &>/dev/null; then
    aws s3 cp "${TARBALL}" "s3://${BACKUP_S3_BUCKET}/mongodb-backups/${BACKUP_NAME}.tar.gz" --quiet
    echo "       Uploaded to s3://${BACKUP_S3_BUCKET}/mongodb-backups/"
  else
    echo "       WARNING: aws CLI not found — skipping S3 upload"
  fi
else
  echo "[3/4] S3 upload skipped (BACKUP_S3_BUCKET not set)"
fi

# Clean up old backups
echo "[4/4] Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "${BACKUP_DIR}" -name "cryoprocess_backup_*.tar.gz" -mtime +"${RETENTION_DAYS}" -delete -print | wc -l)
echo "       Removed ${DELETED} old backup(s)"

echo ""
echo "Backup complete: ${TARBALL}"
echo "============================================"
