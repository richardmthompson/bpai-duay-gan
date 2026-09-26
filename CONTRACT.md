# The contract

**The contract lives in code: [`apps/web/src/lib/contract.ts`](apps/web/src/lib/contract.ts)** and
the client that calls it, [`apps/web/src/lib/api/`](apps/web/src/lib/api/). Those were written
against the original CONTRACT.md sections 2, 4 and 5, and they are what the web app actually
compiles against. This file only records the runtime details that code assumes but cannot express.

## Runtime facts the api implements

| Thing | Value |
|---|---|
| Base | same origin, path `/v1` — `NEXT_PUBLIC_API_BASE` must be set or the web app runs its mock |
| Socket | `NEXT_PUBLIC_WS_URL`, e.g. `wss://<host>/ws` |
| Auth | bearer token on every `/v1` call **and** in the socket's first frame (`{type:"auth",payload:{token}}`) |
| Token source | `GET /api/ws-token` on the web app → `{token, expiresIn}`; 401 means signed out |
| Errors | flat `{code, message}` — **not** nested under `error` |
| Token lifetime | 12 h, HS256, signed with `WS_TOKEN_SECRET` (shared by web and api) |

## Sign-in

Auth.js was in the original plan and is not used. The flow is small enough to own, and the only
thing it must produce is the bearer token above.

- `POST /v1/auth/magic-link {email}` → `{ok, sent, reason?}`. With `SMTP_*` set it emails a link to
  `https://<host>/sign-in?token=…`; without them it logs the link and says why.
- `POST /v1/auth/verify {token}` → `{token, expiresIn, userId, displayName, …}`. Single-use.
- `POST /v1/dev-login {email}` → the same shape, for accounts flagged `demo_account`.
  Gated on `ALLOW_DEV_LOGIN=true`; this is how the seeded cast signs in on stage.
- `GET /v1/demo-accounts` → the cast for the sign-in screen, or `[]` when dev login is off.

The browser writes the token to the `bpai_token` cookie (so `/api/ws-token` can hand it to the
socket) and to `localStorage`.

## Profile photo

- `PUT /v1/me/avatar` — body is the raw image, `Content-Type: image/jpeg`, `image/png` or
  `image/webp`, at most 2 MB. The bytes must be one of those formats (checked by magic bytes, not
  the header); otherwise `415 unsupported_media`, and over the limit `413 too_large`. Returns the
  updated `Me`, whose `avatarUrl` is a path, `/v1/media/avatars/<userId>-<32 hex>.<ext>`. The
  caller's previous upload is deleted; Google and seed image urls are never touched.
- `DELETE /v1/me/avatar` → the updated `Me` with `avatarUrl: null`, and the uploaded file removed.
- `GET /v1/media/avatars/:file` — public, `Cache-Control: public, max-age=31536000, immutable`
  (a new photo always gets a new name). Anything that is not a name the api could have written is 404.

The web app resizes to 512px on the long side and re-encodes as JPEG before upload
(`apps/web/src/lib/photo.ts`), which also strips EXIF and GPS data. Files live in `$UPLOAD_DIR/avatars`;
see `deploy/README.md`.

## Admin ingest

`POST /v1/admin/events/upsert` with header `x-admin-secret: <ADMIN_INGEST_SECRET>` and body
`{events: [ … ]}` using the `scripts/seed/events/*.sql` column names. Upserts on
`(source, external_id)`. This is what `scripts/seed/events/push.mjs` and
`scripts/extract-events/` already call.

## Running it

See [deploy/README.md](deploy/README.md) — apt packages and systemd, no Docker.

## Change log

| Date | Change |
|---|---|
| 2026-09-26 | Replaced the drafted v1 with a pointer to the contract that actually shipped in code. |
| 2026-09-27 | Profile photo upload, removal and serving (#24). |
