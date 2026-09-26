#!/usr/bin/env node
/**
 * Translation quality test for the chat path.
 *
 * Runs the app's own translate() — the same prompt and model wiring the api uses — over a fixture
 * set that mirrors what the demo types, then has a stronger model judge every result on meaning,
 * naturalness and politeness register. Objective checks (numbers survive, right particle for the
 * register) run alongside, because a judge can miss a dropped digit.
 *
 *   cd /srv/bpai
 *   TRANSLATE_MODEL=claude-haiku-4-5  node scripts/qa/translation-test.mjs
 *   TRANSLATE_MODEL=claude-sonnet-5   node scripts/qa/translation-test.mjs
 *
 * Writes /tmp/translation-report-<model>.md and .json. Judge model: JUDGE_MODEL (default
 * claude-opus-5). Needs ANTHROPIC_API_KEY in the environment (the api's .env has it).
 */
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

// Imported dynamically so the suite can also run from outside the checkout (TRANSLATE_MODULE).
const { translate } = await import(process.env.TRANSLATE_MODULE ?? "../../apps/api/src/translate.ts");

const MODEL = process.env.TRANSLATE_MODEL ?? "(api default)";
const JUDGE = process.env.JUDGE_MODEL ?? "claude-opus-5";
const STAMP = (process.env.RUN_LABEL ? process.env.RUN_LABEL.replace(/[^\w.-]+/g, "_") + "-" : "") + MODEL.replace(/[^\w.-]+/g, "_");
const anthropic = new Anthropic();

/**
 * en→th is Sam (male) writing to Nok; th→en is Nok (female) writing to Sam.
 * CASES_FILE=lines.json replaces this list, so the lines someone actually plans to type on stage can
 * be run through the same harness:
 *   [{"id":"demo-1","dir":"en→th","register":"male","reader":"Nok","text":"..."}]
 */
const CASES = process.env.CASES_FILE ? JSON.parse(readFileSync(process.env.CASES_FILE, "utf8")) : [
  { id: "greeting", dir: "en→th", register: "male", reader: "Nok", text: "Hi!",
    watch: "a greeting must come out as an idiomatic greeting, never a question word" },
  { id: "weekend", dir: "en→th", register: "male", reader: "Nok", text: "Are you free this weekend?",
    watch: "weekend must not become today/tomorrow", need: /(สุดสัปดาห์|เสาร์|อาทิตย์|วันหยุด)/ },
  { id: "tomorrow", dir: "en→th", register: "male", reader: "Nok", text: "I'll bring the scooter keys tomorrow morning.",
    watch: "tomorrow morning, not today", need: /พรุ่งนี้/ },
  { id: "price", dir: "en→th", register: "male", reader: "Nok", text: "How much is the cooking class?" },
  { id: "place", dir: "en→th", register: "male", reader: "Nok", text: "See you at Tha Phae Gate at 6pm.",
    watch: "the place name must still be the same gate", need: /(ท่าแพ|6|หก)/ },
  { id: "food", dir: "en→th", register: "male", reader: "Nok", text: "I loved the khao soi yesterday!",
    watch: "khao soi stays khao soi; yesterday stays yesterday", need: /(ข้าวซอย)/ },
  { id: "apology", dir: "en→th", register: "male", reader: "Nok", text: "Sorry I'm late, the traffic was terrible." },
  { id: "sunday", dir: "en→th", register: "male", reader: "Nok", text: "Can we meet at the Sunday market?",
    need: /(อาทิตย์|ตลาด)/ },
  { id: "thanks", dir: "en→th", register: "male", reader: "Nok", text: "That sounds great, thank you!" },
  { id: "humble", dir: "en→th", register: "male", reader: "Nok", text: "My Thai isn't very good yet." },
  { id: "numbers", dir: "en→th", register: "male", reader: "Nok", text: "It costs 150 baht for two people.",
    watch: "150 must survive verbatim" },
  { id: "name", dir: "en→th", register: "male", reader: "Nok", text: "Nok, shall we go to the Sunday Walking Street?" },
  { id: "emoji", dir: "en→th", register: "male", reader: "Nok", text: "See you there 😊",
    watch: "the emoji should not be dropped" },
  { id: "affirmative", dir: "th→en", register: "female", reader: "Sam", text: "ได้เลยค่ะ เจอกันตอนเช้านะคะ" },
  { id: "rain", dir: "th→en", register: "female", reader: "Sam", text: "พรุ่งนี้ฝนอาจจะตก เอาร่มมานะคะ",
    watch: "tomorrow + rain + bring an umbrella" },
  { id: "famous-food", dir: "th→en", register: "female", reader: "Sam", text: "ข้าวซอยร้านนี้ดังมาก ลองสิคะ" },
  { id: "busy-today", dir: "th→en", register: "female", reader: "Sam", text: "ขอโทษค่ะ วันนี้ไม่ว่างเลย" },
  { id: "nice-to-meet", dir: "th→en", register: "female", reader: "Sam", text: "ยินดีที่ได้รู้จักค่ะ" },
  { id: "market-hours", dir: "th→en", register: "female", reader: "Sam", text: "ตลาดวโรรสเปิดถึงสี่ทุ่มนะคะ",
    watch: "four tุ่ม = 10pm, not 4pm" },
  { id: "discount", dir: "th→en", register: "female", reader: "Sam", text: "ลดให้หน่อยได้ไหมคะ" },
];

const JUDGE_PROMPT = (c, out) => `You are reviewing one Thai↔English chat translation for a Chiang Mai app that pairs Thai locals with visitors. Judge it as a Thai-speaking reviewer would.

SOURCE (${c.dir.split("→")[0]}): ${c.text}
TRANSLATION (${c.dir.split("→")[1]}): ${out}
SPEAKER: register ${c.register}, writing to ${c.reader}${c.watch ? `\nWATCH FOR: ${c.watch}` : ""}

Score 1-5 on each:
- meaning: same meaning kept — time words (today/tomorrow/weekend), numbers, intent, who is doing what. 5 = exact, 1 = wrong meaning.
- natural: would a Thai person actually text this to a friend? 5 = native, 1 = translator-ese or ungrammatical.
- register: politeness particles right for a ${c.register} speaker and the relationship (Thai text only; score 5 for English output).
Verdict: PASS if every score >= 4, MINOR if the lowest is 3, FAIL if any score <= 2.
Reply with JSON only: {"meaning":n,"natural":n,"register":n,"verdict":"PASS|MINOR|FAIL","reason":"one short sentence in English","better":"a corrected translation, or empty if PASS"}`;

function json(text) {
  const m = text.match(/\{[\s\S]*\}/);
  try { return JSON.parse(m ? m[0] : text); } catch { return null; }
}

const rows = [];
const CASES_TO_RUN = process.env.LIMIT ? CASES.slice(0, Number(process.env.LIMIT)) : CASES;
for (const c of CASES_TO_RUN) {
  let translated = null, note = null;
  try {
    ({ translated, note } = await translate(c.text, c.dir === "en→th" ? "en" : "th", c.dir === "en→th" ? "th" : "en", c.register, c.reader));
  } catch (err) {
    console.error(`translate threw on ${c.id}:`, err?.message ?? err);
  }
  if (!translated) console.error(`no translation for ${c.id} (module ${process.env.TRANSLATE_MODULE ?? "default"}, model ${MODEL})`);
  const out = translated ?? "";

  const checks = [];
  if (c.dir === "en→th") {
    const want = c.register === "male" ? /ครับ/ : /(ค่ะ|คะ)/;
    checks.push([`particle(${c.register})`, want.test(out)]);
  }
  // Thai writes digits as words (6 is หก), so a single digit counts as kept if either form is there.
  const TH_DIGIT = { 0: "ศูนย์", 1: "หนึ่ง", 2: "สอง", 3: "สาม", 4: "สี่", 5: "ห้า", 6: "หก", 7: "เจ็ด", 8: "แปด", 9: "เก้า" };
  for (const n of c.text.match(/\d+/g) ?? []) {
    const ok = out.includes(n) || (c.dir === "en→th" && n.length === 1 && out.includes(TH_DIGIT[n]));
    checks.push([`number ${n}`, ok]);
  }
  if (c.need) checks.push(["expected term", c.need.test(out)]);
  if (/\p{Extended_Pictographic}/u.test(c.text)) checks.push(["emoji kept", /\p{Extended_Pictographic}/u.test(out)]);

  let verdict = { verdict: "ERROR", reason: "no translation returned", better: "", meaning: 0, natural: 0, register: 0 };
  if (out) {
    verdict = { verdict: "UNPARSED", reason: "", better: "", meaning: 0, natural: 0, register: 0 };
    // One retry: a judge that rambles past its JSON must not read as a bad translation.
    for (let attempt = 0; attempt < 2 && verdict.verdict === "UNPARSED"; attempt++) {
      const res = await anthropic.messages.create(
        { model: JUDGE, max_tokens: 700, messages: [{ role: "user", content: JUDGE_PROMPT(c, out) + (attempt ? "\n\nJSON only, no prose, no code fences." : "") }] },
        { timeout: 60_000 },
      );
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      verdict = json(text) ?? { verdict: "UNPARSED", reason: text.slice(0, 120), meaning: 0, natural: 0, register: 0, better: "" };
    }
    if (verdict.verdict === "UNPARSED") verdict = { ...verdict, verdict: "JUDGE-ERROR", reason: "judge output unparseable twice" };
  }
  const failed = checks.filter(([, ok]) => !ok).map(([n]) => n);
  rows.push({ ...c, out, note, verdict: verdict.verdict, scores: [verdict.meaning, verdict.natural, verdict.register],
              reason: verdict.reason, better: verdict.better, failedChecks: failed });
  console.log(`${verdict.verdict.padEnd(8)} ${c.id.padEnd(14)} ${failed.length ? "⚠ " + failed.join(",") : ""}`);
}

const tally = (v) => rows.filter((r) => r.verdict === v).length;
const bad = rows.filter((r) => r.verdict !== "PASS" || r.failedChecks.length);
const lines = [
  `# Translation test — ${MODEL}`,
  ``,
  `Judge: ${JUDGE} · cases: ${rows.length} · PASS ${tally("PASS")} · MINOR ${tally("MINOR")} · FAIL ${tally("FAIL")} · ERROR ${tally("ERROR")}`,
  ``,
  `| case | dir | verdict | scores m/n/r | checks | translation |`,
  `|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.id} | ${r.dir} | ${r.verdict} | ${r.scores.join("/")} | ${r.failedChecks.length ? "⚠ " + r.failedChecks.join(", ") : "ok"} | ${r.out.replace(/\|/g, "\\|")} |`),
  ``,
  `## Needs work`,
  ...(bad.length ? bad.map((r) => [`### ${r.id} (${r.dir}) ${r.verdict}`, `- source: ${r.text}`, `- got: ${r.out}`, `- why: ${r.reason}`, r.better ? `- better: ${r.better}` : null, r.failedChecks.length ? `- failed checks: ${r.failedChecks.join(", ")}` : null].filter(Boolean).join("\n")) : ["none"]),
];
writeFileSync(`/tmp/translation-report-${STAMP}.md`, lines.join("\n") + "\n");
writeFileSync(`/tmp/translation-report-${STAMP}.json`, JSON.stringify({ model: MODEL, judge: JUDGE, rows }, null, 1));
console.log(`\nreport: /tmp/translation-report-${STAMP}.md`);
