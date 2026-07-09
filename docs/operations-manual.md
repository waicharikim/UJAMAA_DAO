# Operations Manual — dev & prod

One place for "how do I run/deploy/operate this". Two environments:

- **Dev** — local Docker Compose on your machine (`docker/docker-compose.yml`). Commands via `make` in `backend/`.
- **Prod** — the droplet (`docker/docker-compose.prod.yml`). Commands via the `uj-*` aliases in `docker/server-aliases.sh`. Images are built by GitHub Actions and pushed to GHCR; **the droplet pulls prebuilt images, it never compiles** (the backend build wants ~3 GB heap).

> The heavy prod deploy/runbook detail lives in `docs/server-runbook.md`; the Alibaba hackathon box in `ALIBABA_DEPLOY.md`. This file is the quick command reference for both.

---

## Dev (local)

```bash
cd backend
make dev            # start the stack (web, worker, postgres, redis, frontend, mailhog)
make dev-up         # FULL local system: compose up + wait health + ngrok + sync Telegram webhook + watcher
make dev-down       # tear down (watcher + ngrok + compose down)
make dev-status     # containers + API health + ngrok URL + watcher state
make logs           # tail all services   (also: make logs-web / logs-worker)
make db-shell       # psql into dev DB     (also: db-migrate / db-push / db-studio / db-reset)
make test           # run the test suite   (also: test-watch / lint / lint-fix / format)
```

Ports: API `:4000` · frontend `:3000` · Postgres `:5432` (test `:5433`) · Redis `:6380` · MailHog UI `:8025` · Anvil `:8545`.

**Telegram webhook (dev):** ngrok's URL rotates on every reconnect, so re-point the bot whenever it changes:

```bash
make ngrok-sync     # detect current ngrok URL and register it (one-shot)
make ngrok-watch    # keep running, auto re-sync on URL change
make ngrok-sync URL=https://abc.ngrok-free.app   # feed a URL manually
```

(`make dev-up` already does this for you.)

---

## Prod (droplet)

One-time: `echo "source ~/UJAMAA_DAO/docker/server-aliases.sh" >> ~/.bashrc && source ~/.bashrc`. Then:

| Command | What it does |
|---|---|
| `uj-deploy` | Pull `:latest` GHCR images + recreate **all** services (`git pull` + `compose pull` + `up -d`) |
| `uj-deploy-web` / `uj-deploy-worker` / `uj-deploy-frontend` | Same, one service (env changes take effect here — `up -d` recreates) |
| `uj-up` / `uj-down` / `uj-restart` | Lifecycle (start / stop / restart all) |
| `uj-pull` | Pull images without restarting |
| `uj-seed` | Force-seed the DB (first deploy only — locations, roles, wards, founder) |
| `uj-make-admin <email>` | Grant `system:super_admin` to a user |
| `uj-set-webhook` | Point the Telegram bot's webhook at this box (reads `BASE_URL`+token from `.env.prod`) |
| `uj-webhook-info` | Show the bot's current Telegram webhook + pending count + last error |
| `uj-backup` | Backup the prod DB (gzip; off-box if `BACKUP_RCLONE_REMOTE` set) |
| `uj-backup-cron` | Install the daily 02:00 backup cron (one-time) |
| `uj-migrate` | `prisma migrate deploy` (also runs automatically on web boot) |
| `uj-logs` / `uj-logs-web` / `uj-logs-worker` / `uj-logs-frontend` / `uj-logs-traefik` | Tail logs |
| `uj-ps` / `uj-health` | Container status / API health |
| `uj-shell` / `uj-db` / `uj-redis` | Exec into web / psql / redis-cli |
| `uj-prune` / `uj-disk` | Docker cleanup / disk usage |

The `uj-*` deploy aliases are thin wrappers over `make prod-*` in `backend/Makefile`; run `make help` for the full list.

---

## Scheduled jobs / "crons"

There are **two kinds**, and only one needs a manual step:

**1. BullMQ repeatable jobs — automatic.** All the recurring jobs (monthly PR regen, PR inactivity decay, daily commitment penalties, dues reminders, election lifecycle, proposal tally + review-expiry, baraza demand scan, user/auth cleanups, …) are declared in `backend/src/core/jobs/register.ts` and **register themselves when the worker boots**. Deploying the worker (`uj-deploy-worker`) *is* wiring the crons — there is no separate cron to install, dev or prod. Inspect/monitor them in **Bull Board** at `/admin/queues` (basic auth: `admin` / `DASHBOARD_PASSWORD`). `register.ts` is the single source of truth for the schedule.

**2. OS-level cron — one manual install.** The only host cron is the nightly DB backup: `uj-backup-cron` (installs the daily 02:00 job; set `BACKUP_RCLONE_REMOTE` in `.env.prod` for the off-box copy).

---

## First deploy on a new box (checklist)

1. Provision (≥4 GB RAM, Ubuntu), install Docker + compose, open ports 22/80/443.
2. `git clone … && cd UJAMAA_DAO && git checkout develop`; source the aliases.
3. Point DNS A records (`ujamaadao.org`, `api.`, `www.`) at the box IP; wait for propagation.
4. `mkdir -p traefik && touch traefik/acme.json && chmod 600 traefik/acme.json`.
5. Create `docker/.env.prod` (copy `docker/.env.prod.example`, fill secrets, pick the AI provider — see below).
6. `uj-pull && uj-up` (web auto-runs `prisma migrate deploy` on boot).
7. First time only: `uj-seed` then `uj-make-admin <founder-email>`.
8. `uj-set-webhook` (point the Telegram bot here).
9. `uj-backup-cron` (nightly backups).

Verify: `uj-health` → `{"status":"ok"}`; `uj-webhook-info` shows this box's URL; message the bot; submit a proposal to confirm a deliberation runs (worker logs).

---

## AI provider switch (no code change)

The Baraza bot + deliberation engine pick their provider from `.env.prod` only (`backend/src/core/ai/qwen.ts`):

- **Alibaba DashScope (default / hackathon):** `DASHSCOPE_BASE_URL=` empty → intl endpoint; `BARAZA_AI_MODEL=qwen-plus`, `BARAZA_ANALYST_MODEL=qwen-max`. `qwen-plus` doesn't "think" → fast bot replies.
- **DigitalOcean serverless:** `DASHSCOPE_BASE_URL=https://inference.do-ai.run/v1`; models e.g. `alibaba-qwen3-32b`. Note: DO's Qwen reasoning models think by default (~14s/reply) unless `reasoning_effort:"none"` is set — DashScope avoids this.

Leave `DASHSCOPE_API_KEY` empty to disable the AI layer entirely (it null-guards → dormant). After changing the AI block: `uj-deploy-web && uj-deploy-worker`.

---

## Good to know

- **Secrets placement:** sensitive bot/chain secrets live on the `worker` service only, except `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET` (both web + worker — web validates the webhook, worker sends). See `CLAUDE.md` §5.
- **Migrations** apply automatically on web startup (`prisma migrate deploy`); `uj-migrate` is the manual escape hatch.
- **Webhook after a DNS move** (e.g. repointing to the Alibaba box): the URL is derived from `BASE_URL`, so it follows the domain — just re-run `uj-set-webhook` on the new box to re-assert the secret.
