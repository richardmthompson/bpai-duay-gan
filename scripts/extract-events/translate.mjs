// Writes the Thai + English title and description for one scraped event with Claude.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.EVENTS_MODEL || "claude-opus-5";

const SYSTEM = `You write event listings for Bpai Dûay Gan, a Chiang Mai app that connects Thai locals and foreigners. Every event is shown in Thai and in English.

From the organizer's announcement, write:
- title_en: the event's own title, lightly cleaned (no emoji, no shouting caps).
- title_th: a natural Thai title. Keep a short English brand name at the start if the event has one.
- description_en / description_th: 3 to 6 short lines. First what it is and who it suits, then what actually happens, then one line on how much English a guest needs (little / conversational / fluent), then 1 to 3 lines starting with "• " for practical first-timer tips (price and what it includes, what to bring or wear, booking, arrival time, house rules; say so if the organizer welcomes locals).
- price_text: short, e.g. "Free", "200 THB incl. drink", "Not stated".
- open_to_locals: false only if the event excludes Thai locals (for example, only for foreign visa holders).

Thai: write the way a friendly Chiang Mai local would tell a friend on LINE. Natural and warm, never translationese or marketing hype, no emoji. Keep venue and brand names in English.
Facts only from the announcement: never invent a price, time, venue or rule.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["open_to_locals", "title_en", "title_th", "description_en", "description_th", "price_text"],
  properties: {
    open_to_locals: { type: "boolean" },
    title_en: { type: "string" },
    title_th: { type: "string" },
    description_en: { type: "string" },
    description_th: { type: "string" },
    price_text: { type: "string" },
  },
};

let client;

export async function translateEvent(announcement) {
  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(announcement) }],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined this event");
  if (response.stop_reason === "max_tokens") throw new Error("Listing came out too long");
  return JSON.parse(response.content.find((b) => b.type === "text")?.text);
}
