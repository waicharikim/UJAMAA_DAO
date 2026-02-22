# Ujamaa DAO - Version A to Version B Upgrade Guide

## Overview

Your infrastructure has two versions:

- **Version A (Current)**: Simple, pragmatic setup for development and early production
- **Version B (Future)**: Full observability stack for production scale

The Makefile bridges these versions, allowing you to **incrementally upgrade** without friction.

---

## Version A (Starting Point)

**What's running:**
- Web API container (Express + Prisma)
- Worker container (BullMQ + event handlers)
- PostgreSQL
- Redis
- Traefik (reverse proxy + SSL)

**When to use:**
- ✅ Local development
- ✅ Quick iteration
- ✅ First production deploy
- ✅ < 1000 users

**Commands:**
```bash
make dev          # Start services
make logs         # View logs
make down         # Stop services
```

---

## Version B (Full Observability)

**Additional services:**

### 1. Monitoring Stack
- **Prometheus**: Metrics collection
- **Grafana**: Dashboards & visualization
- **StatsD Exporter**: Metrics aggregation

### 2. Logging Stack
- **Loki**: Log aggregation
- **Fluent-bit**: Log forwarding sidecars

### 3. Tracing
- **Jaeger**: Distributed tracing

### 4. Service Mesh
- **Envoy**: Sidecar proxies for service-to-service communication

**When to use:**
- ✅ Production with real traffic
- ✅ Need deep observability
- ✅ Multiple developers
- ✅ Scaling different services
- ✅ Preparing for Kubernetes

---

## Incremental Upgrade Path

### Step 0: Check Current Status
```bash
make check-configs
```

This shows:
- Which config directories exist
- Which services are enabled
- What's missing

### Step 1: Setup Config Templates (One-time)
```bash
make setup-configs
```

This creates directories for ALL observability services:
```
envoy/
fluent-bit/
prometheus/
grafana/
  provisioning/
  dashboards/
loki/
jaeger/
statsd/
```

**Note:** Having these directories doesn't enable services. They're just templates ready to use.

### Step 2: Enable Features Incrementally

#### Option A: Enable One Feature at a Time

**Start with monitoring** (lowest overhead):
```bash
make enable-monitoring
```
- Adds Prometheus + Grafana
- Access at `http://localhost:9090` and `http://localhost:3001`
- Low resource usage
- Immediate value: see metrics

**Then add logging**:
```bash
make enable-logging
```
- Adds Loki + Fluent-bit sidecars
- Centralized log aggregation
- View in Grafana

**Add tracing when needed**:
```bash
make enable-tracing
```
- Adds Jaeger
- Distributed request tracing
- Access at `http://localhost:16686`

**Add service mesh last** (highest complexity):
```bash
make enable-service-mesh
```
- Adds Envoy sidecars
- Service-to-service communication
- Most resource intensive

#### Option B: Enable Everything at Once
```bash
make enable-all
```
- Starts full Version B stack
- All observability features
- Higher resource usage

### Step 3: Verify Services
```bash
docker compose ps
make logs-monitoring
```

### Step 4: Revert if Needed
```bash
make disable-observability
```
- Goes back to Version A
- Stops all observability services
- Keeps your app running

---

## How It Works (Technical Details)

The Makefile uses **Docker Compose Profiles** to enable/disable services:

### `.env` file controls what's enabled:
```bash
# Version A (default)
# No COMPOSE_PROFILES set

# Enable monitoring only
COMPOSE_PROFILES=monitoring

# Enable multiple features
COMPOSE_PROFILES=monitoring,logging

# Full Version B
COMPOSE_PROFILES=monitoring,logging,tracing,service-mesh
```

### `docker-compose.yml` uses profiles:
```yaml
services:
  prometheus:
    profiles: ["monitoring"]
    # Only starts when monitoring profile is active
  
  jaeger:
    profiles: ["tracing"]
    # Only starts when tracing profile is active
```

---

## Directory Structure

```
UJAMAA_DAO/
├── docker/
│   ├── docker-compose.yml       # Main compose file (supports both versions)
│   └── docker-compose.prod.yml  # Production config
├── backend/
│   ├── Makefile                 # Bridges Version A ↔ B
│   └── .env                     # Profile configuration
│
├── config-templates/            # Templates for observability
│   ├── envoy/
│   ├── fluent-bit/
│   ├── prometheus/
│   ├── grafana/
│   ├── loki/
│   ├── jaeger/
│   └── statsd/
│
├── envoy/                       # Active configs (copied from templates)
├── fluent-bit/
├── prometheus/
├── grafana/
├── loki/
├── jaeger/
└── statsd/
```

---

## Recommended Upgrade Timeline

| Stage | When | What to Enable |
|-------|------|----------------|
| Week 1 | Development | Version A only |
| Week 2-4 | Beta testing | Version A only |
| Month 2 | First 100 users | `make enable-monitoring` |
| Month 3 | 500+ users | `make enable-logging` |
| Month 6 | 1000+ users | `make enable-tracing` |
| Year 1 | Multi-region | `make enable-service-mesh` |

---

## Resource Usage Comparison

| Version | Containers | Memory | CPU |
|---------|-----------|--------|-----|
| Version A | 5 | ~1GB | Low |
| A + Monitoring | 7 | ~1.5GB | Low-Med |
| A + Mon + Logging | 10 | ~2GB | Medium |
| Full Version B | 15+ | ~3-4GB | Medium-High |

---

## Quick Reference

```bash
# Check what's configured
make check-configs

# Setup templates (one-time)
make setup-configs

# Enable features incrementally
make enable-monitoring        # Lowest overhead
make enable-logging          # Medium overhead  
make enable-tracing          # Medium overhead
make enable-service-mesh     # Highest overhead

# Or enable everything
make enable-all

# Revert to simple version
make disable-observability

# Normal operations (work regardless of version)
make dev
make logs
make restart
make down
```

---

## Next Steps

1. **Now**: Use Version A (`make dev`)
2. **Later**: When you need metrics → `make setup-configs` then `make enable-monitoring`
3. **Much later**: Full observability → `make enable-all`

The beauty of this approach: **you decide when to add complexity**, and you can always revert.
