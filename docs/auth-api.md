# Auth API Documentation

> **Module status:** `partial` — auth routes mounted at `/api/v1/auth` in `app.ts`.
> Tests not yet written. Most complete module in the codebase.

## Overview

The Auth module handles phone/email OTP-based authentication, JWT session management,
brute force detection, and 2FA. It does not use password-based auth.

Base URL: `http://localhost:4000/api/v1/auth`

---

## Authentication Flow

```
1. User requests OTP → POST /api/v1/auth/send-otp
2. User submits OTP  → POST /api/v1/auth/verify-otp  → returns JWT
3. Client sends JWT  → Authorization: Bearer <token>
4. Token refresh     → POST /api/v1/auth/refresh
5. Logout            → POST /api/v1/auth/logout
```

---

## Key Endpoints

> Full endpoint documentation is pending. The auth service at
> `backend/src/modules/auth/services/auth.service.ts` is the source of truth.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/send-otp` | None | Send OTP to email or phone |
| POST | `/api/v1/auth/verify-otp` | None | Verify OTP, returns JWT |
| POST | `/api/v1/auth/refresh` | Bearer JWT | Refresh access token |
| POST | `/api/v1/auth/logout` | Bearer JWT | Invalidate session |
| GET | `/api/v1/auth/security-events` | Bearer JWT | View own security events |
| GET | `/api/v1/auth/security-events/unresolved` | Admin | View all unresolved events |
| PATCH | `/api/v1/auth/security-events/:id/resolve` | Admin | Resolve security event |

---

## Security Notes

- OTP is rate-limited and expires after a short window
- Brute force detection: repeated failures trigger lockout (see `detectBruteForce` in auth service)
- JWT tokens are short-lived; refresh tokens used for session continuity
- All failed auth attempts logged as `SecurityEvent` for admin review
- `ENCRYPTION_KEY` (64-char hex) required in `.env` for token encryption

---

*This document is a stub. Full endpoint documentation will be added when auth reaches `production-ready` status.*
