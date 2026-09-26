// Sends event rows to the API's admin upsert route (CONTRACT.md §4), or writes them to a file.
//
// The contract names the route and says it is guarded by a shared-secret header, but not the header
// name or the body shape. Assumed here: header `x-admin-secret`, body `{ "events": [ ...rows ] }`,
// rows using the §2 column names. Change INGEST_HEADER / the body below if the API settles differently.

import { writeFile } from "node:fs/promises";

const HEADER = process.env.INGEST_HEADER || "x-admin-secret";

export async function ingest(rows, { out } = {}) {
  if (out) {
    await writeFile(out, JSON.stringify({ events: rows }, null, 2) + "\n");
    console.error(`Wrote ${rows.length} events to ${out}`);
    return;
  }
  const base = process.env.API_BASE;
  const secret = process.env.ADMIN_INGEST_SECRET;
  if (!base || !secret) throw new Error("Set API_BASE and ADMIN_INGEST_SECRET, or pass --out <file>");
  const res = await fetch(`${base.replace(/\/$/, "")}/v1/admin/events/upsert`, {
    method: "POST",
    headers: { "content-type": "application/json", [HEADER]: secret },
    body: JSON.stringify({ events: rows }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upsert failed: ${res.status} ${text.slice(0, 300)}`);
  console.error(`Upserted ${rows.length} events: ${text.slice(0, 200)}`);
}

export const outArg = () => {
  const i = process.argv.indexOf("--out");
  return i > -1 ? process.argv[i + 1] : undefined;
};
