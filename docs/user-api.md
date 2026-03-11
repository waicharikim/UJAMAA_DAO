# User API Documentation

> **Module status:** `tested` — 35 green tests across 2 files.
> Base URL: `http://localhost:4000/api/v1/users`

---

## Overview

The User module handles profile management, industry/goods-services selection, residence and location, privacy settings, and community verification (vouching + M-Pesa payment path).

**Important:** User registration is handled by `/api/v1/auth/magic-link/send`, not this module. There is no `POST /users` endpoint.

---

## Verification Levels

| Level | Unlocks |
|---|---|
| `EMAIL_VERIFIED` | `GET /me`, `PATCH /me/profile`, `DELETE /me` |
| `PHONE_VERIFIED` | Vouching, residence change, ward members |
| `COMMUNITY_VERIFIED` | Industries, goods/services, location, privacy, accessibility |

---

## Public Reference Endpoints (no auth required)

These are needed during registration — intentionally public.

#### `GET /users/reference/counties`
List all counties.

#### `GET /users/reference/constituencies?countyId=<uuid>`
List constituencies, optionally filtered by county.

#### `GET /users/reference/wards?constituencyId=<uuid>`
List wards, optionally filtered by constituency.

#### `GET /users/reference/industries`
List all available industries.

#### `GET /users/reference/goods-services?industryId=<uuid>`
List goods/services, optionally filtered by industry.

---

## Profile

#### `GET /users/me`
Get the authenticated user's full profile.
**Auth:** `EMAIL_VERIFIED`

**Response `200`** includes geographic, economic (PR/UT/IP), verification level, industries, roles.

---

#### `PATCH /users/me/profile`
Update profile fields. Partial update — only send fields you want to change.
**Auth:** `EMAIL_VERIFIED`
**Rate limit:** 10/min global + 3/min per user

**Body (all optional):**
| Field | Type |
|---|---|
| `name` | string |
| `avatarUrl` | string (URL) |
| `privacySettings` | object |
| `accessibility` | object |

> Phone number updates use `POST /auth/phone/send-code` flow, not this endpoint.

---

#### `DELETE /users/me`
Permanently delete own account.
**Auth:** `EMAIL_VERIFIED`
**Rate limit:** 3/hr global + 1/hr per user

---

#### `GET /users/:userId`
View another user's public profile.
**Auth:** `COMMUNITY_VERIFIED`

---

## Industries & Goods/Services

#### `GET /users/me/industries`
**Auth:** `COMMUNITY_VERIFIED`

#### `POST /users/me/industries`
Select up to 3 industries (one primary).
**Auth:** `COMMUNITY_VERIFIED`
**Rate limit:** 5/min global + 2/min per user

**Body:**
```json
{
  "primaryIndustryId": "<uuid>",
  "industryIds": ["<uuid>", "<uuid>"]
}
```

---

#### `GET /users/me/goods-services`
**Auth:** `COMMUNITY_VERIFIED`

#### `POST /users/me/goods-services`
Select goods/services you can provide or request.
**Auth:** `COMMUNITY_VERIFIED`
**Rate limit:** 5/min global + 2/min per user

**Body:**
```json
{
  "canProvide": ["<goodsServiceId>"],
  "canRequest": ["<goodsServiceId>"]
}
```

---

## Residence & Location

#### `GET /users/me/residence-change-requests`
**Auth:** `COMMUNITY_VERIFIED`

#### `POST /users/me/request-residence-change`
Request a primary ward change. Cooldown: 6 months. 7-day review period.
**Auth:** `COMMUNITY_VERIFIED` + `minParticipationRights: 50`
**Rate limit:** 1/day

**Body:** `{ "newWardId": "<uuid>", "reason": "..." }`

---

#### `POST /users/me/temporary-location`
Set a temporary ward (valid up to 6 months).
**Auth:** `COMMUNITY_VERIFIED`
**Rate limit:** 10/hr global + 5/hr per user

**Body:** `{ "wardId": "<uuid>", "expiresAt": "YYYY-MM-DD" }`

#### `DELETE /users/me/temporary-location`
Clear temporary location.
**Auth:** `COMMUNITY_VERIFIED`

---

## Privacy & Accessibility

#### `GET /users/me/privacy-settings`
**Auth:** `COMMUNITY_VERIFIED`

#### `GET /users/me/accessibility`
**Auth:** `COMMUNITY_VERIFIED`

---

## Community Verification

Community verification requires 3 vouches from existing `COMMUNITY_VERIFIED` ward members, OR a payment via M-Pesa (currently stubbed to auto-succeed in dev).

#### `POST /users/verify-community/request`
Initiate community verification request.
**Auth:** `PHONE_VERIFIED`
**Rate limit:** 3 per 30 days

#### `POST /users/verify-community/vouch`
Vouch for another user. Voucher must be `COMMUNITY_VERIFIED`.
**Auth:** `COMMUNITY_VERIFIED`
**Rate limit:** 5/day

**Body:** `{ "targetUserId": "<uuid>" }`

#### `POST /users/verify-community/payment`
M-Pesa payment path for verification (alternative to 3 vouches).
**Auth:** `PHONE_VERIFIED`
**Rate limit:** 3/day

**Body:** `{ "mpesaTransactionId": "...", "amount": 500 }`

#### `GET /users/verify-community/status`
Check current verification request status.
**Auth:** `PHONE_VERIFIED`

---

## Ward Members

#### `GET /users/wards/:wardId/members`
List verified members of a ward. Used for vouching discovery.
**Auth:** `PHONE_VERIFIED`

---

## Notes

- All rate-limited write endpoints use dual limiting: global IP limit + per-user limit.
- `GET /users/me/industries` and all economy-gated endpoints require `COMMUNITY_VERIFIED` — a user at `EMAIL_VERIFIED` will get `403`.
- Profile update only accepts `name`, `avatarUrl`, `privacySettings`, `accessibility` — not `email`, `phone`, or location fields directly.
