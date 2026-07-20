#!/bin/bash
set -e

echo "Rebuilding & starting..."
make down || true
make dev --build

echo "Waiting 10s for startup..."
sleep 10

echo "Checking health..."
curl -s http://localhost:4000/health | jq || echo "Health check failed"

echo "Tailing logs (Ctrl+C to stop)..."
make logs