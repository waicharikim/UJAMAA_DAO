#!/usr/bin/env sh
# docker/postgrescheck.sh
# Usage: postgrescheck.sh <host> <port> [timeout_seconds]
# Waits for host:port to accept TCP connections. Exits non-zero on timeout.

set -e

host="$1"
port="$2"
timeout="${3:-60}"  # default timeout 60s

if [ -z "$host" ] || [ -z "$port" ]; then
  echo "Usage: $0 <host> <port> [timeout_seconds]"
  exit 2
fi

echo "⏳ Waiting up to ${timeout}s for PostgreSQL at ${host}:${port}..."

start_ts=$(date +%s)
while ! nc -z "$host" "$port"; do
  sleep 1
  now_ts=$(date +%s)
  elapsed=$((now_ts - start_ts))
  if [ "$elapsed" -ge "$timeout" ]; then
    echo "❌ ERROR: Timed out after ${timeout}s waiting for ${host}:${port}"
    exit 1
  fi
  
  # Show progress every 5 seconds
  if [ $((elapsed % 5)) -eq 0 ] && [ $elapsed -gt 0 ]; then
    echo "   Still waiting... (${elapsed}s elapsed)"
  fi
done

echo "✅ PostgreSQL is ready at ${host}:${port}"
exit 0