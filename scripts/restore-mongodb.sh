#!/usr/bin/env bash
#
# MongoDB Restore Script for CryoProcess
#
# Restores a CryoProcess MongoDB backup from a tarball.
#
# Usage:
#   ./scripts/restore-mongodb.sh <backup-tarball>
#
# Example:
#   ./scripts/restore-mongodb.sh ./backups/cryoprocess_backup_20260214_120000.tar.gz
#
# Environment variables (from .env or exported):
#   MONGODB_URI  - MongoDB connection string (required)
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

MONGODB_URI="${MONGODB_URI:?ERROR: MONGODB_URI is not set}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-tarball>"
  echo "Example: $0 ./backups/cryoprocess_backup_20260214_120000.tar.gz"
  exit 1
fi

TARBALL="$1"

if [[ ! -f "${TARBALL}" ]]; then
  echo "ERROR: File not found: ${TARBALL}"
  exit 1
fi

echo "============================================"
echo "CryoProcess MongoDB Restore"
echo "============================================"
echo "Time:    $(date)"
echo "Source:  ${TARBALL}"
echo ""

# Create temporary extraction directory
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_DIR}"' EXIT

# Extract tarball
echo "[1/3] Extracting backup..."
tar -xzf "${TARBALL}" -C "${TEMP_DIR}"

# Find the dump directory (first directory inside the extracted archive)
DUMP_DIR=$(find "${TEMP_DIR}" -maxdepth 1 -mindepth 1 -type d | head -1)

if [[ -z "${DUMP_DIR}" ]]; then
  echo "ERROR: No dump directory found in tarball"
  exit 1
fi

echo "       Extracted to: ${DUMP_DIR}"

# Confirm restore
echo ""
echo "WARNING: This will restore the database from the backup."
echo "         Existing data will be overwritten."
read -p "Continue? (yes/no): " CONFIRM

if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Restore cancelled."
  exit 0
fi

# Run mongorestore
echo ""
echo "[2/3] Running mongorestore..."
mongorestore \
  --uri="${MONGODB_URI}" \
  --gzip \
  --drop \
  "${DUMP_DIR}"

echo "[3/3] Restore complete."
echo ""
echo "============================================"
echo "Database restored from: $(basename "${TARBALL}")"
echo "============================================"
