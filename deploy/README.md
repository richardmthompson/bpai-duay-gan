# Deploy — 149.56.37.29

Replaces the deleted `infra/compose/` runbook. **No Docker** (team decision, commit `d94ca02`) —
everything is apt packages and systemd on the host.

## What is actually on the box (verified 2026-09-26)

| | |
|---|---|
| OS | Ubuntu 24.04.3 LTS, OpenVZ container, 2 vCPU / 6 GB / 148 GB |
| Runtime | Node **22.23.3** — runs TypeScript directly, so there is no build step |
| Database | PostgreSQL **16.15**, loopback only |
| Proxy | Caddy 2.6.2, TLS automatic |
| Code | `/srv/bpai` (clone of `github.com/richardmthompson/bpai-duay-gan`) |
| Secrets | `/srv/bpai/.env`, chmod 600 |
| Service | `bpai-api` (systemd), `curl localhost:4000/v1/health` |

`apache2` shipped with the image, held port 80, and is now disabled. If anything ever reinstalls
it, Caddy will fail to bind.

## Layout

```
/srv/bpai/apps/api       Node api + WebSocket (:4000)
/srv/bpai/apps/web       Next.js PWA (:3000) — not built yet
/srv/bpai/packages/db    schema.sql + client
/srv/bpai/packages/shared  types shared by web and api
/srv/bpai/scripts/seed   tags, events, demo profiles
/srv/bpai/deploy         this file, Caddyfile, systemd unit, deploy script
```

## Deploy a change

```bash
bash /srv/bpai/deploy/deploy.sh    # pull --ff-only, npm install, schema, restart, health check
```

## First-time setup, in order (what was actually done)

```bash
systemctl disable --now apache2                       # free :80
apt-get install -y postgresql postgresql-contrib caddy git
# Node 22 from NodeSource: curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs

sudo -u postgres psql -c "create role bpai login password '<generated>'"
sudo -u postgres createdb -O bpai bpai
sudo -u postgres psql -d bpai -c "create extension if not exists pgcrypto"

git clone https://github.com/richardmthompson/bpai-duay-gan.git /srv/bpai
cd /srv/bpai && npm install
psql "$DATABASE_URL" -f packages/db/schema.sql
# Order matters: event links need the tags, and people's event attendance needs the events.
psql "$DATABASE_URL" -f scripts/seed/tags/tags.sql
psql "$DATABASE_URL" -f scripts/seed/events/events.sql
node scripts/seed/run.ts                              # demo people, after the events they attend

cp deploy/bpai-api.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now bpai-api
cp deploy/Caddyfile /etc/caddy/Caddyfile && caddy validate --config /etc/caddy/Caddyfile && systemctl reload caddy
```

## DNS

`*.drdos.shivamsaluja.com` is a Cloudflare **wildcard to 152.53.67.253**, so
`bpai.drdos.shivamsaluja.com` resolves to the wrong machine until an explicit record is added:

- **Type** A · **Name** `bpai` · **Value** `149.56.37.29` · **Proxy status** DNS only

Verify with `dig +short bpai.drdos.shivamsaluja.com` **before** reloading Caddy — Let's Encrypt
validates over :80, and a proxied record breaks that.

## Seeding

The seed scripts talk to the api's admin route, so the app must be up:

```bash
cd /srv/bpai/scripts/extract-events && npm install
API_BASE=https://bpai.drdos.shivamsaluja.com ADMIN_INGEST_SECRET=... npm run seed
```

`ADMIN_INGEST_SECRET` is in `/srv/bpai/.env`. The same payload can be loaded straight into
Postgres with `psql -f scripts/seed/events/events.sql` if the api is down — both paths are
idempotent on `(source, external_id)`.

Events loaded this way arrive after the people. Rerun `node scripts/seed/run.ts` afterwards so the
demo people's event attendance links to them; it is idempotent. Without that rerun the cast has no
shared events, and the Nok and Sam stage pair loses the reason they rank first for each other.

## Known shortcuts

- The service runs as **root** on a disposable box. Do not copy that anywhere real.
- The box's root password was shared over chat and should be rotated after the weekend.
- `.env` holds every secret for the deployment; it is gitignored and 600.
