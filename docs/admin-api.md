# Admin API Documentation

> **Module status:** `tested` — admin routes at `/api/v1/admin` (24 tests).
> Role assignment, report generation (users/governance/economy, JSON + CSV), audit log wired.

## Overview

The Admin module provides privileged platform management endpoints. All routes require
a valid JWT and an admin-level role (enforced by RBAC middleware).

Base URL: `http://localhost:4000/api/v1/admin`

---

## Access Control

All admin endpoints require:
1. Valid Bearer JWT token
2. Admin role assigned via RBAC (`backend/src/core/rbac/`)

Non-admin requests return `403 Forbidden`.

---

## Key Endpoint Areas

> Full endpoint documentation is pending. The admin service at
> `backend/src/modules/admin/` is the source of truth.

| Area | Path Prefix | Description |
|------|-------------|-------------|
| Users | `/api/v1/admin/users` | View, manage, suspend users |
| Groups | `/api/v1/admin/groups` | Manage groups and memberships |
| Economy | `/api/v1/admin/economy` | Manual token/point adjustments |
| Security | `/api/v1/admin/security-events` | Review and resolve security events |

---

## Bull Board (Queue Dashboard)

A visual queue monitoring dashboard is available at:

```
http://localhost:8080/admin/queues
```

Protected by HTTP Basic Auth. Configure via `DASHBOARD_PASSWORD` env var.

---

*This document is a stub. Full endpoint documentation will be added when admin reaches `production-ready` status.*
