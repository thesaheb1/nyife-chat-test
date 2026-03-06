#!/bin/bash
set -e

# Run tests for all services that have test suites
# Usage: ./scripts/test-all.sh [--coverage]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
COVERAGE_FLAG=""

if [ "$1" = "--coverage" ]; then
  COVERAGE_FLAG="--coverage"
fi

SERVICES=(
  "auth-service"
  "wallet-service"
  "subscription-service"
  "campaign-service"
  "automation-service"
)

PASSED=0
FAILED=0
FAILED_SERVICES=""

echo "========================================"
echo "  Nyife — Running All Service Tests"
echo "========================================"
echo ""

for SERVICE in "${SERVICES[@]}"; do
  SERVICE_DIR="$ROOT_DIR/services/$SERVICE"

  if [ ! -d "$SERVICE_DIR/tests" ]; then
    echo "[$SERVICE] No tests directory — skipping"
    continue
  fi

  echo "----------------------------------------"
  echo "  Testing: $SERVICE"
  echo "----------------------------------------"

  cd "$SERVICE_DIR"

  if npx jest $COVERAGE_FLAG --no-verbose 2>&1; then
    echo "  ✓ $SERVICE — PASSED"
    PASSED=$((PASSED + 1))
  else
    echo "  ✗ $SERVICE — FAILED"
    FAILED=$((FAILED + 1))
    FAILED_SERVICES="$FAILED_SERVICES $SERVICE"
  fi

  echo ""
done

echo "========================================"
echo "  Results: $PASSED passed, $FAILED failed"
echo "========================================"

if [ $FAILED -gt 0 ]; then
  echo "  Failed services:$FAILED_SERVICES"
  exit 1
fi

echo "  All tests passed!"
exit 0
