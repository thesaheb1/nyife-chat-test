#!/bin/bash
# Nyife — Create all Kafka topics
# Usage: ./scripts/setup-kafka-topics.sh
#
# Run this script after Kafka is up and running.
# If using docker-compose, run:
#   docker exec nyife-kafka bash -c "$(cat scripts/setup-kafka-topics.sh)"
# Or run directly if kafka-topics CLI is available locally.

set -e

KAFKA_BOOTSTRAP="${KAFKA_BOOTSTRAP_SERVER:-localhost:9092}"
PARTITIONS="${KAFKA_PARTITIONS:-12}"
REPLICATION="${KAFKA_REPLICATION_FACTOR:-1}"

TOPICS=(
  "campaign.execute"
  "campaign.status"
  "campaign.analytics"
  "notification.send"
  "email.send"
  "webhook.inbound"
  "wallet.transaction"
  "user.events"
)

echo "========================================="
echo "  Nyife — Kafka Topic Setup"
echo "========================================="
echo "  Bootstrap: $KAFKA_BOOTSTRAP"
echo "  Partitions: $PARTITIONS"
echo "  Replication: $REPLICATION"
echo "========================================="
echo ""

for TOPIC in "${TOPICS[@]}"; do
  echo "Creating topic: $TOPIC"
  kafka-topics --create \
    --bootstrap-server "$KAFKA_BOOTSTRAP" \
    --topic "$TOPIC" \
    --partitions "$PARTITIONS" \
    --replication-factor "$REPLICATION" \
    --if-not-exists \
    2>&1 || echo "  Warning: Could not create topic $TOPIC (may already exist)"
done

echo ""
echo "========================================="
echo "  Listing all topics:"
echo "========================================="
kafka-topics --list --bootstrap-server "$KAFKA_BOOTSTRAP" 2>&1 || echo "Could not list topics"

echo ""
echo "Kafka topic setup complete."
