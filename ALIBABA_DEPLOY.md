# Deploy UjamaaDAO to Alibaba Cloud (hackathon submission)

> **Updated 2026-07-12 for session 109** — added the `text-embedding-v3` pre-flight,
> the 4 new migrations note (incl. the `MEMBER` enum caveat), and §8b "Activate the
> AI layer" (historian seed + RAG knowledge index, run as compiled `dist/` scripts).
> GHCR `:latest` images already include all session-109 code (CI built them green
> from tip `672bc32`). Original base verified 2026-07-08:
> **Verified accurate 2026-07-08** against the live repo. Checked: `develop` is
> the correct branch (13 commits *ahead* of `feat/baraza-deliberation`, contains
> all Baraza + Qwen work; CI built `ujamaa-web`/`ujamaa-worker` `:latest` green
> from tip `62c4557` today); the AI env block matches `docker-compose.prod.yml`
> exactly (web + worker); Traefik host-rules are domain-tied so the DNS-repoint
> needs no rebuild; empty `DASHSCOPE_BASE_URL` → DashScope intl endpoint is
> confirmed in `core/ai/qwen.ts` (uses `||`, not `??`); seed path
> `dist/core/database/seed.js` + `uj-make-admin` alias + `traefik.prod.yml`
> (real ACME email) + GHCR frontend `:latest` all present.

Goal: run the **exact same dockerized stack** as the DO droplet on an Alibaba
Cloud ECS instance, using **DashScope Qwen** for inference. Same GHCR images,
same `docker-compose.prod.yml`, only the env and the box change.

---

## Pre-flight — smoke-test the DashScope key BEFORE you touch the box

The AI layer **fails open**: with a bad/region-wrong key or a model your account
can't access, the app boots fine and simply runs with **no AI** (dormant, no loud
error). For a hackathon that's the worst outcome — a demo with a dead council.
Catch it in 5 seconds the moment you have the key:

```bash
export DASHSCOPE_API_KEY=<your DashScope key>
for M in qwen-plus qwen-max; do
  echo "== $M =="
  curl -s https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions \
    -H "Authorization: Bearer $DASHSCOPE_API_KEY" -H "Content-Type: application/json" \
    -d "{\"model\":\"$M\",\"messages\":[{\"role\":\"user\",\"content\":\"reply with the single word READY\"}],\"max_tokens\":10}"
  echo
done
```
- Both must return JSON with `choices[0].message.content` ≈ `READY`.
- `401`/`invalid_api_key` → wrong key. `model_not_found` / access error → that
  model isn't enabled on your DashScope account (enable it in the console).
- Use the **intl** endpoint above (matches `qwen.ts`'s default). The mainland
  endpoint is `https://dashscope.aliyuncs.com/compatible-mode/v1`.

Both models must pass: `qwen-plus` runs the agents + Q&A bot, `qwen-max` runs the
analysts (Shahidi/Mpelelezi) + JSON scoring.

**NEW (session 109) — also smoke-test the embedding model.** The shared knowledge
layer (RAG: `search_knowledge` for the council + Buda) needs `text-embedding-v3`
enabled on your DashScope account:
```bash
curl -s https://dashscope-intl.aliyuncs.com/compatible-mode/v1/embeddings \
  -H "Authorization: Bearer $DASHSCOPE_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"text-embedding-v3","input":["hello"]}' | head -c 200; echo
```
Must return JSON with `data[0].embedding` (a float array). `model_not_found` →
enable **text-embedding-v3** in the DashScope console. (Fails open: without it, RAG
just returns nothing — the bot/council answer from prompt knowledge only.)

Key idea: **repoint the domain** to the Alibaba box. Traefik's routing + the
frontend's baked `NEXT_PUBLIC_API_URL` are tied to `ujamaadao.org` /
`api.ujamaadao.org`, so if those DNS records point at Alibaba, everything works
unchanged — no rebuilds. (DO stays as-is, just not the DNS target.)

---

## 0. Provision the ECS instance
- **Region:** an *international* region (e.g. Singapore `ap-southeast-1`) — good
  reach to `ghcr.io` and the DashScope intl endpoint. Avoid mainland-China
  regions (ghcr.io access is unreliable there).
- **Type/size:** ≥ 4 GB RAM (2 GB works like DO but is tight with 5 services),
  2 vCPU, 40 GB disk.
- **OS:** Ubuntu 22.04.
- **Security group — allow inbound:** 22 (SSH), 80 (HTTP), 443 (HTTPS).
  Do NOT expose 5432/6379 (Postgres/Redis stay internal).
- Note the instance's **public IP**.

## 1. Install Docker + Compose (on the ECS box)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER    # re-login after this
docker compose version           # confirm the v2 plugin is present
```

## 2. Get the code
```bash
git clone https://github.com/waicharikim/UJAMAA_DAO.git ~/UJAMAA_DAO
cd ~/UJAMAA_DAO && git checkout develop
# load the same aliases you use on DO
echo "source ~/UJAMAA_DAO/docker/server-aliases.sh" >> ~/.bashrc && source ~/.bashrc
```
GHCR packages are public — **no `docker login` needed**.

## 3. Repoint DNS (Namecheap) to the Alibaba IP
Update the A records so the domain resolves to the ECS public IP:
```
@    (ujamaadao.org)      A   <ECS_PUBLIC_IP>
api  (api.ujamaadao.org)  A   <ECS_PUBLIC_IP>
www                       A   <ECS_PUBLIC_IP>
```
Wait for propagation (a few min). Verify: `dig +short api.ujamaadao.org` → ECS IP.
(Do this early so Let's Encrypt can issue certs in step 5.)

## 4. Create `docker/.env.prod` (copy DO's, swap the AI block)
Copy your DO `.env.prod` verbatim, then change ONLY the AI provider to DashScope:
```dotenv
DASHSCOPE_API_KEY=<your Alibaba DashScope key>
DASHSCOPE_BASE_URL=                 # EMPTY -> Alibaba intl endpoint (not the DO URL)
BARAZA_AI_MODEL=qwen-plus
BARAZA_ANALYST_MODEL=qwen-max
DELIBERATION_AI_MODEL=qwen-plus
BARAZA_BOT_MODEL=                   # empty — qwen-plus isn't a forced-thinking model
```
Keep everything else identical to DO: `DATABASE_URL`, `JWT`/session secrets,
`ENCRYPTION_KEY`, `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET`, `BUNI_*`
(M-Pesa), `SENTRY_DSN`, `FOUNDER_EMAILS`, etc.

Traefik cert store (must exist, mode 600):
```bash
mkdir -p ~/UJAMAA_DAO/traefik
touch ~/UJAMAA_DAO/traefik/acme.json && chmod 600 ~/UJAMAA_DAO/traefik/acme.json
```

## 5. Pull images + start (Traefik auto-fetches Let's Encrypt certs)
```bash
cd ~/UJAMAA_DAO/backend
docker compose -f ../docker/docker-compose.prod.yml --env-file ../docker/.env.prod pull
docker compose -f ../docker/docker-compose.prod.yml --env-file ../docker/.env.prod up -d
```
Web startup auto-runs `prisma migrate deploy` (applies all migrations incl. the
Baraza reconcile). Watch: `docker logs -f ujamaa_web`.

**Session 109 migrations** apply here automatically: `20260711000000` (historian
`groupId`), `20260711010000` (`decisionRecord`), `20260711020000` (`knowledge_chunks`),
`20260712000000` (`MEMBER` provenance enum). **Watch the enum one** — some Prisma
versions refuse `ALTER TYPE … ADD VALUE` inside a transaction. If `migrate deploy`
errors on `20260712000000`, apply it by hand and re-run:
```bash
docker exec ujamaa_postgres psql -U ujamaa_user -d ujamaa_db \
  -c "ALTER TYPE \"HistoryProvenance\" ADD VALUE IF NOT EXISTS 'MEMBER';"
```

## 6. Seed the database (first deploy only)
```bash
# FORCE_SEED=true for the FIRST run only (locations, roles, wards, founder)
FOUNDER_EMAILS=<your founder email> docker compose -f ../docker/docker-compose.prod.yml \
  --env-file ../docker/.env.prod run --rm -e FORCE_SEED=true web node dist/core/database/seed.js
# make yourself super admin (alias)
uj-make-admin <your email>
```

## 7. Point the Telegram bot at Alibaba
Because DNS now sends `api.ujamaadao.org` to Alibaba, the existing webhook already
targets the right box — just re-assert it (secret must match `.env.prod`):
```bash
curl -X POST "https://api.telegram.org/bot<PROD_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://api.ujamaadao.org/api/v1/integration/telegram/webhook","secret_token":"<WEBHOOK_SECRET>","allowed_updates":["message"]}'
curl -s "https://api.telegram.org/bot<PROD_BOT_TOKEN>/getWebhookInfo"
```

## 8. Verify
```bash
curl -s https://api.ujamaadao.org/health         # {"status":"ok"}
# Confirm the AI key actually reached the container (length > 0):
docker exec ujamaa_web sh -c 'echo ${#DASHSCOPE_API_KEY}'
docker exec ujamaa_worker sh -c 'echo ${#DASHSCOPE_API_KEY}'
# Fast in-container AI check (no UI needed) — prints the model's reply:
docker exec ujamaa_web node -e "import('./dist/core/ai/qwen.js').then(async m=>{console.log('qwen available:',m.isQwenAvailable());console.log('reply:',await m.complete({system:'Be terse.',userMessage:'reply with the single word READY'}))}).catch(e=>console.error(e))"
```
- Both length checks must be non-zero; the in-container check must print
  `qwen available: true` and a `READY` reply. If available is `false`, the key
  didn't reach the container (check `.env.prod` + that you passed `--env-file`).
- Open https://ujamaadao.org — loads over HTTPS (valid cert).
- Sign in, open the Mjamaa chat widget, ask a question — answers via DashScope.
- Submit a proposal → confirm a deliberation runs (worker logs) and the council
  record appears. This is the hackathon centrepiece; it was tested on DashScope
  in dev, so it should work here.

## 8b. Activate the AI layer (session 109 — historian + knowledge index)

Two one-time activations after the stack is up. The prod image ships **compiled
`dist/` only** (no `src`/`tsx`), so run the compiled scripts with `node`:

```bash
# 1) Seed Mhenga's national history backbone (else the historian is silent).
docker exec ujamaa_web node dist/modules/governance/historian/seed-backbone.js
#    → "[HISTORIAN] Seeded N national backbone event(s)."  (idempotent; skips if seeded)

# 2) Build the RAG knowledge index (docs + verified education modules).
#    The image has no docs/ — copy the cloned repo's docs into the container first:
docker cp ~/UJAMAA_DAO/docs/. ujamaa_web:/usr/src/app/knowledge-docs
docker exec ujamaa_web node dist/modules/governance/knowledge/reindex-run.js
#    → "[KNOWLEDGE] Indexed N chunk(s)." + a smoke search printing relevant hits
```
Both need `text-embedding-v3` (seed needs only chat models). If reindex prints 0 or
the smoke search returns nothing, re-check the embeddings pre-flight above.

Verify the council can reach the knowledge layer in-container:
```bash
docker exec ujamaa_web node -e "import('./dist/modules/governance/knowledge/knowledge.service.js').then(async m=>{const h=await m.knowledgeService.search('how do Participation Rights work',3);console.log(h.map(x=>x.title))}).catch(console.error)"
```

## 8c. Provision the judges' demo (no-signup access)

So judges can test the AI layer without signup or the app's onboarding flow:

1. **Set a shared access code** in `docker/.env.prod`, then restart web:
   ```dotenv
   DEMO_ACCESS_CODE=<a long random phrase, ≥8 chars>   # share this with judges
   DEMO_JUDGE_EMAIL=demo@ujamaadao.org                  # optional; this is the default
   ```
   ```bash
   uj-deploy-web    # or: docker compose ... up -d web   (picks up the new env)
   ```
2. **Seed the demo account + flagship deliberation** (idempotent; safe to re-run):
   ```bash
   docker exec ujamaa_web node dist/core/database/seed-demo.js
   #  → creates demo user + a voluntary co-op + an urban-hydroponics PROJECT proposal,
   #    and QUEUES a real Baraza deliberation (the worker runs it on Qwen, ~4-6 min).
   ```
   Wait for the worker to finish the run: `docker logs -f ujamaa_worker | grep -i BARAZA`.
3. **Verify:** open `https://ujamaadao.org/judges`, enter the code → you should land on the
   completed deliberation. Then open Buda (bottom-right) and ask a question.
4. Put the code + URL into the submission's "try the AI yourself" section
   (`[DEMO_ACCESS_CODE]`, `https://ujamaadao.org/judges`).

The demo account is COMMUNITY_VERIFIED but **not** an admin, is sandboxed to the demo
community, and cannot move real money (real money is M-Pesa-only regardless). To disable
the whole feature, blank `DEMO_ACCESS_CODE` and redeploy web.

## 9. Submission artifacts (Devpost)
- **Architecture diagram:** Frontend + Backend (web/worker) on **Alibaba Cloud
  ECS** → **Qwen Cloud (DashScope)** for the deliberation council + Q&A bot;
  Postgres/Redis alongside; M-Pesa + Telegram as external integrations.
- **Proof of Alibaba/Qwen usage (code file):** `backend/src/core/ai/qwen.ts`
  (the DashScope client) + the DashScope env in this runbook.
- **Demo video (< 3 min):** record against https://ujamaadao.org — show a
  proposal → the 7-agent deliberation → a vote; and the Mjamaa assistant.

## Notes / gotchas
- **Don't build on the box** — pull GHCR images (backend build wants ~3 GB heap
  and will OOM), exactly like DO.
- **One Telegram webhook per bot:** whichever box `api.ujamaadao.org` points to
  owns the bot. Repointing DNS to Alibaba moves the bot to Alibaba automatically.
- **`reasoning_effort:"none"`** (added for DO) is harmless on DashScope (unknown
  params are ignored) — but sanity-check one bot reply after deploy.
- **This file contains no secrets** — safe to keep. Put real values only in
  `docker/.env.prod` on the box.
- Rollback / keep DO alive: DO is untouched; to switch back, repoint DNS to the
  DO droplet IP.
