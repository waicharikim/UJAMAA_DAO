# Auth API Documentation

> **Module status:** `tested` — 104 green tests across 11 files.
> Base URL: `http://localhost:4000/api/v1/auth`

---

## Authentication Flows

### New user (first-time registration)

```
POST /auth/magic-link/send   { email, name, phoneNumber, primaryWardId, ... }
  → creates user, sends verification email

GET  /auth/verify-email?token=<hex>
  → returns { sessionToken, user, session, needsProfileCompletion }

Use sessionToken as Bearer token immediately.
```

### Existing user (returning login)

```
POST /auth/magic-link/send   { email }
  → sends JWT magic link to email

GET  /auth/login?token=<jwt>
  → returns { sessionToken, user }

Use sessionToken as Bearer token.
```

> **Token lifetime:** 7 days. No short-lived/refresh rotation (ADR-022).
> **Token field name:** always `sessionToken` — never `accessToken`.

---

## Rate Limits

| Endpoint | Limit |
|---|---|
| `POST /magic-link/send` | 5 requests per 5 minutes (per IP) |
| `POST /wallet/nonce` | 10 per 5 minutes |
| `POST /wallet/verify` | 10 per 5 minutes |
| `POST /password/request-reset` | 3 per 15 minutes |
| `POST /password/reset` | strict global limit |
| `POST /refresh` | 20 per 5 minutes |
| Write endpoints (wallet link, 2FA) | 5 global + 2 per-user per minute |
| `POST /phone/send-code` | 3 per minute |

---

## Verification Levels Required

Most protected routes require `COMMUNITY_VERIFIED`. 2FA and wallet routes require `FULL_VERIFIED`.
See `PATCH /users/me/profile` for routes available at `EMAIL_VERIFIED`.

---

## Bearer Token Requirements

Every request with a `Bearer` token passes through `auth.middleware.ts`, which does **three** checks beyond JWT signature and expiry:

1. **JTI blacklist** — token revoked via `DELETE /auth/sessions/:id` → 401
2. **Session liveness** — `Session` row must exist and not be revoked in DB → 401
3. **Account status** — `User` row must exist and have `status = ACTIVE` → 401 (suspended or deleted accounts are rejected even with a valid JWT)

Consequence: a valid JWT for a suspended or deleted account will return `401 Unauthorized`. Tokens do not outlive account status. This is intentional.

---

## Endpoints

### Public (no auth required)

#### `POST /auth/magic-link/send`
Send magic link. New users include full profile fields; returning users send email only.

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | Yes | |
| `name` | string | No | Required for new users |
| `phoneNumber` | string | No | E.164 format |
| `primaryWardId` | string (UUID) | No | Required for new users |
| `secondaryWardId` | string (UUID) | No | |
| `industryIds` | string[] | No | |
| `goodsServiceIds` | string[] | No | |

**Responses:** `200 OK` · `429 Too Many Requests`

---

#### `GET /auth/verify-email?token=<hex>`
Verify email token (new users). Token is a hex string from the verification email.

**Response `200`:**
```json
{
  "sessionToken": "...",
  "user": { ... },
  "session": { ... },
  "needsProfileCompletion": true
}
```

---

#### `GET /auth/login?token=<jwt>`
Verify magic link token (existing users). Token is a JWT (3 dot-separated parts).

**Response `200`:**
```json
{ "sessionToken": "...", "user": { ... } }
```

---

#### `POST /auth/wallet/nonce`
Generate nonce for wallet signature challenge.

**Body:** `{ "walletAddress": "0x..." }`

---

#### `POST /auth/wallet/verify`
Verify wallet signature, returns session token.

**Body:** `{ "walletAddress": "0x...", "signature": "0x..." }`

---

#### `POST /auth/password/request-reset`
Send password reset email. Rate limited to 3 per 15 min.

**Body:** `{ "email": "..." }`

---

#### `GET /auth/password/verify-token?token=<jwt>`
Validate a password reset token before showing the reset form.

---

#### `POST /auth/password/reset`
Complete password reset.

**Body:** `{ "token": "...", "newPassword": "..." }`

---

#### `POST /auth/refresh`
Refresh session using a refresh token (in request body — no Bearer header).

**Body:** `{ "refreshToken": "..." }`

---

### Protected — `COMMUNITY_VERIFIED`

#### `POST /auth/logout`
Invalidate current session.

#### `GET /auth/sessions`
List all active sessions for the authenticated user.

#### `DELETE /auth/sessions/:sessionId`
Revoke a specific session.

#### `DELETE /auth/sessions`
Revoke all sessions.

#### `PATCH /auth/sessions/:sessionId/rename`
**Body:** `{ "deviceName": "..." }`

#### `POST /auth/sessions/:sessionId/trust`
Mark a device as trusted.

#### `DELETE /auth/sessions/:sessionId/trust`
Remove trusted status from a device.

#### `GET /auth/sessions/suspicious`
Get sessions flagged as suspicious.

#### `POST /auth/revoke-refresh-tokens`
Revoke all refresh tokens for the current user.

#### `GET /auth/security-events`
Get the current user's own security event log.

#### `POST /auth/phone/send-code`
Send phone OTP. Rate limited to 3 per minute.
**Body:** `{ "phoneNumber": "...", "channel": "sms" | "whatsapp" | "telegram" }` (`channel` defaults to `"sms"`)

#### `POST /auth/phone/verify-code`
Verify phone OTP.
**Body:** `{ "phoneNumber": "...", "code": "..." }`

---

### WebAuthn / Passkeys — `EMAIL_VERIFIED`

> Passkeys let users authenticate with Face ID, Touch ID, or a hardware key — no email required after the first setup.

#### `POST /auth/passkeys/register/options`
Begin passkey registration. Returns a WebAuthn challenge object to pass to the browser's `navigator.credentials.create()`.

**No body required.** Requires a valid session token.

---

#### `POST /auth/passkeys/register/verify`
Complete passkey registration. Send the credential returned by `navigator.credentials.create()`.

**Body:** `{ "credential": { ... } }` (WebAuthn `PublicKeyCredential` JSON)

**Response `200`:** `{ "success": true, "passkey": { "id": "...", "name": "..." } }`

---

#### `POST /auth/passkeys/login/options`
Begin passkey login. Returns a challenge for `navigator.credentials.get()`.

**Body:** `{ "email": "..." }` (optional — narrows challenge to a specific user)

**No auth required.**

---

#### `POST /auth/passkeys/login/verify`
Complete passkey login. Send the assertion returned by `navigator.credentials.get()`.

**Body:** `{ "credential": { ... } }` (WebAuthn `PublicKeyCredential` JSON)

**Response `200`:** `{ "sessionToken": "...", "user": { ... } }`

**No auth required.**

---

#### `GET /auth/passkeys`
List all registered passkeys for the authenticated user.

**Response `200`:** `{ "passkeys": [{ "id": "...", "name": "...", "createdAt": "..." }] }`

---

#### `DELETE /auth/passkeys/:id`
Delete a registered passkey.

**Notes:**
- Passkey challenges are stored in `WebAuthnChallenge` DB table with a 5-minute TTL.
- Challenge key is `userId` for authenticated users or `email` for login flow.
- Front-end components: `PasskeyLoginButton` (on auth/callback page), `PasskeyManager` (profile Settings tab).

---

### Protected — `FULL_VERIFIED`

#### `POST /auth/wallet/link`
Link a wallet to the current account. Requires COMMUNITY_VERIFIED + dual rate limit.
**Body:** `{ "walletAddress": "0x...", "signature": "0x..." }`

#### `DELETE /auth/wallet/disconnect`
Unlink wallet. Requires wallet-based auth (`requiresWalletAuth: true`).

#### `POST /auth/2fa/enable`
Begin TOTP 2FA setup. Returns QR code URI.

#### `POST /auth/2fa/verify`
Verify TOTP code and activate 2FA.
**Body:** `{ "code": "..." }`

#### `POST /auth/2fa/disable`
Disable 2FA. Requires current TOTP code.
**Body:** `{ "code": "..." }`

#### `POST /auth/2fa/regenerate-backup-codes`
Regenerate 2FA backup codes.
**Body:** `{ "code": "..." }`

#### `GET /auth/2fa/status`
Get current 2FA status.

#### `GET /auth/security-events/unresolved`
Admin only. List all unresolved security events platform-wide.

#### `PATCH /auth/security-events/:eventId/resolve`
Admin only. Resolve a security event.
**Body:** `{ "resolution": "..." }`

---

## Security Notes

- Magic link rate limit: 5 requests per 5 minutes — returns `429` if exceeded.
- Brute force detection: repeated failures trigger lockout (`detectBruteForce` in auth service).
- All failed auth attempts logged as `SecurityEvent` for admin review.
- `ENCRYPTION_KEY` (64-char hex) required in env for TOTP/2FA and encrypted fields.
- Bull Board dashboard at `/admin/queues` (HTTP basic auth: login `admin`, password `DASHBOARD_PASSWORD` env var).
- `X-Correlation-ID` header is generated per request and exposed in response headers for tracing.
- Sensitive integration secrets (`MINTER_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`) are on the **worker** service only — never on `web`.
