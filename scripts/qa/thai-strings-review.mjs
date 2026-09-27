#!/usr/bin/env node
/**
 * Review pass over the Thai *we* wrote — UI strings, tag labels, event titles and profile intros —
 * as opposed to the model's chat translations (see translation-test.mjs).
 *
 * A strong model reads each item against its English reference where one exists and flags Thai that
 * is wrong, unnatural, machine-sounding or mismatched in meaning. It also writes a review sheet: the
 * flagged items first, then the whole list with an empty column for a Thai speaker's verdict — the
 * model is a filter, not the authority; th.ts says "Draft Thai. Needs a native speaker's pass".
 *
 *   cd /srv/bpai && node scripts/qa/thai-strings-review.mjs
 *
 * Writes /tmp/thai-review.md and /tmp/thai-review.json. Judge: JUDGE_MODEL (default claude-opus-5).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const ROOT = resolve(process.env.REPO ?? new URL("../..", import.meta.url).pathname);
const JUDGE = process.env.JUDGE_MODEL ?? "claude-opus-5";
const anthropic = new Anthropic();
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const items = [];
const push = (kind, id, en, th) => { if (th && String(th).trim()) items.push({ kind, id, en: en ?? "", th: String(th) }); };

// ---- UI strings (functions are called with a sample so their pattern is reviewable) ----
const { en } = await import(pathToFileURL(join(ROOT, "apps/web/src/i18n/en.ts")).href);
const { th } = await import(pathToFileURL(join(ROOT, "apps/web/src/i18n/th.ts")).href);
const sample = (v) => (typeof v === "function" ? v("Nok") : v);
function walk(e, t, path = "") {
  for (const k of Object.keys(e)) {
    if (typeof e[k] === "object" && e[k] !== null) walk(e[k], t[k] ?? {}, path ? `${path}.${k}` : k);
    else push("ui", path ? `${path}.${k}` : k, sample(e[k]), sample(t?.[k]));
  }
}
walk(en, th);

// ---- seed content ----
const tags = readJson("scripts/seed/tags/tags.json").tags ?? [];
for (const t of tags) push("tag", t.id, t.label_en, t.label_th);

const events = readJson("scripts/seed/events/events.json").events ?? [];
for (const e of events) {
  push("event-title", e.external_id, e.title_en, e.title_th);
  const dEn = e.description_en, dTh = e.description_th;
  if (dEn && dTh) push("event-desc", e.external_id, String(dEn).slice(0, 400), String(dTh).slice(0, 400));
}

for (const p of readJson("scripts/seed/profiles/demo-profiles.json").profiles ?? []) {
  if (p.community === "local") push("cast-intro", p.ref, "", p.interests_text);
}
for (const p of readJson("scripts/seed/demo-people/profiles.json") ?? []) {
  push("roster-intro", p.id, p.intro_en ?? "", p.intro);
}

console.log(`reviewing ${items.length} Thai strings (${[...new Set(items.map((i) => i.kind))].join(", ")})`);

const BATCH = { "ui": 12, "tag": 16, "event-title": 10, "event-desc": 4, "cast-intro": 5, "roster-intro": 5 };
const PROMPT = (batch) => `You are reviewing Thai copy written by hand for "Bpai Dûay Gan", a Chiang Mai app that pairs Thai locals with visitors. Judges and users will read this.

For EACH item judge the Thai:
- correct? (grammar, spelling, particles, no mangled words)
- natural? (would a Thai person write this — not translator-ese, not a literal calque)
- if an English reference is given: does the Thai carry the same meaning and tone? A Thai line that reads fine but says something different from the English is a FLAG.
Score it OK (good enough to ship), or FLAG (wrong, unnatural, or meaning mismatch).
Do not flag stylistic preferences as FLAG — only things a Thai speaker would call an error or a mismatch.
For every FLAG give a one-sentence reason in English and a corrected Thai line.

Reply with JSON only: {"results":[{"i":<index>,"verdict":"OK|FLAG","reason":"...","better":"ถ้าไม่ผ่าน ใส่ Thai ที่แก้แล้ว"}]}

Items:
${batch.map((x) => `${x.i}. [${x.kind}]${x.en ? ` EN: ${x.en}` : " (no English reference)"} | TH: ${x.th}`).join("\n")}`;

const results = new Map();
const byKind = {};
for (const it of items) (byKind[it.kind] ??= []).push(it);

for (const [kind, list] of Object.entries(byKind)) {
  const size = BATCH[kind] ?? 8;
  for (let i = 0; i < list.length; i += size) {
    const slice = list.slice(i, i + size).map((x, n) => ({ ...x, i: n }));
    const res = await anthropic.messages.create(
      { model: JUDGE, max_tokens: 3000, messages: [{ role: "user", content: PROMPT(slice) }] },
      { timeout: 120_000 },
    );
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    for (const r of parsed.results ?? []) {
      const item = slice[r.i];
      if (item) results.set(`${item.kind}:${item.id}`, r);
    }
    process.stdout.write(`  ${kind}: ${Math.min(i + size, list.length)}/${list.length}\r`);
  }
}
console.log();

const rows = items.map((it) => ({ ...it, ...(results.get(`${it.kind}:${it.id}`) ?? { verdict: "UNREVIEWED", reason: "", better: "" }) }));
const flagged = rows.filter((r) => r.verdict === "FLAG");
const counts = [...new Set(rows.map((r) => r.kind))].map((k) => `${k}: ${rows.filter((r) => r.kind === k && r.verdict === "FLAG").length}/${rows.filter((r) => r.kind === k).length} flagged`);

const md = [
  `# Thai review — copy we wrote`,
  ``,
  `Judge: ${JUDGE} · ${rows.length} strings · ${flagged.length} flagged`,
  ...counts.map((c) => `- ${c}`),
  ``,
  `## Flagged (fix or hand to a Thai speaker)`,
  `| kind | key | English | Thai as written | why | suggested |`,
  `|---|---|---|---|---|---|`,
  ...flagged.map((r) => `| ${r.kind} | ${r.id} | ${r.en.replace(/\|/g, "\\|")} | ${r.th.replace(/\|/g, "\\|")} | ${(r.reason ?? "").replace(/\|/g, "\\|")} | ${(r.better ?? "").replace(/\|/g, "\\|")} |`),
  ``,
  `## Everything (reviewer column is yours)`,
  `| kind | key | English | Thai | model | reviewer |`,
  `|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.kind} | ${r.id} | ${r.en.replace(/\|/g, "\\|")} | ${r.th.replace(/\|/g, "\\|")} | ${r.verdict} | |`),
];
writeFileSync("/tmp/thai-review.md", md.join("\n") + "\n");
writeFileSync("/tmp/thai-review.json", JSON.stringify({ judge: JUDGE, rows }, null, 1));
console.log(`flagged ${flagged.length}/${rows.length}; report /tmp/thai-review.md`);
for (const r of flagged.slice(0, 12)) console.log(`FLAG ${r.kind}/${r.id}: ${r.reason}`);
