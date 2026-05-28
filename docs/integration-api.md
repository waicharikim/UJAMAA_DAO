# Integration (Baraza) API Documentation

> **Module status:** `tested` — 48 green tests across 4 files (service unit + baraza-ai + reward jobs + route integration).
> Base URL: `http://localhost:4000/api/v1/integration`

---

## Overview

Baraza integration connects community groups to messaging platforms (Telegram, WhatsApp, Discord). Members attend Baraza sessions via bot commands, earn PR for participation, and invite links are auto-generated.

**"Baraza"** — from Swahili: a community gathering place. Baraza sessions are the platform's real-world community coordination layer.

---

## Platforms

| Platform | Integration method | Command |
|---|---|---|
| Telegram | Bot webhook | `/present`, `/schedule`, `/open`, `/close`, `/verify` |
| Discord | Bot webhook | Slash commands (placeholder) |
| WhatsApp | Inbound webhook | message pattern matching |

**Environment variables:**
- `TELEGRAM_BOT_TOKEN` — set on **both** `web` (webhook validation) and `worker` (sending messages)
- `TELEGRAM_WEBHOOK_SECRET` — set on both `web` and `worker`
- `DISCORD_BOT_TOKEN` — `worker` only
- WhatsApp uses inbound webhook pattern — no bot token required

---

## Auth Model for Admin Endpoints

`POST /baraza-groups`, `POST /baraza-groups/:id/attendance`, `POST /baraza-groups/:id/deactivate`, and session management endpoints require **WARD_ADMIN or SUPER_ADMIN** role. Location admins (WARD_ADMIN) have blanket access over all groups in their area — they do **not** need to be a LEADER of the underlying community group.

Non-admin users who are group LEADERs may also manage barazas for their own groups (checked in the controller after the route-level role gate).

---

## Endpoints

### Webhooks (no auth — called by platform servers)

#### `POST /integration/telegram/webhook`
Receive Telegram bot events. Validates `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`.

Handles commands: `/present` (attendance), `/schedule YYYY-MM-DD HH:MM` (schedule next session), `/open` (open session for check-in), `/close` (close session), `/verify <code>` (link Telegram account to platform account).

#### `POST /integration/discord/webhook`
Receive Discord interaction events. Validates Ed25519 signature using `DISCORD_PUBLIC_KEY`. Responds to ping (type 1). Slash command handling is a placeholder.

---

### Baraza Groups (auth required)

#### `GET /integration/baraza-groups`

**Auth:** Bearer token (EMAIL_VERIFIED)

List all active Baraza groups for the authenticated user's community groups. Returns groups regardless of whether the user has a linked messaging profile — supports discovery so users can follow invite links before linking their platform account.

**Response `200`:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "groupId": "uuid",
      "platform": "TELEGRAM",
      "name": "Lang'ata Ward Baraza",
      "inviteLink": "https://t.me/+abc123",
      "isActive": true,
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ]
}
```

---

#### `GET /integration/baraza-groups/all`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Admin endpoint. Returns all Baraza groups with attendance count. WARD_ADMIN sees groups for groups they manage (LEADER role); SUPER_ADMIN sees all.

---

#### `POST /integration/baraza-groups`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Register a new Baraza group. WARD_ADMIN can register for any group; non-admin group LEADERs can only register for groups they lead.

If `inviteLink` is not provided for a Telegram group, the bot automatically generates one via `createChatInviteLink` (Telegram Bot API).

**Body:**
| Field | Type | Required |
|---|---|---|
| `groupId` | string (UUID) | Yes |
| `platform` | `TELEGRAM` \| `WHATSAPP` \| `DISCORD` | Yes |
| `externalId` | string (1–200 chars) | Yes — the Telegram chat ID or equivalent |
| `name` | string (1–200 chars) | Yes |
| `inviteLink` | string (URL) | No — auto-generated for Telegram |
| `metadata` | object | No |

**Responses:**
- `201 Created` — BarazaGroup object
- `400 Bad Request` — validation failure
- `403 Forbidden` — non-admin caller is not a LEADER of the target group

---

#### `POST /integration/baraza-groups/:id/deactivate`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Deactivate a Baraza group. Sets `isActive: false`. WARD_ADMIN can deactivate any group; non-admin LEADERs can only deactivate groups they lead.

**Responses:** `200 OK` · `403 Forbidden` · `404 Not Found`

---

#### `POST /integration/baraza-groups/:id/refresh-invite`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Refresh the Telegram invite link for a Baraza group. Generates a new link via `createChatInviteLink` Bot API.

**Responses:** `200 OK` · `400 Bad Request` (bot not admin of group) · `404 Not Found`

---

### Attendance

#### `POST /integration/baraza-groups/:id/attendance`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Manually record attendance for a session (fallback if bot command fails or for WhatsApp/Discord).

**Body:**
| Field | Type | Required |
|---|---|---|
| `sessionDate` | string (YYYY-MM-DD) | Yes |
| `attendeeExternalIds` | string[] (1–500 items) | Yes — platform user IDs |
| `facilitatorExternalId` | string | No |
| `reportedBy` | string (max 100) | No |

**Response `200`:** array of `AttendanceRecord` objects created or updated.

---

### Sessions

#### `GET /integration/baraza-groups/:id/sessions`

**Auth:** Bearer token (EMAIL_VERIFIED)

List sessions for a Baraza group. Returns up to 20 (configurable via `?limit=`).

---

#### `POST /integration/baraza-groups/:id/sessions/schedule`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Schedule the next Baraza session.

**Body:** `{ "scheduledAt": "<ISO datetime>" }` — must be a future timestamp.

**Response:** `201 Created` — session object.

---

#### `POST /integration/baraza-groups/:id/sessions/open`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Open the next scheduled session for member check-in. Session must be within 4 hours of its scheduled time.

---

#### `POST /integration/baraza-groups/:id/sessions/close`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Close the currently open session. Returns final attendance count.

---

## Telegram Bot Commands

| Command | Who | What |
|---|---|---|
| `/register <group-uuid>` | LEADER / WARD_ADMIN / SUPER_ADMIN | Self-registers the current Telegram chat as a Baraza for the given platform group UUID. No chat ID lookup needed — bot reads `chatId` from context. Idempotent. |
| `/present` | Any member | Marks attendance for the current open session. Awards 15 PR via BullMQ job. |
| `/schedule YYYY-MM-DD HH:MM` | Group LEADER | Schedules next session (EAT timezone). |
| `/open` | Group LEADER | Opens the scheduled session for `/present` check-ins. |
| `/close` | Group LEADER | Closes the open session. Reports attendance count to the group chat. |
| `/verify <code>` | Any Telegram user | Links Telegram account to platform account using a 6-digit code from the app. |

### `/register` flow

1. A group LEADER or admin runs `/register <uuid>` from within the Telegram group.
2. Bot verifies: caller has a linked `UserMessagingProfile` (must `/verify` first), and caller is a SUPER_ADMIN / WARD_ADMIN **or** a LEADER of the target group.
3. On success: the chat is registered as an active BarazaGroup; members can immediately use `/present`, `/schedule`, `/open`, `/close`.
4. If already registered: bot replies with an info message (idempotent — safe to run twice).

**Error cases:**
- No linked profile → "Link your account first with `/verify <code>`"
- Invalid UUID format → "Invalid group ID"
- Group UUID not found in platform → "Group not found"
- Caller not LEADER/admin of that group → "You must be a LEADER of that group or a platform admin"

---

## BullMQ Jobs

| Job | Trigger | Effect |
|---|---|---|
| `BARAZA_ATTENDANCE_REWARD` | `/present` command or manual attendance POST | Awards 15 PR to the user. Idempotent (`prAwarded` flag). |
| `BARAZA_SEND_INVITE` | New Baraza group registered | Fans out invite jobs to all group members with matching platform profiles. |
| `BARAZA_SESSION_REMINDER` | Session scheduled | Notifies group members 1 hour before scheduled session time. |

---

## Frontend

- `BarazaGroupsCard` on the dashboard — shows "My Barazas" with invite links
- Admin `BarazaManagement` component + Sessions panel — Barazas tab in admin dashboard
- `integrationApi.getBarazaGroups()` and `integrationApi.getAllBarazaGroups()` in `frontend/lib/api.ts`

---

## Notes

- `getBarazaGroupsForUser` returns ALL active baraza groups for the user's community groups — no platform filter. Users without a messaging profile can still see groups and follow invite links. This is intentional for discovery.
- `/verify` links a Telegram user ID to a `UserMessagingProfile` using a one-time 6-digit code (stored in `PhoneVerification` table, reusing the phone verification flow).
- Session management via HTTP API mirrors the bot command flow — same service methods, different auth path.
