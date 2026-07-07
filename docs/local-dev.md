# UjamaaDAO Local Dev Runbook

Dev-machine counterpart to [`server-runbook.md`](./server-runbook.md) (which covers the
production droplet). Everything here runs the local Docker Compose stack on your laptop.

**Repo path:** `~/UJAMAA_DAO/`
**Compose file:** `~/UJAMAA_DAO/docker/docker-compose.yml`
**Makefile path:** `~/UJAMAA_DAO/backend/`

---

## First-Time Setup (run once per machine)

```bash
# 1. Load the dev aliases into your shell
echo "source ~/UJAMAA_DAO/docker/dev-aliases.sh" >> ~/.bashrc   # and/or ~/.zshrc
source ~/.bashrc

# 2. Confirm they loaded
ujamaa-ps
```

The aliases live in [`docker/dev-aliases.sh`](../docker/dev-aliases.sh) (checked into the
repo, so they stay in sync across machines). Edit that file to change them — the shell rc
just sources it, mirroring how prod sources `docker/server-aliases.sh`.

---

## Aliases

| Alias | Does |
|---|---|
| `ujamaa-up` | **orchestrate the whole system** (see below) |
| `ujamaa-down` | tear the whole system down (watcher + ngrok + compose) |
| `ujamaa-status` | containers + API health + ngrok URL + watcher state |
| `ujamaa` | start the Docker stack only (detached) — same as `make dev` |
| `ujamaa-dev` | rebuild images + start in the foreground |
| `ujamaa-stop` | stop everything (`compose down`) |
| `ujamaa-restart` | restart the `web` + `worker` app processes only |
| `ujamaa-logs` | follow web (API) logs |
| `ujamaa-logs-worker` | follow worker (BullMQ) logs |
| `ujamaa-logs-frontend` | follow frontend logs |
| `ujamaa-ps` | show UjamaaDAO containers + status + ports |
| `ujamaa-health` | curl the API `/health` endpoint |
| `ujamaa-ngrok` | re-point the Telegram webhook at the current ngrok URL (auto-detect) |
| `ujamaa-ngrok-watch` | keep running; auto re-sync the webhook on every ngrok reconnect |
| `ujamaa-ngrok-info` | show what Telegram thinks the webhook URL is |
| `ujamaa-shell` | shell into the `web` container |
| `ujamaa-db` | open a `psql` shell on the dev Postgres |
| `ujamaa-redis` | open `redis-cli` |
| `ujamaa-migrate` | run Prisma migrations (`make db-migrate`) |
| `ujamaa-disk` | show host + Docker disk usage |

---

## One-command orchestration

`ujamaa-up` (alias for `make dev-up` → `backend/scripts/dev-stack.sh up`) brings up the
**whole local dev system** in the right order:

1. `docker compose up -d` — runs your **local working tree** (bind-mounted + hot reload; no
   image is pulled, this machine is the source of the code)
2. waits for `:4000/health`
3. ensures an ngrok tunnel to `:4000` (starts `ngrok http 4000` if one isn't already up)
4. syncs the Telegram webhook to the current ngrok URL
5. launches the webhook watcher in the background, so the webhook auto-re-registers on every
   ngrok URL change — fully hands-off

```bash
ujamaa-up        # bring everything up
ujamaa-status    # check what's running
ujamaa-down      # stop watcher + ngrok + compose
```

Background process bookkeeping (pids + logs) lives in `~/.cache/ujamaa-dev/`.

> **This is dev-only and one-directional.** The dev orchestrator runs the code *as it exists
> on disk here*. Prod (the droplet) is the downstream consumer: it pulls prebuilt images that
> CI built from pushed commits — it never originates or compiles code. That's why prod uses a
> separate `uj-deploy` flow, not `ujamaa-up`.

### Prod guard

Both `dev-aliases.sh` and `dev-stack.sh` refuse to load/run if they detect the prod droplet
(`167.71.55.51`), so the local dev compose can never be fired against production by mistake.
Override in an emergency with `UJAMAA_FORCE_DEV=1`.

---

## ngrok ↔ Telegram webhook

The bot's Telegram webhook must point at a public HTTPS URL. In dev that's an ngrok tunnel
to `:4000`. ngrok's free tier **rotates the URL on every reconnect**, which silently breaks
the bot until the webhook is re-registered.

```bash
# After ngrok reconnects, just run:
ujamaa-ngrok            # auto-detects the new URL from ngrok's API and re-registers

# Prefer hands-off? Leave this running in a terminal next to ngrok:
ujamaa-ngrok-watch      # polls every 5s, re-registers automatically whenever the URL changes

# Pasting a URL in manually also works:
~/UJAMAA_DAO/backend/scripts/ngrok-sync.sh https://abc123.ngrok-free.app
```

The script ([`backend/scripts/ngrok-sync.sh`](../backend/scripts/ngrok-sync.sh)) reads
`TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` from `docker/.env`, reads the live tunnel
URL from ngrok's local API (`http://localhost:4040/api/tunnels`), and calls Telegram's
`setWebhook`. It's also exposed as `make ngrok-sync` / `make ngrok-watch` from `backend/`.

> **Note:** this syncs the **Telegram** webhook only. M-Pesa (Buni) callbacks use the
> `BASE_URL` env var, which is read at container startup — changing it needs a `web` restart.

---

## Notes

- All dev work runs in Docker; use service names (`web`, `worker`, `postgres`, `redis`), not
  `localhost`, from inside containers.
- Dev ports: API `:4000`, frontend `:3000`, Postgres `:5432`, Postgres-test `:5433`,
  Redis `:6380` (host), MailHog UI `:8025`, Anvil `:8545`.
- MailHog catches all dev email at <http://localhost:8025>.
