#!/bin/bash
# Start all Nyife services for local development
# Usage: bash scripts/start-all.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PIDS=()

cleanup() {
  echo ""
  echo "Stopping all services..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null
  done
  wait
  echo "All services stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

SERVICES=(
  "api-gateway"
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

echo "Starting ${#SERVICES[@]} Nyife services..."
echo ""

for svc in "${SERVICES[@]}"; do
  svc_dir="$ROOT_DIR/services/$svc"
  if [ -f "$svc_dir/src/server.js" ]; then
    (cd "$svc_dir" && node src/server.js 2>&1 | sed "s/^/[$svc] /") &
    PIDS+=($!)
    echo "  Started $svc (PID: $!)"
  else
    echo "  SKIP $svc — no src/server.js found"
  fi
done

echo ""
echo "All services started. Press Ctrl+C to stop all."
echo ""
echo "Service ports:"
echo "  api-gateway:          http://localhost:3000"
echo "  auth-service:         http://localhost:3001"
echo "  user-service:         http://localhost:3002"
echo "  subscription-service: http://localhost:3003"
echo "  wallet-service:       http://localhost:3004"
echo "  contact-service:      http://localhost:3005"
echo "  template-service:     http://localhost:3006"
echo "  campaign-service:     http://localhost:3007"
echo "  chat-service:         http://localhost:3008"
echo "  whatsapp-service:     http://localhost:3009"
echo "  automation-service:   http://localhost:3010"
echo "  organization-service: http://localhost:3011"
echo "  notification-service: http://localhost:3012"
echo "  email-service:        http://localhost:3013"
echo "  support-service:      http://localhost:3014"
echo "  admin-service:        http://localhost:3015"
echo "  analytics-service:    http://localhost:3016"
echo "  media-service:        http://localhost:3017"
echo ""
echo "API Docs: http://localhost:3000/api-docs"
echo "Health:   http://localhost:3000/health"
echo ""

# Wait for all background processes
wait
