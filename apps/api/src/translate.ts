/**
 * Chat translation plus a short cultural note for the reader. Never blocks a send: the caller
 * stores and pushes the original first, then calls translate() and pushes the result when it lands.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { Lang } from "./store.ts";

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
const MODEL = process.env.TRANSLATE_MODEL ?? "claude-haiku-4-5";
const TIMEOUT_MS = 10_000;
const SEPARATOR = "\n---\n";
const NO_NOTE = "NONE";

const LANG_NAME: Record<Lang, string> = { th: "Thai", en: "English" };
const PARTICLES: Record<string, string> = {
  female: "ค่ะ/คะ (female speaker)",
  male: "ครับ (male speaker)",
  neutral: "no gendered particle; keep it friendly and plain",
};

function systemPrompt(from: Lang, to: Lang, register: string, recipientName: string): string {
  return [
    `You translate chat between a Thai local and a visitor in Chiang Mai, ${LANG_NAME[from]} into ${LANG_NAME[to]}.`,
    `The speaker's register is ${register}: use ${PARTICLES[register] ?? PARTICLES.neutral} where a Thai particle fits.`,
    "Sound like a warm, ordinary person texting — not a translator, not a formal letter, not a tourist phrasebook.",
    "Keep names, places, times, prices and numbers exactly as written.",
    `Reply with the translation alone, then a line containing exactly ${SEPARATOR.trim()}, then EITHER one short sentence in ${LANG_NAME[to]} telling the reader something they would otherwise miss (an idiom, a politeness nuance, an implication) OR the single word ${NO_NOTE}.`,
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
