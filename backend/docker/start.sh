#!/usr/bin/env sh
# ../backend/docker/start.sh
# Wait for Postgres, run migrations (non-fatal in dev), then start the app.

set -e

DB_HOST="postgres"
DB_PORT="5432"
WAIT_TIMEOUT="${WAIT_TIMEOUT:-60}"

# If the scripts are not executable for some reason, try to set bit
chmod +x ./docker/postgrescheck.sh || true

echo "Waiting for Postgres (${DB_HOST}:${DB_PORT})..."
./docker/postgrescheck.sh "$DB_HOST" "$DB_PORT" "$WAIT_TIMEOUT"

# Run Prisma migrations. In development, we continue startup even if migrations fail,
# to avoid the whole container being blocked by small migration issues.
echo "Running Prisma migrations (deploy) ..."
if npx prisma migrate deploy --schema ./prisma/schema.prisma; then
  echo "Prisma migrations applied successfully."
else
  echo "Prisma migrate deploy failed. Continuing startup (development mode)."
  echo "If you want to fail hard on migration errors, edit docker/start.sh to exit on failure."
fi

# Start the app. Use exec to keep PID 1 correct.
echo "Starting application..."
exec npx tsx watch src/index.ts