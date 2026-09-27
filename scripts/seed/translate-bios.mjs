/**
 * Fills profiles.interests_text_translated — the bio in the language its author does not write,
 * so a card can show a reader their own language without waiting on a model.
 *
 * Idempotent: it only touches rows where the translation is missing, so it is safe to run after
 * every reseed, and safe to re-run after adding people. The seeded cast goes first — those are the
 * profiles someone sees before the roster.
 *
 *   cd /srv/bpai && set -a && . ./.env && set +a && node scripts/seed/translate-bios.mjs
 *
 * Needs ANTHROPIC_API_KEY (the same one the app uses). Without it, the script says so and stops.
 */
import { q } from "@bpai/db";
import { translateProfileText } from "../../apps/api/src/translate.ts";

const CONCURRENCY = 4;   // polite to the api; 124 bios take about a minute

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✗ ANTHROPIC_API_KEY is unset — nothing to translate with");
  process.exit(1);
}

const rows = await q(
  `select user_id, display_name, interests_text, speaks_language
     from profiles
    where interests_text <> '' and interests_text_translated is null
    order by demo_account desc, display_name`);

console.log(`translating ${rows.length} bio(s), ${CONCURRENCY} at a time`);

let done = 0;
let failed = 0;
const queue = [...rows];

async function worker() {
  for (;;) {
    const row = queue.shift();
    if (!row) return;
    const to = row.speaks_language === "th" ? "en" : "th";
    const translated = await translateProfileText(row.interests_text, row.speaks_language, to);
    if (!translated) {
      failed += 1;
      console.warn(`  ! ${row.display_name}: no translation`);
      continue;
    }
    await q("update profiles set interests_text_translated = $2 where user_id = $1", [row.user_id, translated]);
    done += 1;
    process.stdout.write(`  ${done}/${rows.length} ${row.display_name} → ${to}\r`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`\ndone: ${done} translated, ${failed} failed`);

const counts = await q(
  `select count(*) filter (where interests_text <> '' and interests_text_translated is null) as missing,
          count(*) as total
     from profiles`);
console.log(`profiles: ${counts[0].total}, still missing a translation: ${counts[0].missing}`);
process.exit(failed ? 1 : 0);
