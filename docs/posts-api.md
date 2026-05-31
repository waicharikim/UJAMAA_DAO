# Posts API Documentation

> **Module status:** `tested` — 42 green tests (service unit + route integration).
> Base URL: `http://localhost:4000/api/v1/posts`

---

## Overview

Posts are short community communications — notices, announcements, and resources — broadcast to a geographic scope. The feed uses a geo-cascade filter: a user requesting WARD-scope posts sees posts from their ward, plus all CONSTITUENCY, COUNTY, and NATIONAL posts that include their location. This is the community bulletin board layer of UjamaaDAO.

All endpoints require a valid session token.

---

## Post Types

| Type | Purpose |
|---|---|
| `NOTICE` | General community notice (default) |
| `ANNOUNCEMENT` | Official announcement from a group or leader |
| `RESOURCE` | Shared resource with an optional URL and title |

---

## Post Scopes

| Scope | Visible to |
|---|---|
| `WARD` | Members of the same ward (default) |
| `CONSTITUENCY` | Members of the same constituency + all COUNTY/NATIONAL posts |
| `COUNTY` | Members of the same county + NATIONAL posts |
| `NATIONAL` | All users on the platform |

Geo-cascade means a user requesting `WARD` posts sees: their ward's WARD posts + matching CONSTITUENCY posts + matching COUNTY posts + all NATIONAL posts. Requesting `NATIONAL` returns **only** posts explicitly scoped to NATIONAL — national content cascades *down* into local feeds, but local content never appears in the national feed. (Before session 87, NATIONAL returned every post in the database — a firehose bug; see CLAUDE.md §7.)

---

## Endpoints

### `GET /posts`

**Auth:** Bearer token (any verification level)

Fetch paginated posts for the authenticated user's geographic context. Applies the geo-cascade filter based on the user's primary ward.

**Query parameters:**
| Param | Type | Default | Notes |
|---|---|---|---|
| `scope` | `WARD` \| `CONSTITUENCY` \| `COUNTY` \| `NATIONAL` | — | Filter to a specific scope tier (optional) |
| `type` | `NOTICE` \| `ANNOUNCEMENT` \| `RESOURCE` | — | Filter by post type (optional) |
| `cursor` | ISO datetime string | — | Cursor for pagination (createdAt of last item) |
| `limit` | integer 1–30 | 20 | Items per page |
| `wardId` | UUID | — | Override: filter to a specific ward instead of the caller's wards (used by the group-wall feed) |
| `constituencyId` | UUID | — | Override: filter to a specific constituency |
| `countyId` | UUID | — | Override: filter to a specific county |

> All three location overrides must be declared in `getPostsSchema` (the Zod validator) — `validateRequest` strips any undeclared query param before it reaches the controller. When an override is supplied, the geo-cascade uses it instead of the caller's own ward/constituency/county IDs. This lets a group-wall show exactly that group's geographic feed rather than the viewer's home feed.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "type": "ANNOUNCEMENT",
        "content": "Water kiosk maintenance scheduled for Saturday 8am–12pm.",
        "scope": "WARD",
        "resourceUrl": null,
        "resourceTitle": null,
        "communityName": "Lang'ata Ward",
        "createdAt": "2026-05-28T10:00:00.000Z",
        "author": {
          "id": "uuid",
          "name": "Jane Njoroge",
          "initials": "JN"
        },
        "proposal": null
      }
    ],
    "nextCursor": "2026-05-28T09:55:00.000Z"
  }
}
```

`communityName` is resolved from the scope:
- `WARD` → ward name
- `CONSTITUENCY` → constituency name
- `COUNTY` → county name
- `NATIONAL` → "Kenya"

`proposal` is non-null when the post is linked to a governance proposal (includes `id`, `title`, `status`, `votesFor`, `votesAgainst`, `votingEndsAt`).

`nextCursor` is `null` when there are no more pages.

---

### `POST /posts`

**Auth:** Bearer token · **Verification:** `COMMUNITY_VERIFIED`

Create a new post.

**Body:**
| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string (1–500 chars) | Yes | Post body text |
| `scope` | `WARD` \| `CONSTITUENCY` \| `COUNTY` \| `NATIONAL` | No | Defaults to `WARD` |
| `type` | `NOTICE` \| `ANNOUNCEMENT` \| `RESOURCE` | No | Defaults to `NOTICE` |
| `wardId` | UUID | No | Override ward for the post (defaults to author's primary ward) |
| `proposalId` | UUID | No | Link the post to a governance proposal |
| `resourceUrl` | URL string | No | For `RESOURCE` type posts |
| `resourceTitle` | string (max 200) | No | Display title for the resource link |

**Response `201`:** Full post object (same shape as feed item above).

**Responses:**
- `201 Created` — post created
- `400 Bad Request` — validation failure (empty content, content > 500 chars, invalid URL)
- `401 Unauthorized` — missing/invalid token
- `403 Forbidden` — below `COMMUNITY_VERIFIED`

---

## Feed Geo-Cascade Logic

`buildScopeFilter()` in `post.service.ts` constructs the Prisma `WHERE` clause based on the user's ward memberships:

| Requested scope | What the filter includes |
|---|---|
| `NATIONAL` | Only `NATIONAL`-scoped posts |
| no scope + user has no ward | All posts — legacy no-filter path |
| `COUNTY` | `NATIONAL` posts + posts from the (overridden or user's) county |
| `CONSTITUENCY` | `NATIONAL` + `COUNTY` + `CONSTITUENCY` |
| `WARD` (default) | `NATIONAL` + `COUNTY` + `CONSTITUENCY` + `WARD` |

By default a user is associated with all wards they have a `GroupMember` record in — the filter uses `wardIds`, `constituencyIds`, and `countyIds` arrays derived from their memberships (primary + secondary ward). When a `wardId`/`constituencyId`/`countyId` override query param is supplied, that single ID replaces the derived array for its tier.

---

## Notes

- Posts are sorted by `createdAt` descending (newest first). Cursor pagination uses the ISO timestamp of the last item in the current page.
- `RESOURCE` posts without a `resourceUrl` are valid — the URL is optional. The `RESOURCE` type signals intent (shared link), not enforcement.
- Posts are not editable or deleteable via API — they are immutable community records. Admins can remove posts via the admin panel.
- `proposalId` linkage is informational — there is no status coupling between a post and its linked proposal.
