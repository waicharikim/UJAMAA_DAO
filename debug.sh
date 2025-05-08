#!/bin/bash
set -e

echo "=== Starting PostgreSQL Docker container ==="
docker compose -f ./docker/docker-compose.yml up -d db

echo "Waiting for database to come up..."
sleep 10 # adjust if needed

echo "=== Setting environment variables ==="
export DATABASE_URL="postgresql://ujamaa_user:ujamaa_pass@localhost:5432/ujamaa_db"

echo "=== Generate Prisma Client ==="
npx prisma generate

echo "=== Build backend ==="
npm run build

echo "=== Starting backend server with ESM loader ==="
# Adjust this command to your config if different
node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));' dist/index.js &

BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

sleep 5 # to ensure backend is listening

echo "=== Testing user registration API with curl ==="
curl -X POST http://localhost:4000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x123abc456def7890abcdef1234567890abcdef12",
    "email": "test@example.com",
    "name": "Test User",
    "constituency": "Sample Constituency",
    "county": "Sample County",
    "industry": "Technology",
    "goodsServices": ["Service A", "Product B"]
  }' || true

echo "=== Backend logs (last 20 lines) ==="
# Tail logs for debugging
kill -0 $BACKEND_PID && kill -15 $BACKEND_PID # stop server gracefully if running
sleep 2