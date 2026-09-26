/**
 * Seeds tags and demo people. Idempotent: rerunning updates in place.
 *
 *   DATABASE_URL=... node scripts/seed/run.ts
 *
 * Two profile sources, and both are needed:
 *   - profiles/demo-profiles.json — the 24-profile cast with the Nok/Sam stage pair. The demo
 *     script depends on those two ranking first for each other.
 *   - demo-people/profiles.json   — the 100-person roster with portraits, which is what makes
 *     Browse look like a real community.
 *
 * Both files use one tag vocabulary: tags/tags.json, generated from the merged 85-tag taxonomy in
 * docs/drafts/tag-taxonomy-proposal.json. This runner inserts exactly those tags. A profile naming
 * an id that tags.json lacks stops the run before anything is written, naming the id and the
 * profile; fix the data (scripts/seed/build_sql.py runs the same check) rather than adding tags.
 */
import { readFile } from "node:fs/promises";
import { q, tx } from "@bpai/db";

interface SeedProfile {
  ref?: string;
  id?: string;
  email?: string;
  display_name: string;
  community: "local" | "foreigner";
  interface_language: "th" | "en";
  speaks_language?: "th" | "en";
  politeness_register: "female" | "male" | "neutral";
  interests_text?: string;
  intro?: string;
  intro_en?: string;
  avatar_url?: string | null;
  photo?: string | null;
  give: string[];
  learn: string[];
  going_event_refs?: string[];
  demo_role?: string;
  occupation?: string | null;
  neighborhood?: string | null;
  age?: number | null;
}

const readJson = async (relative: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));

const cast = (await readJson("./profiles/demo-profiles.json") as { profiles: SeedProfile[] }).profiles;
const roster = (await readJson("./demo-people/profiles.json") as SeedProfile[]).map((p) => ({
  ...p,
  // The 100 carry a portrait path; serve them from the web app's public dir.
  avatar_url: p.photo ? `/${p.photo.replace(/^.*?(portraits\/)/, "$1")}` : null,
}));

// ── tags: tags.json alone; an id it does not hold is fatal ───────────────────────────────────

const allTags = (await readJson("./tags/tags.json") as {
  tags: Array<{ id: string; label_en: string; label_th: string; sort_order: number }>;
}).tags;
const knownTagIds = new Set(allTags.map((t) => t.id));

const unresolved: string[] = [];
for (const p of [...cast, ...roster]) {
  for (const [direction, list] of [["give", p.give], ["learn", p.learn]] as const) {
    for (const t of list) if (!knownTagIds.has(t)) unresolved.push(`${p.ref ?? p.id}: ${direction} '${t}'`);
  }
}
if (unresolved.length) {
  console.error(`✗ ${unresolved.length} tag id(s) used by demo profiles are not in tags/tags.json:`);
  for (const u of unresolved) console.error(`    ${u}`);
  process.exit(1);
}

for (const t of allTags) {
  await q(
    `insert into tags (id, label_en, label_th, sort_order) values ($1,$2,$3,$4)
     on conflict (id) do update set label_en = excluded.label_en, label_th = excluded.label_th,
       sort_order = excluded.sort_order`,
    [t.id, t.label_en, t.label_th, t.sort_order]);
}
console.log(`✓ tags: ${allTags.length}`);

// ── events referenced by the cast ─────────────────────────────────────────────────────────────

const eventRows = await q<{ id: string; external_id: string }>(
  "select id, external_id from events where source = 'seed'");
const eventBySlug = new Map(eventRows.map((e) => [e.external_id, e.id]));

// ── people ────────────────────────────────────────────────────────────────────────────────────

// created_at desc is the ranking's tie-break, so the roster goes in first and the cast last:
// the stage pair then wins any tie it is part of.
const ordered: SeedProfile[] = [...roster, ...cast];
const newest = Date.now() - 1000;

let created = 0;
let skippedRefs = 0;

await tx(async (c) => {
  for (const [index, person] of ordered.entries()) {
    const email = person.email ?? `${person.id ?? person.ref}@demo.invalid`;
    const user = await c.query(
      `insert into users (email, name) values ($1,$2)
       on conflict (email) do update set name = excluded.name returning id`,
      [email, person.display_name]);
    const userId = user.rows[0].id as string;

    const bio =
      person.interests_text ??
      [person.occupation, person.neighborhood].filter(Boolean).join(" · ") +
        (person.intro_en ? `\n\n${person.interface_language === "th" ? person.intro : person.intro_en}` : "");
    const createdAt = new Date(newest - index * 1000).toISOString();

    await c.query(
      `insert into profiles (user_id, display_name, avatar_url, community, interface_language,
                             speaks_language, politeness_register, interests_text,
                             onboarding_complete, demo_account, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)
       on conflict (user_id) do update set
         display_name = excluded.display_name, avatar_url = excluded.avatar_url,
         community = excluded.community, interface_language = excluded.interface_language,
         speaks_language = excluded.speaks_language, politeness_register = excluded.politeness_register,
         interests_text = excluded.interests_text, onboarding_complete = true,
         created_at = excluded.created_at`,
      [userId, person.display_name, person.avatar_url ?? null, person.community, person.interface_language,
       person.speaks_language ?? person.interface_language, person.politeness_register, bio,
       Boolean(person.demo_role), createdAt]);

    await c.query("delete from profile_tags where user_id = $1", [userId]);
    for (const [direction, list] of [["give", person.give], ["learn", person.learn]] as const) {
      for (const tagId of list) {
        await c.query(
          "insert into profile_tags (user_id, tag_id, direction) values ($1,$2,$3) on conflict do nothing",
          [userId, tagId, direction]);
      }
    }

    await c.query("delete from event_attendance where user_id = $1", [userId]);
    for (const ref of person.going_event_refs ?? []) {
      const slug = ref.startsWith("seed:") ? ref.slice(5) : ref;
      const eventId = eventBySlug.get(slug);
      if (!eventId) { skippedRefs += 1; console.warn(`  ! ${person.ref ?? person.id}: no seeded event '${slug}'`); continue; }
      await c.query("insert into event_attendance (user_id, event_id) values ($1,$2) on conflict do nothing", [userId, eventId]);
    }
    created += 1;
  }
});

const counts = await q<{ profiles: number; demo: number; links: number; attendance: number }>(
  `select (select count(*) from profiles) profiles,
          (select count(*) from profiles where demo_account) demo,
          (select count(*) from profile_tags) links,
          (select count(*) from event_attendance) attendance`);
console.log(`✓ seeded ${created} people (${skippedRefs} event refs skipped) → ${JSON.stringify(counts[0])}`);
process.exit(0);
