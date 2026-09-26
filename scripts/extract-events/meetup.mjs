// Extracts this week's in-person Chiang Mai events from Meetup and upserts them (Slice 14).
//
//   node meetup.mjs --out /tmp/meetup.json --no-translate   dry run: facts only, no API, no Claude
//   API_BASE=... ADMIN_INGEST_SECRET=... node meetup.mjs    translate with Claude, send to the API
//
// How Meetup is read: the Chiang Mai search page is server-rendered and carries the first ~11 events
// in its __NEXT_DATA__ Apollo state; each event page has a schema.org Event block with exact time,
// venue and address. Luma rate-limits server requests (429), so it is not a source here.
//
// Without translation, rows carry only title_en; per the contract the API's upsert route runs a
// translation pass for rows with one language missing.

import { readFile } from "node:fs/promises";
import { ingest, outArg } from "./ingest.mjs";
import { translateEvent } from "./translate.mjs";

const FIND_URL = "https://www.meetup.com/find/?location=th--Chiang%20Mai&source=EVENTS&distance=tenMiles";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const DAYS_AHEAD = Number(process.env.DAYS_AHEAD || 7);
const translate = !process.argv.includes("--no-translate");

async function getHtml(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res.text();
}

function apolloState(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1])?.props?.pageProps?.__APOLLO_STATE__ ?? {} : {};
}

function ldEvent(html) {
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      for (const item of [JSON.parse(m[1])].flat()) if (/Event$/.test(item?.["@type"] || "")) return item;
    } catch {
      // skip malformed blocks
    }
  }
  return null;
}

async function listEvents() {
  const state = apolloState(await getHtml(FIND_URL));
  const until = Date.now() + DAYS_AHEAD * 86400e3;
  return Object.values(state).filter(
    (e) => e?.__typename === "Event" && e.title && e.eventUrl && e.eventType === "PHYSICAL" && Date.parse(e.dateTime) <= until
  );
}

async function readEvent(listed) {
  const html = await getHtml(listed.eventUrl);
  const ld = ldEvent(html);
  if (!ld) throw new Error("no event data on the page");
  const page = Object.entries(apolloState(html)).find(([k]) => k.startsWith("Event:"))?.[1] ?? {};
  const venue = ld.location?.name && ld.location.name !== "Chiang Mai" ? ld.location.name : null;
  const street = ld.location?.address?.streetAddress || null;
  const fee = page.feeSettings?.amount ? `${page.feeSettings.amount} ${page.feeSettings.currency}` : null;
  return {
    row: {
      source: "meetup",
      external_id: String(listed.id),
      source_url: listed.eventUrl,
      title_en: ld.name,
      title_th: null,
      description_en: null,
      description_th: null,
      starts_at: ld.startDate,
      ends_at: ld.endDate || null,
      venue_name: venue,
      address: street,
      price_text: fee,
      image_url: ([ld.image].flat()[0] || "").replace("/676x676.", "/676x380.") || null,
    },
    announcement: {
      title: ld.name,
      start: ld.startDate,
      end: ld.endDate,
      venue,
      address: street,
      meetup_fee: fee,
      description: (page.description || ld.description || "").slice(0, 6000),
    },
  };
}

// The hand-written seed already covers some Meetup events. Skip those so the feed never shows the
// same event twice under two sources (scenario S14).
const seed = JSON.parse(await readFile(new URL("../seed/events/events.json", import.meta.url), "utf8")).events;
const seeded = new Set(seed.map((e) => e.source_url.replace(/\/$/, "")));

const found = await listEvents();
const listed = found.filter((e) => !seeded.has(e.eventUrl.replace(/\/$/, "")));
console.error(`Found ${found.length} in-person events in the next ${DAYS_AHEAD} days, ${found.length - listed.length} already in the seed.`);

const rows = [];
for (const item of listed) {
  try {
    const { row, announcement } = await readEvent(item);
    if (translate) {
      try {
        const t = await translateEvent(announcement);
        if (!t.open_to_locals) {
          console.error(`skip (not open to locals): ${row.title_en}`);
          continue;
        }
        Object.assign(row, {
          title_en: t.title_en || row.title_en,
          title_th: t.title_th,
          description_en: t.description_en,
          description_th: t.description_th,
          price_text: t.price_text || row.price_text,
        });
      } catch (err) {
        console.error(`no translation for ${row.title_en}: ${err.message}`);
      }
    }
    rows.push(row);
  } catch (err) {
    console.error(`failed ${item.eventUrl}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 400)); // be polite to Meetup
}

await ingest(rows, { out: outArg() });
