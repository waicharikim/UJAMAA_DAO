# Marketplace API Documentation

> **Module status:** `tested` — 35 green tests (16 service unit + 19 route integration).
> Base URL: `http://localhost:4000/api/v1/marketplace`
>
> **Rule 1 reminder:** Marketplace is discovery-only. No payments, no escrow, no checkout. It finds people. That is it.

---

## Overview

Ward members post skill offers and goods requests. Others browse and filter by category. All contact and negotiation happen off-platform.

`COMMUNITY_VERIFIED` is required to create or deactivate a listing (ADR-030). Browsing is available at `EMAIL_VERIFIED`.

---

## Endpoints

### `GET /marketplace`

**Auth:** Bearer token (EMAIL_VERIFIED)

Browse all active listings. Supports filtering and pagination.

**Query params:**
| Param | Type | Notes |
|---|---|---|
| `type` | `OFFERING` \| `SEEKING` | Filter by listing type |
| `category` | string | Filter by category |
| `wardId` | string (UUID) | Filter by ward |
| `search` | string | Text search on title + description |
| `limit` | number | Default 20 |
| `cursor` | string | Pagination cursor (listing ID) |

**Response `200`:**
```json
{
  "success": true,
  "listings": [
    {
      "id": "uuid",
      "title": "Plumbing repair services",
      "description": "Fixing leaks, installing fixtures. 10+ years experience.",
      "type": "OFFERING",
      "category": "SERVICES",
      "priceKes": 1500,
      "userId": "uuid",
      "userName": "John Kamau",
      "wardName": "Westlands",
      "active": true,
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ],
  "nextCursor": "uuid"
}
```

---

### `GET /marketplace/my-listings`

**Auth:** Bearer token (EMAIL_VERIFIED)

List all listings (active and inactive) for the authenticated user.

**Response `200`:** Same shape as `GET /marketplace`, no cursor.

---

### `GET /marketplace/:listingId`

**Auth:** Bearer token (EMAIL_VERIFIED)

Get a single listing by ID.

---

### `POST /marketplace`

**Auth:** Bearer token (COMMUNITY_VERIFIED required — ADR-030)

Create a new listing.

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | Yes | Max 200 chars |
| `description` | string | Yes | |
| `type` | `OFFERING` \| `SEEKING` | Yes | |
| `category` | string | Yes | |
| `priceKes` | number | No | Optional — leave blank for negotiable |
| `tags` | string[] | No | |

**Response `201`:** `{ "success": true, "listing": { ... } }`

---

### `PATCH /marketplace/:listingId`

**Auth:** Bearer token (COMMUNITY_VERIFIED, listing owner)

Update a listing.

**Body:** Same fields as POST, all optional.

---

### `DELETE /marketplace/:listingId`

**Auth:** Bearer token (COMMUNITY_VERIFIED, listing owner)

Deactivate a listing (soft delete — sets `active: false`).

**Response `200`:** `{ "success": true }`

---

## Frontend

The marketplace page at `/marketplace` has:
- Listings browse with type filter tabs
- "My Listings" tab showing the user's own listings
- Create listing modal
- COMMUNITY_VERIFIED gate banner (shown to lower-verified users)

No payment or contact flow exists in-app — per Rule 1.
