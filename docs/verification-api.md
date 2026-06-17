# Verification API Documentation

> **Module status:** `tested` — 36 green tests (17 service unit + 19 route integration).
> Base URL: `http://localhost:4000/api/v1/verify-community`

---

## Overview

Community verification is required to access most platform features. Users progress from `EMAIL_VERIFIED` to `COMMUNITY_VERIFIED` through one of two paths:

**Path A — Vouching:** Three `COMMUNITY_VERIFIED` ward members vouch for the user. The user must be `PHONE_VERIFIED` first.

**Path B — M-Pesa payment:** If the vouching period expires (or the user prefers), they pay via M-Pesa STK push. This immediately promotes them to `COMMUNITY_VERIFIED`. This is the path that scales without dependencies — it works in any ward with no existing verified members.

**Cold-start / genesis.** Vouching requires existing `COMMUNITY_VERIFIED` members, so a brand-new platform (or a brand-new ward) would otherwise deadlock. Two mechanisms break it:

- **Genesis verifiers** (seed): every `system:super_admin` plus any account whose email is in the `FOUNDER_EMAILS` env var is auto-verified at seed time (idempotent). These are the first vouchers.
- **Accountable per-ward bootstrap:** while a ward has **fewer than 3** community-verified members, a **single vouch from an appointed location admin** (`location:ward_admin` / `constituency_admin` / `county_admin`, `system:county_coordinator`, `system:super_admin`) verifies a member. Once the ward reaches 3 verified members, the full 3-vouch rule resumes. Every bootstrap vouch is audit-logged (`COMMUNITY_VERIFIED`, `reason: "bootstrap_vouch"`). The lowered threshold is strictly gated on the unseeded-ward check — an admin who is not itself community-verified loses vouching ability once the ward seeds.

---

## Verification Level Progression

```
EMAIL_VERIFIED → PHONE_VERIFIED → COMMUNITY_VERIFIED
                                      ↑
              (3 vouches  OR  1 location-admin vouch while ward unseeded
                          OR  M-Pesa payment)
```

A nightly job (`checkVouchingTimeouts`) moves users from `VOUCHING` → `PAYMENT_PENDING` when the vouch window expires.

---

## Endpoints

All endpoints require a valid Bearer token.

### `GET /verify-community/status`

**Auth:** Bearer token (EMAIL_VERIFIED)

Get the current user's community verification status.

**Response `200`:**
```json
{
  "success": true,
  "status": "VOUCHING",
  "vouchesReceived": 1,
  "vouchesNeeded": 3,
  "requestedAt": "2026-05-01T10:00:00.000Z",
  "expiresAt": "2026-05-08T10:00:00.000Z"
}
```

**Possible status values:**
| Status | Meaning |
|---|---|
| `PENDING` | No verification request exists yet |
| `VOUCHING` | Request submitted, waiting for 3 vouches |
| `PAYMENT_PENDING` | Vouch window expired; payment required |
| `COMMUNITY_VERIFIED` | Verification complete |

---

### `POST /verify-community/request`

**Auth:** Bearer token (PHONE_VERIFIED minimum)

Submit a community verification request. Moves the user to `VOUCHING` status.

**Body:** _(no body required)_

**Response `200`:** `{ "success": true, "message": "Verification request submitted." }`

**Errors:**
- `400` — User is already verified or in an incompatible state.
- `403` — User is not yet `PHONE_VERIFIED`.

---

### `POST /verify-community/vouch`

**Auth:** Bearer token (COMMUNITY_VERIFIED)

Vouch for another user. The vouching user must be from the same primary ward.

**Body:**
```json
{ "targetUserId": "uuid" }
```

**Response `200`:** `{ "success": true, "vouchesReceived": 2, "vouchesNeeded": 3 }`

**Effect:** If `vouchesReceived` reaches 3, the target user is immediately promoted to `COMMUNITY_VERIFIED`.

**Errors:**
- `400` — Target is not in `VOUCHING` state, or vouch already given.
- `403` — Vouching user is not from the same ward.

---

### `POST /verify-community/payment`

**Auth:** Bearer token (PHONE_VERIFIED minimum)

Pay to bypass the vouching process. Only valid when status is `PAYMENT_PENDING`.

**Body:**
```json
{ "txRef": "BUNI-xxx" }
```

The `txRef` must be the reference from a **completed** (`SUCCESS`) payment via `POST /api/v1/payments/initiate`.

**Response `200`:** `{ "success": true, "newLevel": "COMMUNITY_VERIFIED" }`

**Errors:**
- `400` — Payment not found, not completed, or user is in `VOUCHING` (not yet `PAYMENT_PENDING`).
- `400` — Only `PAYMENT_PENDING` status accepts a payment — not `VOUCHING`.

---

## Background: Vouch Bootstrap

Users with `FULL_VERIFIED` status can vouch for users across ward boundaries (cross-ward vouch bootstrap). This prevents cold-start problems in wards with few verified members.
