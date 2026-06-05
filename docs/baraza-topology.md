# Baraza Topology — How Telegram Maps to the Community Hierarchy

> **Status:** design note (2026-06-05). Captures the intended structure of Baraza
> messaging surfaces and *why*, so future work builds toward a coherent whole.
> Companion to [`integration-api.md`](./integration-api.md) (the bot/API mechanics).

---

## The problem

UjamaaDAO's communities are **nested**: every member belongs to their **ward → constituency → county → national** community (plus their **origin** ward's chain, plus any **voluntary groups** — SACCO, youth org, watchdog). Users are auto-enrolled at every level (`groupMembership.service.ts → enrollInSystemGroups`).

Telegram has **no native nesting** — no sub-groups. So the hierarchy can't live *inside* Telegram. The question is how to map a nested civic structure onto Telegram's flat primitives (groups, channels, topics) without losing the quality that makes local coordination work.

## The principle

**Group quality is inversely proportional to size.** A 50-person ward chat is gold; a 50,000-person national chat is noise. So we don't push the hierarchy *into* chat groups. Instead we split by **what each surface is best at**:

> **Ward = conversation · Levels = broadcast · App = action · Bot = the glue.**

| Surface | Telegram primitive | Owned by | Purpose |
|---|---|---|---|
| **Ward Baraza** | **Group** (chat, optionally with topics) | The ward community (a leader registers it) | Real-time, local, peer coordination — "who's free Saturday to dig the borehole?" |
| **Voluntary group Baraza** | **Group** (chat) | The group's members | Interest-based chat (SACCO, youth org) — its own membership + treasury, so its own group |
| **Constituency / county / national** | **Channel** (broadcast) + optional linked discussion group | Platform (official UjamaaDAO channels) | Announcements at scale **with push reach**, zero noise; discussion opt-in |
| **The hierarchy itself** | *(none — stays in the app)* | — | The app already aggregates every level (home feed, hierarchy browser); the bot answers cross-level questions |

## Why each choice

### Ward = a chat group
The ward is the unit of action. A chat group keeps it intimate and mobile-native (Telegram is where Kenyans already are). This is the only level where free-for-all chat *raises* quality.

**Within a ward, use Telegram Topics** (forum mode) to organize the one group instead of a firehose — e.g. `#announcements · #projects · #marketplace · #general · #emergencies`. Topics organize *conversation*, not *membership* (everyone in the group sees all topics), so they're a within-ward quality upgrade, **not** a nesting mechanism. Forum mode is admin-enabled and historically gated behind a member threshold — so it's a "growing ward" upgrade, not day-one.

### Upper levels = channels, not chat groups
A chat group at constituency/county/national would be a noisy mega-group. A **channel** is broadcast — it scales to unlimited subscribers *calmly*, and adds the one thing the in-app feed can't: **native push notifications / reach.** A county channel pushes "voting opens tomorrow" to phones even when the app is closed. A **linked discussion group** makes commenting opt-in for those who want it.

### The hierarchy stays in the app
The app already carries every level (national home feed, the `/groups` hierarchy browser). Telegram's value is local chat + push, not replicating the app. The **bot bridges levels**: from their ward group, a member asks "any open proposals above us?" and the bot answers via its tools — so you climb the hierarchy without mega-groups.

### Voluntary groups stay separate groups
A SACCO needs its own membership, treasury, and governance — so it's its own community `Group` with its own Baraza, **not** a topic inside the ward. Topics can't carry separate membership/permissions.

## The bot's role (the glue)

- **AI replies** in the ward group (free-text → `baraza-ai.service.ts`, 6 community tools) — answers questions, including cross-level ones.
- **Attendance** (`/present`) → PR rewards.
- **(Future) Cross-posts** governance/treasury/project updates to the right-level **channel** (the bot as channel admin), and routes posts to the right **topic** in a ward group via `message_thread_id`.
- **(Future) Auto-provisions** a standard topic set on ward-Baraza registration (`createForumTopic`) so every ward across Kenya has the same clean layout.

## Provisioning & ownership

- **Ward Baraza** — community-led. A ward **leader/admin** creates the Telegram group, adds the bot, and runs `/register <ward-group-id>` (the in-app ward card provides a copyable, pre-filled command). **One canonical Baraza per community group + platform is enforced** (`registerBarazaGroup`): re-registering the same group is idempotent; a *different* group while one is active is rejected — no rival ward chats.
- **Level channels** — platform-led (official UjamaaDAO channels), bot as admin. Not a per-leader flow. *(Not built yet.)*

## What exists today vs. what's next

**Built**
- `BarazaGroup` model links a Telegram/Discord chat to a community `Group` (one `groupId`).
- `/register` (leader/admin-gated), `/present` attendance + PR, auto-generated invite links.
- AI bot replies (dormant until `CLAUDE_API_KEY` set — see `project_ai_provider.md`).
- In-app **ward Baraza card** (community page, ward level): Join CTA, or a leader create-guide when none exists.
- **One-canonical-per-ward** dedup guard.

**Next (post-launch, non-gating)**
1. **Level channels** — register channels for constituency/county/national; bot cross-posts announcements by level. Likely add a `type` flag (GROUP vs CHANNEL) so the UI shows "Join" vs "Subscribe".
2. **Topic routing** — bot auto-creates a standard topic set per ward and posts by topic.
3. **Replace/deactivate flow** — UI for retiring a ward's Baraza so a new group can take over (API `deactivate` exists).
4. **Bot @handle in the create-guide** — surface `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` so leaders don't hunt for the bot.

## Non-goals / trade-offs

- **No literal nesting on Telegram** — topics ≠ sub-groups (no separate membership); faking geographic nesting with one big topic'd group just recreates the mega-group noise.
- **Channel vs app-feed divergence** — keep a clear division: channel = headline + link (push), app = full detail + action button. Don't maintain two sources of truth.
- This is **distribution architecture, not launch-critical** — ward groups + the bot prove the model for June 25; channels/topics scale reach afterward.
