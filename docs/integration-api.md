# Integration (Baraza) API Documentation

> **Module status:** `partial` — full Baraza integration; no unit tests yet.
> Base URL: `http://localhost:4000/api/v1/integration`

---

## Overview

Baraza integration connects community groups to messaging platforms (Telegram, WhatsApp, Discord). Members attend Baraza sessions via bot commands, earn PR for participation, and invite links are auto-generated.

**"Baraza"** — from Swahili: a community gathering place. Baraza sessions are the platform's real-world community coordination layer.

---

## Platforms

| Platform | Integration method | Command |
|---|---|---|
| Telegram | Bot webhook | `/present` to record attendance |
| Discord | Bot webhook | `/present` to record attendance |
| WhatsApp | Inbound webhook | message pattern matching |

**Environment variables (worker service only, except Telegram webhook validation):**
- `TELEGRAM_BOT_TOKEN` — set on **both** `web` (webhook validation) and `worker` (sending messages)
- `DISCORD_BOT_TOKEN` — `worker` only
- WhatsApp uses inbound webhook pattern — no bot token required

---

## Endpoints

### Webhooks (no auth — called by platform servers)

#### `POST /integration/telegram/webhook`
Receive Telegram bot events. Validates webhook signature using `TELEGRAM_WEBHOOK_SECRET`.

#### `POST /integration/discord/webhook`
Receive Discord bot events.

#### `POST /integration/whatsapp/webhook`
Receive WhatsApp inbound messages.

---

### Baraza Groups (auth required)

#### `GET /integration/baraza-groups`

**Auth:** Bearer token (EMAIL_VERIFIED)

List all Baraza groups available to the authenticated user. Returns ALL active groups regardless of messaging platform (no platform filter — new users see everything).

**Response `200`:**
```json
{
  "success": true,
  "groups": [
    {
      "id": "uuid",
      "name": "Lang'ata Ward Baraza",
      "platform": "TELEGRAM",
      "inviteLink": "https://t.me/+abc123",
      "communityGroupId": "uuid",
      "attendanceCount": 42,
      "lastSession": "2026-05-08T18:00:00.000Z"
    }
  ]
}
```

---

#### `GET /integration/baraza-groups/all`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Admin endpoint. Returns all Baraza groups with attendance count. Used by the admin `BarazaManagement` tab.

---

#### `POST /integration/baraza-groups`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Register a new Baraza group.

**Body:**
```json
{
  "name": "Westlands Ward Baraza",
  "platform": "TELEGRAM",
  "communityGroupId": "uuid",
  "telegramChatId": "-1001234567890",
  "inviteLink": "https://t.me/+xyz"
}
```

If `inviteLink` is not provided, the bot automatically generates one via `createChatInviteLink` (Telegram Bot API).

---

#### `POST /integration/baraza-groups/:id/refresh-invite`

**Auth:** Bearer token (WARD_ADMIN or SUPER_ADMIN role)

Refresh the Telegram invite link for a Baraza group. Generates a new one via Bot API.

---

#### `POST /integration/baraza-groups/:id/sessions`

**Auth:** Bearer token (WARD_ADMIN role)

Record a Baraza session manually.

---

#### `GET /integration/baraza-groups/:id/sessions`

**Auth:** Bearer token (EMAIL_VERIFIED)

List sessions for a Baraza group.

---

### Attendance

#### `POST /integration/baraza-groups/:id/attendance`

**Auth:** Bearer token (EMAIL_VERIFIED)

Manually record attendance (fallback if bot command fails).

**Body:** `{ "sessionId": "uuid" }`

---

## `/present` Bot Flow

When a user types `/present` in a Telegram/Discord Baraza group:
1. Bot receives the command via webhook
2. `baraza-bot.service.ts` matches the user's Telegram/Discord handle to their platform account
3. A `BarazaAttendance` record is created
4. A BullMQ job (`BARAZA_ATTENDANCE_REWARD`) is enqueued
5. The worker job awards 15 PR to the user

The bot sends a confirmation message: "Attendance recorded ✓ +15 PR awarded".

---

## Frontend

- `BarazaGroupsCard` on the dashboard — shows "My Barazas" with invite links
- Admin `BarazaManagement` component — Barazas tab in admin dashboard
- `integrationApi.getBarazaGroups()` and `integrationApi.getAllBarazaGroups()` in `frontend/lib/api.ts`
