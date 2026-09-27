/**
 * Every SQL statement the api runs, mapped from snake_case rows to the camelCase shapes in
 * apps/web/src/lib/contract.ts — which is the authoritative statement of the contract.
 */
import { one, q, tx } from "@bpai/db";
import { translateProfileText } from "./translate.ts";

export type Lang = "th" | "en";
export type Community = "local" | "foreigner";
export type Gender = "male" | "female" | "other" | "undisclosed";
type Register = "male" | "female" | "neutral";

/**
 * Gender is what people set; politeness_register is what the translation prompt reads (ครับ / ค่ะ).
 * Every save that carries a gender writes the register from this map, so the two never disagree.
 */
const REGISTER_FOR_GENDER: Record<Gender, Register> = {
  male: "male", female: "female", other: "neutral", undisclosed: "neutral",
};
const isGender = (v: unknown): v is Gender => typeof v === "string" && Object.keys(REGISTER_FOR_GENDER).includes(v);

export interface Tag { id: string; labelEn: string; labelTh: string; sortOrder: number }

export interface Me {
  userId: string; email: string | null; displayName: string; community: Community | null;
  interfaceLanguage: Lang; speaksLanguage: Lang; politenessRegister: string | null;
  gender: Gender | null; interestsText: string; avatarUrl: string | null; onboardingComplete: boolean;
  give: string[]; learn: string[];
}

export interface PersonSummary {
  userId: string; displayName: string; community: Community; avatarUrl: string | null;
}

export interface EventSummary { id: string; titleEn: string; titleTh: string; startsAt: string }

export interface Event extends EventSummary {
  source: string; sourceUrl: string | null; descriptionEn: string | null; descriptionTh: string | null;
  endsAt: string | null; venueName: string; address: string; priceText: string | null;
  imageUrl: string | null; going: boolean; goingCount: number;
}

export interface EventDetail extends Event { attendees: PersonSummary[] }

export interface MatchedTag { tagId: string; side: "theyGive" | "youGive" }

export interface Candidate extends PersonSummary {
  score: number; interestsText: string; give: string[]; learn: string[];
  /** The same bio in the other language, when we have it. Null falls back to interestsText. */
  interestsTextTranslated: string | null;
  matchedTags: MatchedTag[]; sharedEvents: EventSummary[];
}

export type Relationship =
  | { kind: "none" }
  | { kind: "requestSent"; requestId: string }
  | { kind: "requestReceived"; requestId: string }
  | { kind: "matched"; matchId: string };

export interface PublicProfile extends Candidate {
  goingEvents: EventSummary[];
  relationship: Relationship;
}

export interface MatchRequest {
  id: string; fromUserId: string; toUserId: string; direction: "incoming" | "outgoing";
  other: PersonSummary; event: EventSummary | null; note: string | null;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string; matchId: string | null;
}

export interface Message {
  id: string; matchId: string; senderId: string; clientMsgId: string | null;
  bodyOriginal: string; langOriginal: Lang; bodyTranslated: string | null;
  langTranslated: Lang | null; culturalNote: string | null;
  translationStatus: "pending" | "done" | "failed"; createdAt: string;
}

export interface MatchSummary {
  id: string; other: PersonSummary; lastMessage: Message | null; unreadCount: number;
}

export interface Notification {
  id: string; kind: "match_request" | "match_accepted" | "message";
  data: Record<string, string | undefined>; readAt: string | null; createdAt: string;
}

export interface Page<T> { items: T[]; nextCursor: string | null }

export interface DemoAccount {
  userId: string; email: string; displayName: string; community: Community; interfaceLanguage: Lang;
}

const PAGE_SIZE = 20;

class CodedError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}
export function httpError(code: string, message: string): Error { return new CodedError(code, message); }

// ── row types and mappers ────────────────────────────────────────────────────────────────────

interface PersonRow { user_id: string; display_name: string; community: Community; avatar_url: string | null }
interface EventRow {
  id: string; source: string; external_id: string; source_url: string | null;
  title_en: string; title_th: string; description_en: string | null; description_th: string | null;
  starts_at: Date; ends_at: Date | null; venue_name: string | null; address: string | null;
  price_text: string | null; image_url: string | null;
  going?: boolean; going_count?: string | number;
}
interface CandidateRow extends PersonRow {
  interests_text: string; interests_text_translated: string | null; created_at: Date;
}
interface MessageRow {
  id: string; match_id: string; sender_id: string; client_msg_id: string | null;
  body_original: string; lang_original: Lang; body_translated: string | null;
  lang_translated: Lang | null; cultural_note: string | null;
  translation_status: "pending" | "done" | "failed"; created_at: Date;
}
interface RequestRow {
  id: string; from_user: string; to_user: string; event_id: string | null; note: string | null;
  status: MatchRequest["status"]; match_id: string | null; created_at: Date;
  from_name: string; from_community: Community; from_avatar: string | null;
  to_name: string; to_community: Community; to_avatar: string | null;
}
interface NotificationRow {
  id: string; kind: Notification["kind"]; data: Record<string, string> | null;
  read_at: Date | null; created_at: Date;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toPerson(r: PersonRow): PersonSummary {
  return { userId: r.user_id, displayName: r.display_name, community: r.community, avatarUrl: r.avatar_url };
}
function toEventSummary(r: EventRow): EventSummary {
  return { id: r.id, titleEn: r.title_en, titleTh: r.title_th, startsAt: r.starts_at.toISOString() };
}
function toEvent(r: EventRow): Event {
  return {
    ...toEventSummary(r), source: r.source, sourceUrl: r.source_url,
    descriptionEn: r.description_en, descriptionTh: r.description_th,
    endsAt: iso(r.ends_at), venueName: r.venue_name ?? "", address: r.address ?? "",
    priceText: r.price_text, imageUrl: r.image_url,
    going: Boolean(r.going), goingCount: Number(r.going_count ?? 0),
  };
}
function toMessage(r: MessageRow): Message {
  return {
    id: r.id, matchId: r.match_id, senderId: r.sender_id, clientMsgId: r.client_msg_id,
    bodyOriginal: r.body_original, langOriginal: r.lang_original,
    bodyTranslated: r.body_translated, langTranslated: r.lang_translated,
    culturalNote: r.cultural_note, translationStatus: r.translation_status,
    createdAt: r.created_at.toISOString(),
  };
}
function toNotification(r: NotificationRow): Notification {
  return {
    id: r.id, kind: r.kind, data: r.data ?? {}, readAt: iso(r.read_at),
    createdAt: r.created_at.toISOString(),
  };
}

// ── tags ─────────────────────────────────────────────────────────────────────────────────────

export async function listTags(): Promise<Tag[]> {
  const rows = await q<{ id: string; label_en: string; label_th: string; sort_order: number }>(
    "select id, label_en, label_th, sort_order from tags order by sort_order, id");
  return rows.map((r) => ({ id: r.id, labelEn: r.label_en, labelTh: r.label_th, sortOrder: r.sort_order }));
}

async function tagsFor(userId: string): Promise<{ give: string[]; learn: string[] }> {
  const rows = await q<{ tag_id: string; direction: string }>(
    "select tag_id, direction from profile_tags where user_id = $1", [userId]);
  return {
    give: rows.filter((r) => r.direction === "give").map((r) => r.tag_id),
    learn: rows.filter((r) => r.direction === "learn").map((r) => r.tag_id),
  };
}

// ── me ───────────────────────────────────────────────────────────────────────────────────────

export async function getMe(userId: string): Promise<Me | null> {
  const row = await one<{
    user_id: string; email: string | null; display_name: string; community: Community | null;
    interface_language: Lang; speaks_language: Lang; politeness_register: string | null;
    gender: Gender | null; interests_text: string; avatar_url: string | null; onboarding_complete: boolean;
  }>(
    `select p.user_id, u.email, p.display_name, p.community, p.interface_language, p.speaks_language,
            p.politeness_register, p.gender, p.interests_text, p.avatar_url, p.onboarding_complete
     from profiles p join users u on u.id = p.user_id where p.user_id = $1`, [userId]);

  if (!row) {
    // Signed in but not onboarded yet: the app still needs a Me so it can route to /onboarding.
    const account = await one<{ email: string | null; name: string | null; image: string | null }>(
      "select email, name, image from users where id = $1", [userId]);
    if (!account) return null;
    return {
      userId, email: account.email,
      displayName: account.name ?? account.email?.split("@")[0] ?? "Someone",
      community: null, interfaceLanguage: "th", speaksLanguage: "th", politenessRegister: null,
      gender: null, interestsText: "", avatarUrl: account.image, onboardingComplete: false, give: [], learn: [],
    };
  }

  const tags = await tagsFor(userId);
  return {
    userId: row.user_id, email: row.email, displayName: row.display_name, community: row.community,
    interfaceLanguage: row.interface_language, speaksLanguage: row.speaks_language,
    politenessRegister: row.politeness_register, gender: row.gender, interestsText: row.interests_text,
    avatarUrl: row.avatar_url, onboardingComplete: row.onboarding_complete,
    give: tags.give, learn: tags.learn,
  };
}

const ME_COLUMNS: Record<string, string> = {
  displayName: "display_name", community: "community", interfaceLanguage: "interface_language",
  speaksLanguage: "speaks_language", gender: "gender", politenessRegister: "politeness_register",
  interestsText: "interests_text", avatarUrl: "avatar_url",
};

/** Partial update: only the fields present are touched. Creates the profile row on first save. */
export async function putMe(userId: string, update: Record<string, unknown>): Promise<Me> {
  const account = await one<{ email: string | null; name: string | null }>(
    "select email, name from users where id = $1", [userId]);
  if (!account) throw httpError("not_found", "no such user");

  // The register is never taken from the client: it follows gender, and only when gender is saved.
  const fields: Record<string, unknown> = { ...update, politenessRegister: undefined };
  if (fields.gender !== undefined && fields.gender !== null) {
    if (!isGender(fields.gender)) throw httpError("invalid", "gender must be male, female, other or undisclosed");
    fields.politenessRegister = REGISTER_FOR_GENDER[fields.gender];
  }

  const columns: string[] = [];
  const values: unknown[] = [];
  for (const [key, column] of Object.entries(ME_COLUMNS)) {
    if (!(key in fields) || fields[key] === undefined || fields[key] === null) continue;
    columns.push(column);
    values.push(fields[key]);
  }

  if (columns.length) {
    // Update first, insert only when there is no row. An upsert cannot do this: Postgres checks
    // the proposed insert row's not-null columns (community) before it finds the conflict, so
    // any save that did not carry every required column failed, even for an existing profile.
    const sets = columns.map((c, i) => `${c} = $${i + 2}`);
    const updated = await q(
      `update profiles set ${sets.join(", ")}, onboarding_complete = true where user_id = $1 returning user_id`,
      [userId, ...values]);
    if (!updated.length) {
      const fallbackName = account.name ?? account.email?.split("@")[0] ?? "Someone";
      const named = columns.includes("display_name");
      const cols = named ? columns : ["display_name", ...columns];
      const vals = named ? values : [fallbackName, ...values];
      await q(
        `insert into profiles (user_id, ${cols.join(", ")}, onboarding_complete)
         values ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}, true)
         on conflict (user_id) do nothing`,
        [userId, ...vals]);
    }
  } else if (!(await one("select 1 from profiles where user_id = $1", [userId]))) {
    throw httpError("invalid", "nothing to save");
  }

  // The bio's copy in the other language is written here, once, rather than while serving a card:
  // one Browse page is twenty cards, and twenty model calls is not a page load anyone can pay for.
  // Deliberately not awaited — a save should not wait three seconds on a translator, and a card
  // that arrives before this lands just shows the original.
  if (typeof fields.interestsText === "string") {
    void refreshTranslatedBio(userId).catch(() => {});
  }

  const me = await getMe(userId);
  if (!me) throw httpError("internal", "profile vanished after save");
  return me;
}

/**
 * Fills interests_text_translated for one profile, in the direction its author does not write.
 * Best effort throughout: anything that fails leaves the column null and the reader sees the
 * original. Used by a save and by scripts/seed/translate-bios.mjs.
 */
export async function refreshTranslatedBio(userId: string): Promise<string | null> {
  const row = await one<{ interests_text: string; speaks_language: Lang }>(
    "select interests_text, speaks_language from profiles where user_id = $1", [userId]);
  if (!row || !row.interests_text.trim()) return null;
  const to: Lang = row.speaks_language === "th" ? "en" : "th";
  const translated = await translateProfileText(row.interests_text, row.speaks_language, to);
  if (!translated) return null;
  await q("update profiles set interests_text_translated = $2 where user_id = $1", [userId, translated]);
  return translated;
}

/**
 * Sets (or with null, clears) the profile photo and returns the url it replaced, read under a row
 * lock so two quick uploads cannot both see the same "previous" and leave one file orphaned.
 * PUT /me ignores null fields, so this is the only way avatar_url goes back to empty.
 */
export async function setAvatarUrl(userId: string, url: string | null): Promise<string | null> {
  return tx(async (c) => {
    const { rows } = await c.query("select avatar_url from profiles where user_id = $1 for update", [userId]);
    if (!rows.length) throw httpError("not_found", "finish your profile before adding a photo");
    await c.query("update profiles set avatar_url = $2 where user_id = $1", [userId, url]);
    return (rows[0] as { avatar_url: string | null }).avatar_url;
  });
}

export async function putMyTags(userId: string, sel: { give: string[]; learn: string[] }): Promise<Me> {
  const wanted = [...new Set([...sel.give, ...sel.learn])];
  if (wanted.length) {
    const found = await q<{ id: string }>("select id from tags where id = any($1)", [wanted]);
    const known = new Set(found.map((r) => r.id));
    const unknown = wanted.filter((t) => !known.has(t));
    if (unknown.length) throw httpError("invalid", `unknown tag(s): ${unknown.join(", ")}`);
  }
  await tx(async (c) => {
    await c.query("delete from profile_tags where user_id = $1", [userId]);
    for (const [direction, list] of [["give", sel.give], ["learn", sel.learn]] as const) {
      for (const tagId of list) {
        await c.query(
          "insert into profile_tags (user_id, tag_id, direction) values ($1,$2,$3) on conflict do nothing",
          [userId, tagId, direction]);
      }
    }
  });
  const me = await getMe(userId);
  if (!me) throw httpError("not_found", "no profile to attach tags to");
  return me;
}

// ── browse / people ──────────────────────────────────────────────────────────────────────────

interface Scored {
  candidate: Candidate;
  complementary: number;
  shared: number;
  sameSide: number;
  created: number;
}

/**
 * Ranking, in plain code rather than one nested SQL statement: it is four rules with a
 * documented expected order (scripts/seed/profiles/README.md), the whole community is a few
 * dozen rows, and this is far easier to verify than a CTE that Postgres may refuse to type-infer.
 */
async function scoreCandidates(viewerId: string, rows: CandidateRow[]): Promise<Scored[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.user_id);
  const myTags = await tagsFor(viewerId);
  const giveSet = new Set(myTags.give);
  const learnSet = new Set(myTags.learn);

  const [theirTags, myGoing, theirGoing] = await Promise.all([
    q<{ user_id: string; tag_id: string; direction: string }>(
      "select user_id, tag_id, direction from profile_tags where user_id = any($1)", [ids]),
    q<{ event_id: string }>("select event_id from event_attendance where user_id = $1", [viewerId]),
    q<{ user_id: string; event_id: string }>(
      "select user_id, event_id from event_attendance where user_id = any($1)", [ids]),
  ]);

  const myEvents = new Set(myGoing.map((r) => r.event_id));
  const giveByUser = new Map<string, string[]>();
  const learnByUser = new Map<string, string[]>();
  for (const t of theirTags) {
    const map = t.direction === "give" ? giveByUser : learnByUser;
    map.set(t.user_id, [...(map.get(t.user_id) ?? []), t.tag_id]);
  }

  const sharedIds = new Map<string, string[]>();
  for (const row of theirGoing) {
    if (!myEvents.has(row.event_id)) continue;
    sharedIds.set(row.user_id, [...(sharedIds.get(row.user_id) ?? []), row.event_id]);
  }
  const eventIds = [...new Set([...sharedIds.values()].flat())];
  const eventRows = eventIds.length
    ? await q<EventRow>("select * from events where id = any($1) order by starts_at", [eventIds])
    : [];
  const eventById = new Map(eventRows.map((e) => [e.id, e]));

  return rows.map((row) => {
    const give = giveByUser.get(row.user_id) ?? [];
    const learn = learnByUser.get(row.user_id) ?? [];
    const matchedTags: MatchedTag[] = [
      ...give.filter((t) => learnSet.has(t)).map((tagId) => ({ tagId, side: "theyGive" as const })),
      ...learn.filter((t) => giveSet.has(t)).map((tagId) => ({ tagId, side: "youGive" as const })),
    ];
    const sameSide =
      give.filter((t) => giveSet.has(t)).length + learn.filter((t) => learnSet.has(t)).length;
    const sharedEvents = (sharedIds.get(row.user_id) ?? [])
      .map((id) => eventById.get(id))
      .filter((e): e is EventRow => Boolean(e))
      .map(toEventSummary);

    const candidate: Candidate = {
      ...toPerson(row),
      score: sharedEvents.length * 100 + matchedTags.length * 10,
      interestsText: row.interests_text,
      interestsTextTranslated: row.interests_text_translated,
      give, learn, matchedTags, sharedEvents,
    };
    return {
      candidate,
      complementary: matchedTags.length,
      shared: sharedEvents.length,
      sameSide,
      created: row.created_at.getTime(),
    };
  });
}

/**
 * Shared events first, then complementary overlap, then same-side overlap; ties newest first.
 * Two people going to the same event already have a time, a place and a reason to meet, so
 * that outranks any number of matched tags (issue #3).
 */
function byRank(a: Scored, b: Scored): number {
  return b.shared - a.shared || b.complementary - a.complementary || b.sameSide - a.sameSide ||
    b.created - a.created;
}

export async function browse(viewerId: string, cursor: string | null): Promise<Page<Candidate>> {
  const offset = Math.max(0, Number(cursor ?? 0) || 0);
  const viewer = await one<{ community: Community }>(
    "select community from profiles where user_id = $1", [viewerId]);
  if (!viewer) return { items: [], nextCursor: null };

  const rows = await q<CandidateRow>(
    `select p.user_id, p.display_name, p.avatar_url, p.community, p.interests_text,
              p.interests_text_translated, p.created_at
     from profiles p
     where p.community <> $2 and p.onboarding_complete and p.user_id <> $1
       and p.user_id not in (
         select blocked_id as uid from blocks where blocker_id = $1
         union select blocker_id as uid from blocks where blocked_id = $1
       )
       -- Someone already matched with you, or waiting on a request either way, is not a
       -- candidate again: the deck must never offer a match you already have. A declined
       -- request is deliberately absent from this list, so that person can come back.
       and p.user_id not in (
         select case when m.a_user = $1 then m.b_user else m.a_user end
         from matches m where $1 in (m.a_user, m.b_user)
         union
         select case when r.from_user = $1 then r.to_user else r.from_user end
         from match_requests r
         where r.status = 'pending' and $1 in (r.from_user, r.to_user)
       )`,
    [viewerId, viewer.community]);
  if (!rows.length) return { items: [], nextCursor: null };

  const scored = (await scoreCandidates(viewerId, rows)).sort(byRank);
  const page = scored.slice(offset, offset + PAGE_SIZE).map((s) => s.candidate);
  const hasMore = scored.length > offset + PAGE_SIZE;
  return { items: page, nextCursor: hasMore ? String(offset + PAGE_SIZE) : null };
}

export async function relationship(viewerId: string, otherId: string): Promise<Relationship> {
  const match = await one<{ id: string }>(
    `select id from matches
     where (a_user = $1 and b_user = $2) or (a_user = $2 and b_user = $1)`, [viewerId, otherId]);
  if (match) return { kind: "matched", matchId: match.id };

  const pending = await one<{ id: string; from_user: string }>(
    `select id, from_user from match_requests
     where status = 'pending' and ((from_user = $1 and to_user = $2) or (from_user = $2 and to_user = $1))
     order by created_at desc limit 1`, [viewerId, otherId]);
  if (pending) {
    return pending.from_user === viewerId
      ? { kind: "requestSent", requestId: pending.id }
      : { kind: "requestReceived", requestId: pending.id };
  }
  return { kind: "none" };
}

export async function getPublicProfile(viewerId: string, userId: string): Promise<PublicProfile | null> {
  const row = await one<CandidateRow>(
    `select p.user_id, p.display_name, p.avatar_url, p.community, p.interests_text,
              p.interests_text_translated, p.created_at
     from profiles p where p.user_id = $1`, [userId]);
  if (!row) return null;

  const [scored] = await scoreCandidates(viewerId, [row]);
  const going = await q<EventRow>(
    `select e.* from event_attendance a join events e on e.id = a.event_id
     where a.user_id = $1 order by e.starts_at`, [userId]);

  return {
    ...scored.candidate,
    goingEvents: going.map(toEventSummary),
    relationship: await relationship(viewerId, userId),
  };
}

// ── match requests ───────────────────────────────────────────────────────────────────────────

const REQUEST_SELECT = `
  select r.*,  f.display_name as from_name, f.community as from_community, f.avatar_url as from_avatar,
               t.display_name as to_name,   t.community as to_community,   t.avatar_url as to_avatar
  from match_requests r
  join profiles f on f.user_id = r.from_user
  join profiles t on t.user_id = r.to_user`;

function toRequest(r: RequestRow, viewerId: string, event: EventSummary | null): MatchRequest {
  const incoming = r.to_user === viewerId;
  return {
    id: r.id, fromUserId: r.from_user, toUserId: r.to_user,
    direction: incoming ? "incoming" : "outgoing",
    other: incoming
      ? { userId: r.from_user, displayName: r.from_name, community: r.from_community, avatarUrl: r.from_avatar }
      : { userId: r.to_user, displayName: r.to_name, community: r.to_community, avatarUrl: r.to_avatar },
    event, note: r.note, status: r.status, createdAt: r.created_at.toISOString(), matchId: r.match_id,
  };
}

async function eventSummaryById(id: string | null): Promise<EventSummary | null> {
  if (!id) return null;
  const row = await one<EventRow>("select * from events where id = $1", [id]);
  return row ? toEventSummary(row) : null;
}

export async function sendRequest(
  from: string,
  input: { toUserId: string; eventId?: string | null; note?: string | null },
): Promise<MatchRequest> {
  const target = await one<PersonRow>(
    "select user_id, display_name, community, avatar_url from profiles where user_id = $1", [input.toUserId]);
  if (!target) throw httpError("not_found", "no such person");
  if (input.toUserId === from) throw httpError("invalid", "you cannot ask yourself");

  const rel = await relationship(from, input.toUserId);
  if (rel.kind === "matched") throw httpError("already_matched", "you are already matched");
  if (rel.kind === "requestSent") throw httpError("already_asked", "you already asked them");
  if (rel.kind === "requestReceived") throw httpError("already_asked", "they already asked you");

  const created = await one<{ id: string }>(
    `insert into match_requests (from_user, to_user, event_id, note) values ($1,$2,$3,$4) returning id`,
    [from, input.toUserId, input.eventId ?? null, input.note ?? null]);
  if (!created) throw httpError("internal", "could not create the request");

  const row = await one<RequestRow>(`${REQUEST_SELECT} where r.id = $1`, [created.id]);
  if (!row) throw httpError("internal", "request vanished");
  return toRequest(row, from, await eventSummaryById(row.event_id));
}

export async function listRequests(userId: string): Promise<MatchRequest[]> {
  const rows = await q<RequestRow>(
    `${REQUEST_SELECT} where r.from_user = $1 or r.to_user = $1 order by r.created_at desc`, [userId]);
  const events = new Map<string, EventSummary>();
  for (const row of rows) {
    if (row.event_id && !events.has(row.event_id)) {
      const summary = await eventSummaryById(row.event_id);
      if (summary) events.set(row.event_id, summary);
    }
  }
  return rows.map((r) => toRequest(r, userId, r.event_id ? events.get(r.event_id) ?? null : null));
}

export async function resolveRequest(
  userId: string, requestId: string, accept: boolean,
): Promise<{ request: MatchRequest; matchId: string | null; fromUserId: string }> {
  const out = await tx(async (c) => {
    const { rows } = await c.query("select * from match_requests where id = $1 for update", [requestId]);
    const r = rows[0] as RequestRow | undefined;
    if (!r) throw httpError("not_found", "no such request");
    if (r.to_user !== userId) throw httpError("forbidden", "not yours to answer");
    if (r.status !== "pending") throw httpError("conflict", `already ${r.status}`);

    let matchId: string | null = null;
    if (accept) {
      const a = r.from_user < r.to_user ? r.from_user : r.to_user;
      const b = r.from_user < r.to_user ? r.to_user : r.from_user;
      const ins = await c.query(
        `insert into matches (a_user, b_user) values ($1,$2)
         on conflict (a_user, b_user) do update set a_user = excluded.a_user returning id`, [a, b]);
      matchId = ins.rows[0].id as string;
    }
    await c.query("update match_requests set status = $2, match_id = $3 where id = $1",
      [requestId, accept ? "accepted" : "declined", matchId]);
    return { matchId, fromUserId: r.from_user as string };
  });

  const row = await one<RequestRow>(`${REQUEST_SELECT} where r.id = $1`, [requestId]);
  if (!row) throw httpError("internal", "request vanished");
  return {
    request: toRequest(row, userId, await eventSummaryById(row.event_id)),
    matchId: out.matchId, fromUserId: out.fromUserId,
  };
}

// ── matches and messages ─────────────────────────────────────────────────────────────────────

export async function listMatches(userId: string): Promise<MatchSummary[]> {
  const rows = await q<{
    id: string; other_id: string; display_name: string; community: Community; avatar_url: string | null;
    unread: string;
  }>(
    `select m.id,
            p.user_id as other_id, p.display_name, p.community, p.avatar_url,
            (select count(*) from messages msg
              where msg.match_id = m.id and msg.sender_id <> $1 and msg.read_at is null) as unread
     from matches m
     join profiles p on p.user_id = case when m.a_user = $1 then m.b_user else m.a_user end
     where $1 in (m.a_user, m.b_user)
     order by m.created_at desc`, [userId]);

  const out: MatchSummary[] = [];
  for (const r of rows) {
    const last = await one<MessageRow>(
      "select * from messages where match_id = $1 order by created_at desc limit 1", [r.id]);
    out.push({
      id: r.id,
      other: { userId: r.other_id, displayName: r.display_name, community: r.community, avatarUrl: r.avatar_url },
      lastMessage: last ? toMessage(last) : null,
      unreadCount: Number(r.unread),
    });
  }
  return out;
}

export async function participants(matchId: string): Promise<string[] | null> {
  const m = await one<{ a_user: string; b_user: string }>("select a_user, b_user from matches where id = $1", [matchId]);
  return m ? [m.a_user, m.b_user] : null;
}

export async function getMessages(matchId: string, before: string | null): Promise<Page<Message>> {
  const rows = await q<MessageRow>(
    `select * from (
       select * from messages
       where match_id = $1 and ($2::timestamptz is null or created_at < $2::timestamptz)
       order by created_at desc limit $3
     ) recent order by created_at asc`,
    [matchId, before, PAGE_SIZE + 1]);

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(1) : rows;
  return { items: items.map(toMessage), nextCursor: hasMore ? items[0].created_at.toISOString() : null };
}

export async function insertMessage(
  matchId: string, senderId: string, input: { body: string; lang: Lang; clientMsgId?: string | null },
): Promise<{ message: Message; duplicate: boolean }> {
  if (input.clientMsgId) {
    const existing = await one<MessageRow>(
      "select * from messages where match_id = $1 and client_msg_id = $2", [matchId, input.clientMsgId]);
    if (existing) return { message: toMessage(existing), duplicate: true };
  }
  const other = (await participants(matchId))?.find((id) => id !== senderId);
  const otherProfile = other
    ? await one<{ speaks_language: Lang }>("select speaks_language from profiles where user_id = $1", [other])
    : null;
  const target: Lang = otherProfile?.speaks_language ?? (input.lang === "th" ? "en" : "th");

  const row = await one<MessageRow>(
    `insert into messages (match_id, sender_id, client_msg_id, body_original, lang_original, lang_translated, translation_status)
     values ($1,$2,$3,$4,$5,$6,'pending') returning *`,
    [matchId, senderId, input.clientMsgId ?? null, input.body, input.lang, target]);
  if (!row) throw httpError("internal", "could not store the message");
  return { message: toMessage(row), duplicate: false };
}

export async function saveTranslation(
  messageId: string, translated: string | null, note: string | null, failed = false,
): Promise<Message | null> {
  const row = await one<MessageRow>(
    `update messages
     set body_translated = $2, cultural_note = $3, translation_status = $4
     where id = $1 returning *`,
    [messageId, translated, note, failed ? "failed" : "done"]);
  return row ? toMessage(row) : null;
}

export async function markRead(matchId: string, readerId: string, upToMessageId: string | null): Promise<void> {
  if (upToMessageId) {
    await q(
      `update messages set read_at = now()
       where match_id = $1 and sender_id <> $2 and read_at is null
         and created_at <= (select created_at from messages where id = $3)`,
      [matchId, readerId, upToMessageId]);
  } else {
    await q("update messages set read_at = now() where match_id = $1 and sender_id <> $2 and read_at is null",
      [matchId, readerId]);
  }
}

export async function senderProfile(senderId: string): Promise<{ lang: Lang; register: string; name: string } | null> {
  const row = await one<{ speaks_language: Lang; politeness_register: string; display_name: string }>(
    "select speaks_language, politeness_register, display_name from profiles where user_id = $1", [senderId]);
  return row ? { lang: row.speaks_language, register: row.politeness_register, name: row.display_name } : null;
}

// ── events ───────────────────────────────────────────────────────────────────────────────────

const EVENT_SELECT = `
  select e.*, (a.user_id is not null) as going,
         (select count(*) from event_attendance x where x.event_id = e.id) as going_count
  from events e
  left join event_attendance a on a.event_id = e.id and a.user_id = $1`;

export async function listEvents(viewerId: string): Promise<Event[]> {
  const rows = await q<EventRow>(
    `${EVENT_SELECT}
     where coalesce(e.ends_at, e.starts_at + interval '3 hours') > now() - interval '12 hours'
     order by e.starts_at`, [viewerId]);
  return rows.map(toEvent);
}

export async function getEvent(viewerId: string, eventId: string): Promise<EventDetail | null> {
  const row = await one<EventRow>(`${EVENT_SELECT} where e.id = $2`, [viewerId, eventId]);
  if (!row) return null;
  const me = await one<{ community: Community }>("select community from profiles where user_id = $1", [viewerId]);
  const attendees = await q<PersonRow>(
    `select p.user_id, p.display_name, p.community, p.avatar_url
     from event_attendance a join profiles p on p.user_id = a.user_id
     where a.event_id = $1 and p.community <> $2
     order by p.display_name`, [eventId, me?.community ?? "foreigner"]);
  return { ...toEvent(row), attendees: attendees.map(toPerson) };
}

export async function setGoing(userId: string, eventId: string, going: boolean): Promise<void> {
  if (going) {
    await q("insert into event_attendance (user_id, event_id) values ($1,$2) on conflict do nothing", [userId, eventId]);
  } else {
    await q("delete from event_attendance where user_id = $1 and event_id = $2", [userId, eventId]);
  }
}

export async function upsertEvents(rows: Record<string, unknown>[]): Promise<{ inserted: number; updated: number }> {
  return tx(async (c) => {
    let inserted = 0;
    let updated = 0;
    for (const e of rows) {
      const res = await c.query(
        `insert into events (source, external_id, source_url, title_en, title_th, description_en,
                             description_th, starts_at, ends_at, venue_name, address, price_text, image_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         on conflict (source, external_id) do update set
           source_url = excluded.source_url, title_en = excluded.title_en, title_th = excluded.title_th,
           description_en = excluded.description_en, description_th = excluded.description_th,
           starts_at = excluded.starts_at, ends_at = excluded.ends_at, venue_name = excluded.venue_name,
           address = excluded.address, price_text = excluded.price_text, image_url = excluded.image_url
         returning (xmax = 0) as was_insert`,
        [e.source, e.external_id, e.source_url ?? null, e.title_en, e.title_th,
         e.description_en ?? null, e.description_th ?? null, e.starts_at, e.ends_at ?? null,
         e.venue_name ?? null, e.address ?? null, e.price_text ?? null, e.image_url ?? null]);
      if (res.rows[0]?.was_insert) inserted += 1; else updated += 1;
    }
    return { inserted, updated };
  });
}

// ── safety ───────────────────────────────────────────────────────────────────────────────────

export async function block(blocker: string, blocked: string): Promise<void> {
  if (blocker === blocked) throw httpError("invalid", "you cannot block yourself");
  await q("insert into blocks (blocker_id, blocked_id) values ($1,$2) on conflict do nothing", [blocker, blocked]);
}

export async function report(
  reporter: string, input: { userId: string; reason: string; matchId?: string | null },
): Promise<void> {
  await q("insert into reports (reporter_id, reported_id, match_id, reason) values ($1,$2,$3,$4)",
    [reporter, input.userId, input.matchId ?? null, input.reason]);
}

// ── notifications ────────────────────────────────────────────────────────────────────────────

export async function notify(
  userId: string, kind: Notification["kind"], data: Record<string, string | undefined>,
): Promise<Notification> {
  const row = await one<NotificationRow>(
    `insert into notifications (user_id, kind, data) values ($1,$2,$3) returning *`,
    [userId, kind, JSON.stringify(data)]);
  if (!row) throw httpError("internal", "could not record the notification");
  return toNotification(row);
}

export async function listNotifications(userId: string): Promise<{ items: Notification[]; unreadCount: number }> {
  const rows = await q<NotificationRow>(
    "select * from notifications where user_id = $1 order by created_at desc limit 50", [userId]);
  const items = rows.map(toNotification);
  return { items, unreadCount: items.filter((i) => !i.readAt).length };
}

export async function markNotificationsRead(userId: string, ids: string[] | "all"): Promise<void> {
  if (ids === "all") {
    await q("update notifications set read_at = now() where user_id = $1 and read_at is null", [userId]);
  } else if (ids.length) {
    await q("update notifications set read_at = now() where user_id = $1 and id = any($2)", [userId, ids]);
  }
}

// ── sign-in ──────────────────────────────────────────────────────────────────────────────────

export async function demoAccount(email: string): Promise<DemoAccount | null> {
  const row = await one<{
    user_id: string; email: string; display_name: string; community: Community; interface_language: Lang;
  }>(
    `select p.user_id, u.email, p.display_name, p.community, p.interface_language
     from profiles p join users u on u.id = p.user_id
     where p.demo_account and lower(u.email) = lower($1)`, [email]);
  if (!row) return null;
  return {
    userId: row.user_id, email: row.email, displayName: row.display_name,
    community: row.community, interfaceLanguage: row.interface_language,
  };
}

export async function listDemoAccounts(): Promise<DemoAccount[]> {
  const rows = await q<{
    user_id: string; email: string; display_name: string; community: Community; interface_language: Lang;
  }>(
    `select p.user_id, u.email, p.display_name, p.community, p.interface_language
     from profiles p join users u on u.id = p.user_id
     where p.demo_account order by p.created_at desc`);
  return rows.map((r) => ({
    userId: r.user_id, email: r.email, displayName: r.display_name,
    community: r.community, interfaceLanguage: r.interface_language,
  }));
}

export async function createMagicToken(email: string): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await q("delete from verification_token where identifier = $1", [email]);
  await q(`insert into verification_token (identifier, token, expires)
           values ($1,$2, now() + interval '20 minutes')`, [email, token]);
  return token;
}

/** Consumes the token and returns the account, creating the user on first sign-in. */
export async function consumeMagicToken(token: string): Promise<DemoAccount | null> {
  const row = await one<{ identifier: string }>(
    "delete from verification_token where token = $1 and expires > now() returning identifier", [token]);
  if (!row) return null;
  const email = row.identifier;

  const existing = await one<{
    user_id: string; display_name: string; community: Community; interface_language: Lang;
  }>(
    `select p.user_id, p.display_name, p.community, p.interface_language
     from profiles p join users u on u.id = p.user_id where lower(u.email) = lower($1)`, [email]);
  if (existing) {
    return {
      userId: existing.user_id, email, displayName: existing.display_name,
      community: existing.community, interfaceLanguage: existing.interface_language,
    };
  }
  const name = email.split("@")[0] ?? "Someone";
  const created = await one<{ id: string }>(
    `insert into users (email, name) values ($1,$2)
     on conflict (email) do update set name = users.name returning id`, [email, name]);
  if (!created) return null;
  return { userId: created.id, email, displayName: name, community: "foreigner", interfaceLanguage: "en" };
}
