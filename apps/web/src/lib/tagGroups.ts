import type { Tag } from "./contract";

// Which taxonomy heading each tag sits under, copied from reference/tag-taxonomy.md.
// The API's Tag has no group field and the seed has no group column, so the web app groups client-side.
// Order here is display order. A tag id missing from this list still shows, under "other" at the end.
export const TAG_GROUPS = [
  {
    id: "language",
    tagIds: ["thai-language", "thai-reading", "kham-mueang", "english", "english-exams", "business-english", "chinese", "japanese", "korean", "german", "french", "spanish"],
  },
  {
    id: "food",
    tagIds: ["cooking", "street-food", "markets", "western-cooking", "coffee", "craft-beer", "vegetarian-vegan"],
  },
  {
    id: "sport",
    tagIds: ["muay-thai", "sepak-takraw", "hiking", "running", "cycling", "rock-climbing", "scooter", "motorbike-touring", "day-trips", "football", "badminton", "swimming", "golf", "gym-fitness", "yoga"],
  },
  {
    id: "arts",
    tagIds: ["umbrella-painting", "woodcarving", "silverwork", "ceramics", "textiles-dye", "lanterns-krathong", "thai-music", "music", "karaoke", "photography", "drawing-painting", "design"],
  },
  {
    id: "dancing",
    tagIds: ["thai-dance", "hip-hop-dance", "salsa-bachata", "tango", "swing-dance", "ballet-contemporary"],
  },
  {
    id: "culture",
    tagIds: ["temples", "meditation", "festivals", "lanna-history", "western-culture", "thai-massage", "gardening", "pets-animals", "kids-family", "board-games"],
  },
  {
    id: "gettingThingsDone",
    tagIds: ["bureaucracy", "licence-bank", "renting", "healthcare", "thai-apps", "thai-work-culture", "study-work-abroad", "cv-interviews"],
  },
  {
    id: "business",
    tagIds: ["business", "shopee-lazada", "tech-amazon", "digital-marketing", "tech", "ai-tools", "freelancing-remote", "investing", "tourism-hospitality", "cafe-restaurant"],
  },
  {
    id: "students",
    tagIds: ["student-guided-walks", "lecture-swap", "project-feedback", "home-town-visit", "student-club-guest"],
  },
] as const satisfies readonly { id: string; tagIds: readonly string[] }[];

export type TagGroupId = (typeof TAG_GROUPS)[number]["id"] | "other";

export interface TagGroup {
  id: TagGroupId;
  tags: Tag[];
}

const groupOf = new Map<string, TagGroupId>(TAG_GROUPS.flatMap((g) => g.tagIds.map((id) => [id, g.id] as const)));

/** Buckets tags by taxonomy heading, each bucket in sortOrder. Empty groups are dropped. */
export function groupTags(tags: readonly Tag[]): TagGroup[] {
  const order: TagGroupId[] = [...TAG_GROUPS.map((g) => g.id), "other"];
  const buckets = new Map<TagGroupId, Tag[]>(order.map((id) => [id, []]));
  for (const tag of [...tags].sort((a, b) => a.sortOrder - b.sortOrder)) {
    buckets.get(groupOf.get(tag.id) ?? "other")!.push(tag);
  }
  return order.map((id) => ({ id, tags: buckets.get(id)! })).filter((g) => g.tags.length > 0);
}
