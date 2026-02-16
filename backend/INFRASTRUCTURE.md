# 🏗️ Ujamaa DAO - Backend Infrastructure

This repository contains the Ujamaa DAO backend with a **flexible Docker setup** that grows with your needs.

## 🚀 Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your values
nano .env

# 3. Start services
make dev
```

That's it! Your API is now running at http://localhost:4000

## 📦 What's Included

### Core Services (Always Active):
- ✅ **Traefik** - Reverse proxy + SSL termination
- ✅ **Web API** - Node.js + Express + Prisma
- ✅ **Worker** - BullMQ background jobs + event handlers
- ✅ **PostgreSQL** - Main + test databases
- ✅ **Redis** - Cache + job queues

### Observability (Enable When Needed):
- 💤 **Prometheus** - Metrics collection
- 💤 **Grafana** - Dashboards & visualization
- 💤 **Loki** - Log aggregation
- 💤 **Jaeger** - Distributed tracing
- 💤 **Envoy** - Service mesh sidecars
- 💤 **Fluent-bit** - Log forwarding

## 📁 Project Structure

```
ujamaadao-backend/
├── src/
│   ├── core/                   # Core infrastructure
│   │   ├── database/          # Prisma client
│   │   ├── events/            # Event bus
│   │   ├── jobs/              # BullMQ jobs
│   │   ├── logger/            # Winston logger
│   │   └── queue/             # Queue setup
│   ├── modules/                # Feature modules
│   │   ├── auth/
│   │   ├── user/
│   │   ├── admin/
│   │   ├── economy/
│   │   └── community/
│   ├── app.ts                 # Express app
│   ├── index.ts               # Web server entry
│   ├── worker.ts              # Worker entry
│   └── worker-events.ts       # Event listeners
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docker-compose.yml         # Main Docker config
├── docker-compose.prod.yml    # Production config
├── Dockerfile
├── .env                       # Your environment variables
├── .env.example              # Template
│
├── config-templates/          # Observability templates
│   ├── envoy/
│   ├── fluent-bit/
│   ├── prometheus/
│   ├── grafana/
│   ├── loki/
│   └── jaeger/
│
├── traefik/                   # Traefik configs
│   ├── traefik.yml           # Development
│   ├── traefik.prod.yml      # Production
│   └── acme.json             # SSL certificates
│
├── Makefile                   # Convenience commands
├── UPGRADE-GUIDE.md          # Observability upgrade path
└── README.md                 # This file
```

## 🎯 When to Enable Observability

### Use Simple Setup (Current) When:
- 👨‍💻 Actively developing features
- 🏃 Need fast iteration cycles
- 💻 Running on local machine
- 👤 Solo developer or small team
- 📊 Don't need detailed metrics yet

### Enable Observability When:
- 👥 You have 100+ real users
- 🐛 Need to debug performance issues
- 📈 Want SLAs and monitoring
- 🔍 Need detailed logs/metrics/traces
- ☸️ Preparing for Kubernetes
- 👥 Multiple developers need visibility

## 🔧 Common Commands

### Development

```bash
# Start everything (simple mode)
make dev

# View logs
make logs
make logs-web      # Just web server
make logs-worker   # Just worker

# Stop everything
make down

# Restart services
make restart

# Clean up (deletes volumes!)
make clean
```

### Database Operations

```bash
# Access database shell
make db-shell

# Run migrations
make db-migrate

# Reset database (DANGEROUS!)
make db-reset

# Create backup
make backup
```

### Observability (When Ready)

```bash
# Check what's configured
make check-configs

# Setup config templates (one-time)
make setup-configs

# Enable monitoring (Prometheus + Grafana)
make enable-monitoring

# Enable logging (Loki + Fluent-bit)
make enable-logging

# Enable tracing (Jaeger)
make enable-tracing

# Enable service mesh (Envoy sidecars)
make enable-service-mesh

# Enable everything
make enable-all

# Revert to simple mode
make disable-observability
```

## 🌐 Service URLs

### Always Available:
- **API Direct**: http://localhost:4000
- **API via Traefik**: http://localhost or http://ujamaa.localhost
- **Traefik Dashboard**: http://localhost:8080
- **PostgreSQL**: localhost:5432
- **PostgreSQL Test**: localhost:5433
- **Redis**: localhost:6379

### When Observability Enabled:
- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Loki**: http://localhost:3100
- **Jaeger UI**: http://localhost:16686
- **Envoy Admin (API)**: http://localhost:9901
- **Envoy Admin (Worker)**: http://localhost:9902

## 🔐 Environment Variables

### Required Variables

```bash
# Database
DATABASE_URL=postgresql://ujamaa_user:ujamaa_pass@postgres:5432/ujamaa_db

# Redis
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=development
PORT=4000
JWT_SECRET=your_jwt_secret_change_in_production

# Frontend
FRONTEND_URL=http://localhost:3000

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# SMS (Optional - Twilio/Africa's Talking)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Admin
DASHBOARD_PASSWORD=admin123_change_in_production
```

### Important Notes

1. **Service Names in Docker**: Use `postgres`, `redis` as hostnames (not `localhost`)
2. **JWT Secret**: Generate a strong secret for production: `openssl rand -base64 32`
3. **Database Password**: Change default password in production
4. **SMTP**: Use app-specific passwords, not your main password

## 🏗️ Architecture

### Service Mapping

| Component | Docker Service | Ports | Purpose |
|-----------|----------------|-------|---------|
| Web API | `web` | 4000 | Express API endpoints |
| Worker | `worker` | - | Background jobs + heavy events |
| PostgreSQL | `postgres` | 5432 | Main database |
| PostgreSQL Test | `postgres_test` | 5433 | Test database |
| Redis | `redis` | 6379 | Cache + BullMQ queues |
| Traefik | `traefik` | 80, 443, 8080 | Reverse proxy |

### How Components Connect

```
[User Request] 
    ↓
[Traefik :80/:443] 
    ↓
[Web Container :4000]
    ↓
    ├─→ [PostgreSQL :5432] (via Prisma)
    ├─→ [Redis :6379] (cache + publish events)
    └─→ [BullMQ Queue] (enqueue jobs)
         ↓
    [Worker Container]
         ├─→ Process jobs from queue
         ├─→ Listen to Redis pub/sub events
         └─→ Heavy event handlers (PR awards, notifications)
```

## 🛠️ Development Workflow

### Option 1: Docker (Recommended)

```bash
# Start everything with hot reload
make dev

# Watch logs in real-time
make logs

# Run database migrations
make db-migrate

# Access database
make db-shell

# Reset and restart
make restart
```

**Benefits:**
- ✅ Matches production environment
- ✅ Automatic hot reload on code changes
- ✅ All services isolated
- ✅ Easy to reset/clean

### Option 2: Local Development (No Docker)

**Terminal 1 - Web Server:**
```bash
npm run dev
```

**Terminal 2 - Worker:**
```bash
npm run worker
```

**Requirements:**
- Local PostgreSQL running on port 5432
- Local Redis running on port 6379
- Update `.env` to use `localhost` instead of service names

## 🚀 Production Deployment

### Step 1: Prepare Production Environment

```bash
# Copy production env template
cp .env.example .env.prod

# Edit with production values
nano .env.prod
```

**Critical changes:**
- Set `NODE_ENV=production`
- Strong `JWT_SECRET` (use `openssl rand -base64 32`)
- Production `DATABASE_URL`
- Production `REDIS_URL`
- Real SMTP credentials
- Change all default passwords
- Set your `DOMAIN` for Traefik SSL

### Step 2: Update Traefik for Production

Edit `traefik/traefik.prod.yml`:
```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

certificatesResolvers:
  letsencrypt:
    acme:
      email: your@email.com        # ← Change this
      storage: /acme.json
      httpChallenge:
        entryPoint: web
```

### Step 3: Deploy

```bash
# Build production images
make prod-build

# Start production stack
make prod

# Run migrations
docker-compose -f docker-compose.prod.yml exec web npx prisma migrate deploy

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### Step 4: Configure DNS

Point your domain to your server:
```
your-domain.com → A → your.server.ip.address
```

Traefik will automatically get SSL certificates!

## 🔍 Troubleshooting

### Services Won't Start

```bash
# Check status
docker-compose ps

# View specific service logs
make logs-web
make logs-worker

# Check resource usage
docker stats
```

### Database Connection Failed

```bash
# Check if postgres is running
docker-compose ps postgres

# Verify health
docker-compose exec postgres pg_isready

# Test connection
docker-compose exec web npx prisma db pull
```

### Redis Connection Failed

```bash
# Check if redis is running
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### Jobs Not Processing

```bash
# Check worker is running
docker-compose ps worker

# View worker logs
make logs-worker

# Check Redis connection from worker
docker-compose exec worker node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.ping().then(console.log).catch(console.error);
"
```

### Hot Reload Not Working

```bash
# Check volume mounts
docker-compose config | grep volumes -A 5

# Restart with rebuild
docker-compose up -d --build

# Check tsx is watching
make logs-web | grep watching
```

## 📊 Monitoring & Observability

When you're ready for advanced monitoring, see **UPGRADE-GUIDE.md** for:

- Enabling Prometheus + Grafana dashboards
- Centralized logging with Loki
- Distributed tracing with Jaeger
- Service mesh with Envoy
- Application metrics integration
- Custom alerts

**Quick start:**
```bash
make check-configs          # See what's available
make setup-configs          # One-time setup
make enable-monitoring      # Start with monitoring
```

## ✅ Pre-Deployment Checklist

### Development
- [ ] `.env` file created with all required variables
- [ ] Can start services: `make dev`
- [ ] Can access API: http://localhost:4000/health
- [ ] Database migrations run successfully
- [ ] Worker processing jobs correctly
- [ ] Can view logs: `make logs`

### Production
- [ ] `.env.prod` with production credentials
- [ ] Domain DNS configured
- [ ] SSL/HTTPS working via Traefik
- [ ] Strong JWT secret set
- [ ] All default passwords changed
- [ ] Database backups configured
- [ ] Error tracking set up (optional: Sentry)
- [ ] Load testing completed (optional)

## 🎓 Next Steps

1. ✅ Get development environment running (`make dev`)
2. 📖 Read UPGRADE-GUIDE.md for observability options
3. 🔍 Learn about your monitoring options
4. 📊 Enable monitoring when you have real users
5. 🚀 Deploy to production when ready

## 📚 Resources

- **Upgrade Guide**: `UPGRADE-GUIDE.md` - How to enable observability
- **Config Templates**: `config-templates/` - All observability configs
- **Docker Compose**: https://docs.docker.com/compose/
- **Traefik**: https://doc.traefik.io/traefik/
- **Prisma**: https://www.prisma.io/docs/
- **BullMQ**: https://docs.bullmq.io/

## 🆘 Getting Help

1. Check the troubleshooting section above
2. View service logs: `make logs`
3. Check this README and UPGRADE-GUIDE.md
4. Verify all services are up: `docker-compose ps`

---

**Ready to build!** 🎉 Start with `make dev` and grow from there.
