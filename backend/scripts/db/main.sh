#!/bin/bash
export DATABASE_URL="postgresql://ujamaa_user:ujamaa_pass@postgres:5432/ujamaa_db" npx prisma db push
echo "🟢 SWITCHED TO MAIN DB"