#!/bin/bash
# Nyife — Run all service migrations
# Usage: ./scripts/migrate-all.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SERVICES=(
  "auth-service"
  "user-service"
  "subscription-service"
  "wallet-service"
  "contact-service"
  "template-service"
  "campaign-service"
  "chat-service"
  "whatsapp-service"
  "automation-service"
  "organization-service"
  "notification-service"
  "email-service"
  "support-service"
  "admin-service"
  "analytics-service"
  "media-service"
)

echo "========================================="
echo "  Nyife — Running All Migrations"
echo "========================================="
echo ""

FAILED=0
SKIPPED=0
SUCCESS=0

for SERVICE in "${SERVICES[@]}"; do
  SERVICE_DIR="$PROJECT_ROOT/services/$SERVICE"
  MIGRATION_DIR="$SERVICE_DIR/src/migrations"

  if [ ! -d "$SERVICE_DIR" ]; then
    echo "[$SERVICE] Directory not found — skipping"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  if [ ! -d "$MIGRATION_DIR" ] || [ -z "$(ls -A "$MIGRATION_DIR" 2>/dev/null)" ]; then
    echo "[$SERVICE] No migrations found — skipping"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "[$SERVICE] Running migrations..."
  cd "$SERVICE_DIR"

  if npx sequelize-cli db:migrate 2>&1; then
    echo "[$SERVICE] Migrations completed successfully"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "[$SERVICE] Migration FAILED"
    FAILED=$((FAILED + 1))
  fi

  echo ""
done

echo "========================================="
echo "  Migration Summary"
echo "========================================="
echo "  Success: $SUCCESS"
echo "  Skipped: $SKIPPED"
echo "  Failed:  $FAILED"
echo "========================================="

if [ $FAILED -gt 0 ]; then
  echo "Some migrations failed. Check the output above."
  exit 1
fi

echo "All migrations completed successfully."
exit 0
