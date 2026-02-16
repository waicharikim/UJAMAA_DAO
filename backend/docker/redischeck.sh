#!/usr/bin/env sh
# docker/redischeck.sh — Wait for Redis to be ready

set -e

HOST="${1:-redis}"
PORT="${2:-6379}"
TIMEOUT="${3:-60}"

echo "Waiting up to ${TIMEOUT}s for Redis at ${HOST}:${PORT}..."

start_time=$(date +%s)

until nc -z "$HOST" "$PORT" 2>/dev/null; do
  current_time=$(date +%s)
  elapsed=$((current_time - start_time))
  
  if [ $elapsed -ge $TIMEOUT ]; then
    echo "❌ ERROR: Redis at ${HOST}:${PORT} not ready after ${TIMEOUT}s"
    exit 1
  fi
  
  echo "⏳ Waiting for Redis... (${elapsed}s elapsed)"
  sleep 2
done

echo "✅ Redis is ready at ${HOST}:${PORT}"
