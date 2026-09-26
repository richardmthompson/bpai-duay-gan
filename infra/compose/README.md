# Deploy runbook (docker compose + Caddy)

Target: Shivam's Ubuntu 26.04 server. Owner: role 5 (Marc). Services: `db` (Postgres 17 + pgvector), `api` (Node, port 4000), `web` (Next.js, port 3000), `caddy` (TLS on 80/443).

Routing (Caddyfile): `/api/auth/*` and `/api/ws-token` go to web. `/v1/*` and `/ws` go to api. Everything else goes to web.

## 1. Server prep

```bash
# Docker Engine + compose plugin. If Docker's apt repo doesn't list 26.04 yet, use Ubuntu's packages:
curl -fsSL https://get.docker.com | sudo sh    # or: sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker
docker compose version

# Open the web ports if ufw is on
sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 443/udp
```

## 2. DNS

Create an A record `<DOMAIN>` pointing to the server's public IPv4 (and AAAA if it has IPv6). Wait until `dig +short <DOMAIN>` returns the server IP **before** starting Caddy, or Let's Encrypt validation fails and retries back off.

## 3. `.env`

```bash
git clone https://github.com/richardmthompson/bpai-duay-gan.git && cd bpai-duay-gan
cp infra/compose/.env.example .env && chmod 600 .env

openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # WS_TOKEN_SECRET (same value is read by web and api)
openssl rand -hex 32      # ADMIN_INGEST_SECRET
openssl rand -hex 24      # POSTGRES_PASSWORD
npx web-push generate-vapid-keys   # VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
```

Fill in: `DOMAIN`, `POSTGRES_*`, `DATABASE_URL=postgres://<user>:<password>@db:5432/<db>`, `AUTH_URL=https://<DOMAIN>`, `AUTH_TRUST_HOST=true`, `NEXT_PUBLIC_API_BASE=https://<DOMAIN>`, `NEXT_PUBLIC_WS_URL=wss://<DOMAIN>/ws`, `VAPID_SUBJECT=mailto:...`, plus the Google, LINE, Anthropic, Voyage and email keys.

`NEXT_PUBLIC_*` are baked in at build time. After changing them, run `up -d --build web`.

Note: the PRP puts `.env.example` in `infra/compose/`; the file is read from the repo root as `.env`. If CONTRACT.md later says root, move it.

## 4. Start

```bash
docker compose --env-file .env -f infra/compose/docker-compose.yml up -d --build
docker compose --env-file .env -f infra/compose/docker-compose.yml ps
docker compose --env-file .env -f infra/compose/docker-compose.yml logs -f caddy api
```

Never `down -v`: it deletes `caddy_data` (certs, so re-issuing hits Let's Encrypt duplicate-cert limits) and `db_data`.

## 5. Verify

```bash
D=<DOMAIN>
curl -fsS https://$D/v1/health                     # 200 from api
curl -sI https://$D/ | head -1                     # 200 from web
curl -sI https://$D/api/auth/providers | head -1   # 200 from Auth.js

# WebSocket upgrade: expect "HTTP/1.1 101 Switching Protocols"
# (append ?token=... if the api rejects unauthenticated upgrades with 401; a 401 still proves routing works)
curl -si --http1.1 -N --max-time 5 \
  -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  https://$D/ws | head -1

# Cert issuer should be Let's Encrypt (or ZeroSSL)
echo | openssl s_client -connect $D:443 -servername $D 2>/dev/null | openssl x509 -noout -issuer -dates
```

## App Dockerfiles (owned by roles 1 and 3, not written yet)

Compose expects `apps/api/Dockerfile` and `apps/web/Dockerfile`, both built with the **repo root** as context. They must:

- Use npm workspaces: copy the root `package.json`, `package-lock.json`, and **every** workspace `package.json` (`apps/*/package.json`, `packages/*/package.json`) before `npm ci`, then copy the sources. Otherwise `npm ci` fails or the layer cache is useless.
- api: listen on `PORT` (4000), expose `GET /v1/health` returning 200, and upgrade WebSockets on `/ws`. The healthcheck runs `node -e fetch(...)`, so Node 18+ is required and no curl is needed.
- web: set `output: 'standalone'` in `next.config`, declare `ARG NEXT_PUBLIC_API_BASE` and `ARG NEXT_PUBLIC_WS_URL` (then `ENV` them) **before** `next build`, and run `node apps/web/server.js` (the standalone path) with `HOSTNAME=0.0.0.0 PORT=3000`.
- Run DB migrations at api start or as a one-off: `docker compose ... run --rm api <migrate cmd>`.

## Google OAuth console checklist

- [ ] Google Cloud project, then **APIs & Services → OAuth consent screen**: app name, support email, scopes `openid email profile`.
- [ ] While in **Testing** mode, only listed test users can log in (max 100). Add every teammate's and judge-demo account's Gmail. Either **Publish** (basic scopes need no verification) or keep the test-user list complete before the demo.
- [ ] **Credentials → Create OAuth client ID → Web application.**
- [ ] Authorized JavaScript origins: `https://<DOMAIN>`, `http://localhost:3000`.
- [ ] Authorized redirect URIs: `https://<DOMAIN>/api/auth/callback/google`, `http://localhost:3000/api/auth/callback/google`.
- [ ] Put the ID and secret in `.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, then restart web.

## LINE console checklist

- [ ] [LINE Developers](https://developers.line.biz/console/): create **one provider** that holds both channels (user IDs are per provider, so Login and Messaging must share it).
- [ ] **LINE Login channel**: callback URL `https://<DOMAIN>/api/auth/callback/line` (add `http://localhost:3000/api/auth/callback/line` for dev). Channel ID and secret go in `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET`.
- [ ] Set the Login channel to **Published**. In Developing mode only channel admins and testers can log in.
- [ ] Email permission needs an approved application in the console, so treat email from LINE as **absent**. A LINE-only user has no email to link against Google.
- [ ] **Messaging API channel** (same provider): issue a long-lived channel access token into `LINE_MESSAGING_ACCESS_TOKEN`. Link the bot as the Login channel's "linked OA" so users can add it as a friend at login. Pushes only reach users who have friended the bot.
