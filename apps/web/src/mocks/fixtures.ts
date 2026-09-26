// Mock-mode data, read from the team's seed files (copied in by scripts/sync-mocks.mjs).
import type { Event, Tag } from "@/lib/contract";
import eventSeed from "./seed/events.json";
import tagSeed from "./seed/tags.json";

export { default as demo } from "./seed/demo-profiles.json";

export const TAGS: Tag[] = tagSeed.tags.map((t) => ({
  id: t.id,
  labelEn: t.label_en,
  labelTh: t.label_th,
  sortOrder: t.sort_order,
}));

type SeedEvent = Omit<Event, "going" | "goingCount">;

// The event id in mock mode is the seed's external_id, which is what the demo profiles reference.
export const EVENTS: SeedEvent[] = eventSeed.events.map((e) => ({
  id: e.external_id,
  source: e.source,
  sourceUrl: e.source_url ?? null,
  titleEn: e.title_en,
  titleTh: e.title_th,
  descriptionEn: e.description_en ?? null,
  descriptionTh: e.description_th ?? null,
  startsAt: e.starts_at,
  endsAt: e.ends_at ?? null,
  venueName: e.venue_name ?? "",
  address: e.address ?? "",
  priceText: e.price_text ?? null,
  imageUrl: e.image_url ?? null,
}));
