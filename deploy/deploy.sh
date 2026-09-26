#!/usr/bin/env bash
# Deploy current main onto the hackathon box.
#
#   bash /srv/bpai/deploy/deploy.sh
#
# Deliberately `pull --ff-only` and never `reset --hard`: there is no local work worth keeping on
# this box, but a hard reset would discard it silently if anyone ever edited in place. Divergence
# should fail loudly instead.
set -euo pipefail
cd /srv/bpai

echo "==> fetch"
git pull --ff-only

echo "==> dependencies"
npm install --no-audit --no-fund

echo "==> schema (idempotent)"
set -a; . ./.env; set +a
psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f packages/db/schema.sql

echo "==> restart api"
systemctl restart bpai-api
sleep 2
curl -fsS localhost:4000/v1/health && echo "  api ok"

# The web app builds in http mode: with an empty NEXT_PUBLIC_API_BASE it silently runs its mock
# backend instead of talking to the api, which looks like a working app with fake data.
# The roster portraits live with the seed data; the web app serves them from its own public/.
# They are not tracked under apps/web, so a fresh checkout (or a `git clean`) leaves every face
# 404ing unless they are copied in here.
echo "==> portraits for the web app"
mkdir -p apps/web/public/portraits
cp -f scripts/seed/demo-people/portraits/*.jpg apps/web/public/portraits/ 2>/dev/null || true

echo "==> build web (http mode)"
cd apps/web
NEXT_PUBLIC_API_BASE="${PUBLIC_BASE_URL:-https://bpai.drdos.shivamsaluja.com}" \
NEXT_PUBLIC_WS_URL="${PUBLIC_WS_URL:-wss://bpai.drdos.shivamsaluja.com/ws}" \
npm run build

# next.config.ts sets output: "standalone", which produces a self-contained server that does NOT
# include .next/static or public/. Copy them in or every page loads without CSS or images.
echo "==> standalone assets"
cp -r .next/static .next/standalone/apps/web/.next/static
cp -r public      .next/standalone/apps/web/public

echo "==> restart web"
systemctl restart bpai-web
sleep 4
systemctl --no-pager --lines=3 status bpai-web | tail -3
curl -fsS -o /dev/null -w "  web: %{http_code}\n" "${PUBLIC_BASE_URL:-https://bpai.drdos.shivamsaluja.com}/sign-in"
