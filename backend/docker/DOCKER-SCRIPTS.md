# Docker Startup Scripts

## Overview

These scripts handle container initialization for both development and production environments.

## Script Organization

```
docker/
├── postgrescheck.sh        # Health check for PostgreSQL
├── redischeck.sh           # Health check for Redis
├── start-web.sh            # Development: Web server
├── start-worker.sh         # Development: Worker process
├── start-web.prod.sh       # Production: Web server
└── start-worker.prod.sh    # Production: Worker process
```

## Scripts Explained

### Health Check Scripts

#### `postgrescheck.sh`
Waits for PostgreSQL to be ready before proceeding.

**Usage:**
```bash
./docker/postgrescheck.sh <host> <port> <timeout>
# Example: ./docker/postgrescheck.sh postgres 5432 60
```

#### `redischeck.sh`
Waits for Redis to be ready before proceeding.

**Usage:**
```bash
./docker/redischeck.sh <host> <port> <timeout>
# Example: ./docker/redischeck.sh redis 6379 60
```

### Development Scripts

#### `start-web.sh`
**Purpose:** Start the web server in development mode

**What it does:**
1. ✅ Waits for PostgreSQL
2. 🔄 Merges Prisma schemas
3. ✅ Validates schema
4. 🔄 Generates Prisma client
5. 🚀 Runs migrations (dev mode)
6. 🚀 Starts web server with hot reload (`tsx watch src/index.ts`)

**Used by:** `web` container in `docker-compose.yml`

#### `start-worker.sh`
**Purpose:** Start the worker in development mode

**What it does:**
1. ✅ Waits for PostgreSQL
2. ✅ Waits for Redis
3. 🔄 Merges Prisma schemas
4. ✅ Validates schema
5. 🔄 Generates Prisma client
6. ℹ️  Skips migrations (web handles this)
7. 🚀 Starts worker with hot reload (`tsx watch src/workers.ts`)

**Used by:** `worker` container in `docker-compose.yml`

### Production Scripts

#### `start-web.prod.sh`
**Purpose:** Start the web server in production mode

**What it does:**
1. ✅ Waits for PostgreSQL
2. 🔄 Merges Prisma schemas
3. ✅ Validates schema
4. 🔄 Generates Prisma client
5. 🚀 Deploys migrations (production mode)
6. 🚀 Starts built web server (`node dist/index.js`)

**Used by:** `web` container in `docker-compose.prod.yml`

#### `start-worker.prod.sh`
**Purpose:** Start the worker in production mode

**What it does:**
1. ✅ Waits for PostgreSQL
2. ✅ Waits for Redis
3. 🔄 Merges Prisma schemas
4. ✅ Validates schema
5. 🔄 Generates Prisma client
6. ℹ️  Skips migrations (web handles this)
7. 🚀 Starts built worker (`node dist/workers.js`)

**Used by:** `worker` container in `docker-compose.prod.yml`

## Key Differences

### Web vs Worker

| Aspect | Web Container | Worker Container |
|--------|---------------|------------------|
| **Runs Migrations** | ✅ Yes | ❌ No (waits for web) |
| **Waits for PostgreSQL** | ✅ Yes | ✅ Yes |
| **Waits for Redis** | ❌ No (optional) | ✅ Yes (required) |
| **Entry Point** | `src/index.ts` | `src/workers.ts` |
| **Port Exposed** | 4000 | None |

### Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **Migrations** | `migrate dev` | `migrate deploy` |
| **Runtime** | `tsx watch` (hot reload) | `node dist/` (compiled) |
| **Error Handling** | Continues on error | Fails fast |
| **Build Step** | No pre-build | Requires `npm run build` |

## Migration Strategy

### Why Only Web Runs Migrations?

To avoid **race conditions** and **duplicate migration attempts**:

1. **Web container** runs migrations first
2. **Worker container** waits for PostgreSQL (implicitly waits for migrations)
3. Both containers generate their own Prisma client

This ensures:
- ✅ Migrations run exactly once
- ✅ No conflicts between containers
- ✅ Worker starts with migrated database

### Development vs Production Migrations

**Development (`migrate dev`):**
- Creates new migrations if schema changed
- Applies pending migrations
- Regenerates Prisma client
- Seeds database (if configured)

**Production (`migrate deploy`):**
- Only applies existing migrations
- Never creates new migrations
- Fails if schema changes detected
- No seeding

## Making Scripts Executable

After creating these scripts, make them executable:

```bash
chmod +x docker/postgrescheck.sh
chmod +x docker/redischeck.sh
chmod +x docker/start-web.sh
chmod +x docker/start-worker.sh
chmod +x docker/start-web.prod.sh
chmod +x docker/start-worker.prod.sh
```

Or all at once:

```bash
chmod +x docker/*.sh
```

## Docker Compose Integration

### Development (`docker-compose.yml`)

```yaml
services:
  web:
    command: ["./docker/start-web.sh"]
    depends_on:
      - postgres
  
  worker:
    command: ["./docker/start-worker.sh"]
    depends_on:
      - postgres
      - redis
      - web  # Ensures web starts first (runs migrations)
```

### Production (`docker-compose.prod.yml`)

```yaml
services:
  web:
    command: ["./docker/start-web.prod.sh"]
    depends_on:
      - postgres
  
  worker:
    command: ["./docker/start-worker.prod.sh"]
    depends_on:
      - postgres
      - redis
      - web  # Ensures web starts first (runs migrations)
```

## Troubleshooting

### PostgreSQL Not Ready
```bash
❌ ERROR: PostgreSQL at postgres:5432 not ready after 60s
```

**Solutions:**
- Check PostgreSQL container is running: `docker compose ps postgres`
- Check PostgreSQL logs: `docker compose logs postgres`
- Increase timeout: Set `WAIT_TIMEOUT=120` in environment

### Redis Not Ready
```bash
❌ ERROR: Redis at redis:6379 not ready after 60s
```

**Solutions:**
- Check Redis container is running: `docker compose ps redis`
- Check Redis logs: `docker compose logs redis`
- Increase timeout: Set `WAIT_TIMEOUT=120` in environment

### Prisma Client Generation Failed
```bash
❌ ERROR: Prisma client generation failed — directory not found!
```

**Solutions:**
- Check schema is valid: `npx prisma validate`
- Ensure `node_modules` is mounted correctly
- Check disk space: `df -h`
- Try rebuilding: `docker compose build --no-cache`

### Migration Errors

**Development:**
```bash
⚠️ Migration issues in dev — continuing...
```
This is a warning. The script continues. Check logs to see if it's critical.

**Production:**
```bash
Error: Migration failed
```
This stops the container. Fix migrations before deploying.

### Hot Reload Not Working

**Symptoms:** Code changes don't reflect in container

**Solutions:**
- Check volume mounts in docker-compose.yml
- Ensure `tsx watch` is running (check logs)
- Try restarting container: `docker compose restart web`

## Environment Variables

### Optional Configuration

```bash
# Increase wait timeout (default: 60s)
WAIT_TIMEOUT=120

# Redis connection (defaults shown)
REDIS_HOST=redis
REDIS_PORT=6379

# Database connection (defaults shown)
DB_HOST=postgres
DB_PORT=5432
```

## Testing Scripts Locally

You can test scripts outside Docker:

```bash
# Test PostgreSQL check
./docker/postgrescheck.sh localhost 5432 10

# Test Redis check
./docker/redischeck.sh localhost 6379 10

# Test full web startup (requires services running)
./docker/start-web.sh

# Test full worker startup (requires services running)
./docker/start-worker.sh
```

## Best Practices

1. **Always wait for dependencies** - Use health checks before starting
2. **Generate Prisma client in container** - Don't rely on host-generated client
3. **One migration runner** - Only web container runs migrations
4. **Fail fast in production** - Don't continue on errors
5. **Validate before generate** - Catch schema issues early
6. **Log everything** - Makes debugging easier

## Migration from Old Script

If you have the old `docker/start.sh`:

**Old script (single container):**
```bash
./docker/start.sh  # Runs migrations + starts server
```

**New scripts (web + worker):**
```bash
./docker/start-web.sh     # Runs migrations + starts web server
./docker/start-worker.sh  # Starts worker (no migrations)
```

**What changed:**
- ✅ Added Redis health check for worker
- ✅ Split web and worker entry points
- ✅ Added production variants
- ✅ Worker skips migrations
- ✅ Better error messages

## Next Steps

1. Create the scripts in your `docker/` directory
2. Make them executable: `chmod +x docker/*.sh`
3. Update docker-compose.yml to use new scripts
4. Test: `make dev`
5. Verify both web and worker start correctly

---

**Questions?** Check the troubleshooting section or examine container logs with `make logs`.
