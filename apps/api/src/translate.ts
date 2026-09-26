/**
 * Chat translation plus a short cultural note for the reader. Never blocks a send: the caller
 * stores and pushes the original first, then calls translate() and pushes the result when it lands.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "./store.ts";

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MODEL = process.env.TRANSLATE_MODEL ?? "claude-haiku-4-5";
// Generous: the sender's bubble is pushed before this runs, so a slow translation costs the reader a
// moment of "translating…", never a blocked send. Haiku answers in ~1s, Sonnet in ~3s.
const TIMEOUT_MS = 20_000;
const SEPARATOR = "\n---\n";
const NO_NOTE = "NONE";

const LANG_NAME: Record<Lang, string> = { th: "Thai", en: "English" };
const PARTICLES: Record<string, string> = {
  female: "ค่ะ/คะ (female speaker)",
  male: "ครับ (male speaker)",
  neutral: "no gendered particle; keep it friendly and plain",
};

/**
 * Every rule below exists because an earlier prompt broke it, measured over the fixtures in
 * scripts/qa/translation-test.mjs (which runs this very function):
 *   - Thai particles leaked into English output — "Nice to meet you ค่ะ", "…okay? ค่ะ"
 *   - สี่ทุ่ม (10pm) came back as "4 PM" — Thai counts evening hours in ทุ่ม, not on a 24h dial
 *   - "My Thai isn't very good yet" was flipped into "Your Thai isn't good enough, right?"
 *   - ท่าแพเกท and ถนนเดินเท้า — literal transliterations instead of ประตูท่าแพ and ถนนคนเดิน
 *   - a female pronoun (ฉัน) under a male particle (ครับ)
 * The rules are stated flatly and early; examples live in the fixtures, not here, so the prompt
 * stays short enough to be read at a glance.
 */
function systemPrompt(from: Lang, to: Lang, register: string, recipientName: string): string {
  const source = LANG_NAME[from];
  const target = LANG_NAME[to];
  return [
    `You translate chat between a Thai local and a visitor in Chiang Mai, ${source} into ${target}.`,

    `The speaker's register is ${register}: use ${PARTICLES[register] ?? PARTICLES.neutral} where a Thai particle fits. Keep the speaker's gender in pronouns as well — a male speaker writes ผม, never ฉัน or หนู; a female speaker writes ฉัน or หนู, never ผม.`,
    `Keep the point of view exactly as written. "My Thai is not good yet" is about the speaker (ภาษาไทยของผม/ของฉัน) — never about the other person, and never a question. Do not swap who is doing what.`,

    `The ${target} line contains ${target} only. Never leave ${source} words in it: no ค่ะ or ครับ in an English line, no English words in a Thai line apart from names and places with no Thai form.`,
    `Keep names, places, times, prices and numbers exact. Thai counts evening hours in ทุ่ม (1 ทุ่ม = 7pm, 4 ทุ่ม = 10pm) and daytime in โมง (6 โมงเย็น = 6pm) — convert, do not copy the digit.`,
    `Use the words Thai people actually use — ประตูท่าแพ, ถนนคนเดิน, ข้าวซอย, ตลาดวโรรส — not literal transliterations.`,
    `If the source addresses someone by name, keep that name.`,

    `Write like a warm, ordinary person texting: short, casual, natural — not a translator, not a news report, not a formal letter. In English, carry a Thai particle's tone with ordinary English ("okay?", "by the way") instead of transliterating it as "ya~" or "na ka".`,

    `Reply with the translation alone, then a line containing exactly ${SEPARATOR.trim()}, then EITHER one short sentence in ${target} telling the reader something they would otherwise miss (an idiom, a politeness nuance, an implication) OR the single word ${NO_NOTE}.`,
    `Address the reader as ${recipientName} only if a name is genuinely needed; usually no name is needed.`,
  ].join(" ");
}

export interface TranslationResult { translated: string | null; note: string | null }

export async function translate(
  body: string, from: Lang, to: Lang, register: string, recipientName: string,
): Promise<TranslationResult> {
  if (!client) {
    console.warn("[translate] ANTHROPIC_API_KEY is unset — no translation");
    return { translated: null, note: null };
  }
  if (from === to) return { translated: body, note: null };

  try {
    const res = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(from, to, register, recipientName),
        messages: [{ role: "user", content: body }],
      },
      { timeout: TIMEOUT_MS },
    );
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const [translatedPart, ...noteParts] = text.split(/\n-{3,}\n/);
    const translated = translatedPart?.trim() || null;
    const rawNote = noteParts.join(" ").trim();
    const note = !rawNote || rawNote.toUpperCase() === NO_NOTE ? null : rawNote;

    return { translated, note };
  } catch (err) {
    console.error("[translate] failed:", err instanceof Error ? err.message : err);
    return { translated: null, note: null };
  }
}
