# Events: seed and extraction (Slices 6 and 14)

Both write through the API's admin upsert route (CONTRACT.md §4), keyed on (`source`, `external_id`).

## Seed: `scripts/seed/events/`

`events.json` holds 24 real Chiang Mai events for 26 Sep – 3 Oct 2026, hand-written in Thai and English, including the four the demo profiles reference (`akha-songs-stories`, `sunday-walking-street`, `eco-printing-bua-bhat`, `ai-news-meetup`), in the §2 column names. `source` is `seed`, `external_id` is a stable slug so reruns update instead of duplicating. Each description carries what the event is, what happens, how much English a guest needs, and first-timer tips.

```bash
cd scripts/extract-events && npm install
API_BASE=https://<host> ADMIN_INGEST_SECRET=... npm run seed
node ../seed/events/push.mjs --out /tmp/events.json      # no API: write the payload to a file
```

## Tags: `scripts/seed/tags/`

`tags.json` is the app's single tag list, with Thai and English labels; every profile and event tag must be one of its ids, and `scripts/seed/build_sql.py` fails if one is not. The Thai labels still need a native speaker's check. `scripts/seed/events/event-tags.json` links events to those tags for the ranking's shared-interest signal. An extractor that tags events must use ids from `tags.json`.

## Loading without the API

If `POST /v1/admin/events/upsert` isn't up yet, load everything straight into Postgres. Both files are idempotent; `build_sql.py` prints the current tag, event and link counts when it regenerates them:

```bash
psql "$DATABASE_URL" -f scripts/seed/tags/tags.sql
psql "$DATABASE_URL" -f scripts/seed/events/events.sql
```

After editing any seed JSON, regenerate the SQL with `python3 scripts/seed/build_sql.py`.

## Extraction: `meetup.mjs`

Reads this week's in-person Chiang Mai events from Meetup (the search page is server-rendered; each event page has schema.org Event data), skips any event already in the seed, and has Claude write the Thai and English title and description. Events closed to Thai locals (for example, visa-holders-only dinners) are dropped.

```bash
npm run meetup:dry                                        # facts only, no Claude, no API -> meetup.out.json
API_BASE=https://<host> ADMIN_INGEST_SECRET=... ANTHROPIC_API_KEY=... npm run meetup
```

Luma rate-limits server requests (429), so it is not a source yet.

## Assumptions to confirm with the API owner

The contract names the route but not its request shape. These scripts send header `x-admin-secret: <ADMIN_INGEST_SECRET>` (override with `INGEST_HEADER`) and body `{ "events": [ ...rows ] }` with the §2 column names. `external_id` on seed rows is a slug rather than null, so the seed is idempotent too.
