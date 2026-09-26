// Loads the hand-written seed (24 real Chiang Mai events, 26 Sep - 3 Oct 2026, Thai + English)
// through the admin upsert route. Safe to rerun: rows are keyed on (source, external_id).
//
//   API_BASE=https://<host> ADMIN_INGEST_SECRET=... node scripts/seed/events/push.mjs
//   node scripts/seed/events/push.mjs --out /tmp/events.json   (no API needed)

import { readFile } from "node:fs/promises";
import { ingest, outArg } from "../../extract-events/ingest.mjs";

const { events } = JSON.parse(await readFile(new URL("./events.json", import.meta.url), "utf8"));
await ingest(events, { out: outArg() });
