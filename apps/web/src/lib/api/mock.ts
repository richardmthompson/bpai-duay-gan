// In-browser backend for building screens before apps/api exists.
// State lives in localStorage (shared by every tab); the signed-in user lives in sessionStorage
// (one per tab), so two windows can be Nok and Sam. Realtime frames cross tabs on a BroadcastChannel.
import { EVENTS, TAGS, demo } from "@/mocks/fixtures";
import type {
  Candidate,
  Community,
  Event,
  EventSummary,
  Gender,
  Lang,
  MatchRequest,
  MatchSummary,
  MatchedTag,
  Me,
  Message,
  Notification,
  NotificationKind,
  PersonSummary,
  PublicProfile,
  Register,
  ServerFrame,
} from "@/lib/contract";
import { REGISTER_FOR_GENDER } from "@/lib/contract";
import { ApiError, type Api, type Realtime, type SocketStatus } from "./types";

// Same shape as the weights constant the contract puts in apps/api.
// A shared event outranks any number of matched tags (issue #3); the score is display-only.
const WEIGHTS = { sharedEvent: 100, tag: 10 };

interface MockUser extends Me {
  createdAt: string;
  demoRole?: string;
}
interface MockRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  eventId: string | null;
  note: string | null;
  status: MatchRequest["status"];
  createdAt: string;
  matchId: string | null;
}
interface MockMatch {
  id: string;
  userAId: string;
  userBId: string;
  requestId: string;
  createdAt: string;
}
interface MockNotification extends Notification {
  userId: string;
}
interface State {
  version: 1;
  users: Record<string, MockUser>;
  attendance: { userId: string; eventId: string }[];
  requests: MockRequest[];
  matches: MockMatch[];
  messages: Message[];
  reads: Record<string, string>; // `${matchId}:${userId}` -> last read message id
  notifications: MockNotification[];
  blocks: { blockerId: string; blockedId: string }[];
  reports: { reporterId: string; reportedId: string; matchId: string | null; reason: string }[];
}

const STATE_KEY = "bpai.mock.v1";
const SESSION_KEY = "bpai.mock.session";
const channelName = "bpai.mock";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The schema's backfill: a male or female register implies that gender; anything else stays unknown. */
function genderFromRegister(r: Register | null): Gender | null {
  return r === "male" || r === "female" ? r : null;
}

function seedState(): State {
  const users: State["users"] = {};
  const attendance: State["attendance"] = [];
  // Earlier in the file ranks first within a tie (tiebreak is created_at desc).
  const base = Date.parse("2026-09-26T12:00:00Z");
  demo.profiles.forEach((p, i) => {
    const id = `demo-${p.ref}`;
    users[id] = {
      userId: id,
      email: p.email,
      displayName: p.display_name,
      community: p.community as Community,
      interfaceLanguage: p.interface_language as Lang,
      speaksLanguage: p.speaks_language as Lang,
      politenessRegister: p.politeness_register as Register,
      gender: genderFromRegister(p.politeness_register as Register),
      interestsText: p.interests_text,
      avatarUrl: p.avatar_url,
      onboardingComplete: true,
      give: p.give,
      learn: p.learn,
      createdAt: new Date(base - i * 60_000).toISOString(),
      demoRole: p.demo_role,
    };
    for (const ref of p.going_event_refs) attendance.push({ userId: id, eventId: ref.replace(/^seed:/, "") });
  });
  return {
    version: 1,
    users,
    attendance,
    requests: [],
    matches: [],
    messages: [],
    reads: {},
    notifications: [],
    blocks: [],
    reports: [],
  };
}

function load(): State {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      // State saved before gender existed gets the same backfill the database gets on deploy.
      for (const u of Object.values(s.users)) u.gender ??= genderFromRegister(u.politenessRegister);
      return s;
    }
  } catch {}
  const s = seedState();
  save(s);
  return s;
}
function save(s: State) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {}
}

function sessionUserId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

// ---- mock-only controls (sign-in screen, demo switcher) ----

export const mockControls = {
  /** The stage pair first, then the edge cases from scripts/seed/profiles/README.md. */
  demoUsers(): MockUser[] {
    const order = ["nok", "sam", "mild", "kenji", "kwan", "dev"];
    const users = load().users;
    return order.map((ref) => users[`demo-${ref}`]).filter(Boolean);
  },
  signInAs(userId: string) {
    sessionStorage.setItem(SESSION_KEY, userId);
  },
  /** Finds or creates the account for an email, like the magic-link callback would. */
  signInWithEmail(email: string, interfaceLanguage: Lang) {
    const s = load();
    const existing = Object.values(s.users).find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (existing) return this.signInAs(existing.userId);
    const id = uid();
    s.users[id] = {
      userId: id,
      email,
      displayName: "",
      community: null,
      interfaceLanguage,
      speaksLanguage: interfaceLanguage,
      politenessRegister: null,
      gender: null,
      interestsText: "",
      avatarUrl: null,
      onboardingComplete: false,
      give: [],
      learn: [],
      createdAt: now(),
    };
    save(s);
    this.signInAs(id);
  },
  signOut() {
    sessionStorage.removeItem(SESSION_KEY);
  },
  reset() {
    localStorage.removeItem(STATE_KEY);
  },
};

// ---- helpers ----

function requireMe(s: State): MockUser {
  const id = sessionUserId();
  const me = id ? s.users[id] : undefined;
  if (!me) throw new ApiError(401, "unauthenticated", "Not signed in");
  return me;
}

function blockedEitherWay(s: State, a: string, b: string) {
  return s.blocks.some(
    (x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a),
  );
}

function summary(u: MockUser): PersonSummary {
  return { userId: u.userId, displayName: u.displayName, community: u.community!, avatarUrl: u.avatarUrl };
}

function eventSummary(id: string): EventSummary | null {
  const e = EVENTS.find((x) => x.id === id);
  return e ? { id: e.id, titleEn: e.titleEn, titleTh: e.titleTh, startsAt: e.startsAt } : null;
}

function goingIds(s: State, userId: string) {
  return s.attendance.filter((a) => a.userId === userId).map((a) => a.eventId);
}

function candidate(s: State, me: MockUser, other: MockUser): Candidate {
  const matchedTags: MatchedTag[] = [
    ...other.give.filter((t) => me.learn.includes(t)).map((tagId) => ({ tagId, side: "theyGive" as const })),
    ...me.give.filter((t) => other.learn.includes(t)).map((tagId) => ({ tagId, side: "youGive" as const })),
  ];
  const mine = goingIds(s, me.userId);
  const sharedEvents = goingIds(s, other.userId)
    .filter((id) => mine.includes(id))
    .map(eventSummary)
    .filter((e): e is EventSummary => e !== null);
  return {
    ...summary(other),
    score: sharedEvents.length * WEIGHTS.sharedEvent + matchedTags.length * WEIGHTS.tag,
    interestsText: other.interestsText,
    give: other.give,
    learn: other.learn,
    matchedTags,
    sharedEvents,
  };
}

function visibleOther(s: State, me: MockUser, userId: string): MockUser {
  const other = s.users[userId];
  // 404, never 403, so a blocked user's existence is not confirmed.
  if (!other || other.userId === me.userId || blockedEitherWay(s, me.userId, userId) || !other.onboardingComplete)
    throw new ApiError(404, "not_found", "Not found");
  return other;
}

function toRequest(s: State, me: MockUser, r: MockRequest): MatchRequest {
  const incoming = r.toUserId === me.userId;
  return {
    ...r,
    direction: incoming ? "incoming" : "outgoing",
    other: summary(s.users[incoming ? r.fromUserId : r.toUserId]),
    event: r.eventId ? eventSummary(r.eventId) : null,
  };
}

function matchOf(s: State, me: MockUser, matchId: string): MockMatch {
  const m = s.matches.find((x) => x.id === matchId);
  if (!m || (m.userAId !== me.userId && m.userBId !== me.userId)) throw new ApiError(404, "not_found", "Not found");
  const otherId = m.userAId === me.userId ? m.userBId : m.userAId;
  if (blockedEitherWay(s, me.userId, otherId)) throw new ApiError(404, "not_found", "Not found");
  return m;
}

// ---- realtime over BroadcastChannel ----

type Wire = { to: string; frame: ServerFrame };
const listeners = new Set<(f: ServerFrame) => void>();
const statusListeners = new Set<(s: SocketStatus) => void>();
let channel: BroadcastChannel | null = null;
let status: SocketStatus = "idle";

function setStatus(next: SocketStatus) {
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

function deliver(w: Wire) {
  if (w.to === sessionUserId()) listeners.forEach((fn) => fn(w.frame));
}

function emit(to: string, frame: Omit<ServerFrame, "id" | "ts">) {
  const w = { to, frame: { ...frame, id: uid(), ts: now() } as ServerFrame };
  deliver(w); // BroadcastChannel does not echo to the sending tab
  channel?.postMessage(w);
}

function notify(s: State, userId: string, kind: NotificationKind, data: Notification["data"], title: string) {
  const n: MockNotification = { id: uid(), userId, kind, data, readAt: null, createdAt: now() };
  s.notifications.push(n);
  return () =>
    emit(userId, {
      type: "notification",
      payload: { notificationId: n.id, kind, title, body: "", data },
    } as ServerFrame);
}

// A tiny phrasebook so the demo lines read naturally in mock mode. Real translation is Claude, in apps/api.
const PHRASES: { en: string; th: { male: string; female: string; neutral: string }; note?: string }[] = [
  {
    en: "See you at the workshop on Saturday?",
    th: { male: "เจอกันที่เวิร์กช็อปวันเสาร์นะครับ", female: "เจอกันที่เวิร์กช็อปวันเสาร์นะคะ", neutral: "เจอกันที่เวิร์กช็อปวันเสาร์นะ" },
  },
  {
    en: "Hi! Nice to meet you.",
    th: { male: "สวัสดีครับ ยินดีที่ได้รู้จักครับ", female: "สวัสดีค่ะ ยินดีที่ได้รู้จักค่ะ", neutral: "สวัสดี ยินดีที่ได้รู้จักนะ" },
  },
  {
    en: "Would you teach me to make khao soi?",
    th: { male: "ช่วยสอนทำข้าวซอยได้ไหมครับ", female: "ช่วยสอนทำข้าวซอยได้ไหมคะ", neutral: "ช่วยสอนทำข้าวซอยได้ไหม" },
    note: "Khao soi is a northern Thai curry noodle soup, Chiang Mai's signature dish.",
  },
];
const TH_TO_EN: Record<string, string> = {
  "สวัสดีค่ะ ยินดีที่ได้รู้จักค่ะ": "Hi! Nice to meet you.",
  "สวัสดีครับ ยินดีที่ได้รู้จักครับ": "Hi! Nice to meet you.",
  "ได้เลยค่ะ เจอกันวันเสาร์นะคะ": "Sure! See you on Saturday.",
  "ได้เลยค่ะ มาร้านข้าวซอยของเราได้เลยนะคะ": "Of course! Come by our khao soi shop.",
};

function mockTranslate(text: string, from: Lang, register: Register | null) {
  const t = text.trim();
  if (from === "en") {
    const hit = PHRASES.find((p) => p.en.toLowerCase() === t.toLowerCase());
    if (hit) return { body: hit.th[register ?? "neutral"], note: hit.note ?? null };
    return { body: `[TH] ${t}`, note: null };
  }
  return { body: TH_TO_EN[t] ?? `[EN] ${t}`, note: t.includes("ข้าวซอย") ? "Khao soi: northern Thai curry noodle soup." : null };
}

function sendChat(input: { matchId: string; body: string; lang: Lang; clientMsgId: string }): Message {
  const s = load();
  const me = requireMe(s);
  const m = matchOf(s, me, input.matchId);
  const otherId = m.userAId === me.userId ? m.userBId : m.userAId;
  const other = s.users[otherId];
  const target: Lang = other.speaksLanguage;
  const needs = target !== input.lang;
  const msg: Message = {
    id: uid(),
    matchId: m.id,
    senderId: me.userId,
    clientMsgId: input.clientMsgId,
    bodyOriginal: input.body,
    langOriginal: input.lang,
    bodyTranslated: null,
    langTranslated: null,
    culturalNote: null,
    translationStatus: needs ? "pending" : "done",
    createdAt: now(),
  };
  s.messages.push(msg);
  const fire = notify(s, otherId, "message", { matchId: m.id, fromUserId: me.userId, fromName: me.displayName }, me.displayName);
  save(s);
  const { id, ...rest } = msg;
  for (const to of [me.userId, otherId]) emit(to, { type: "chat.message", payload: { ...rest, messageId: id } } as ServerFrame);
  fire();

  if (needs) {
    // Two-phase delivery, as the contract describes: original now, translation shortly after.
    void sleep(700 + Math.random() * 500).then(() => {
      const s2 = load();
      const row = s2.messages.find((x) => x.id === msg.id);
      if (!row) return;
      // The sender's register decides ครับ / ค่ะ.
      const tr = mockTranslate(row.bodyOriginal, row.langOriginal, me.politenessRegister);
      row.bodyTranslated = tr.body;
      row.langTranslated = target;
      row.culturalNote = tr.note;
      row.translationStatus = "done";
      save(s2);
      for (const to of [me.userId, otherId])
        emit(to, {
          type: "chat.translated",
          payload: { matchId: m.id, messageId: row.id, bodyTranslated: tr.body, langTranslated: target, culturalNote: tr.note },
        } as ServerFrame);
    });
  }
  return msg;
}

const realtime: Realtime = {
  connect() {
    if (typeof window === "undefined" || channel) return;
    setStatus("connecting");
    channel = new BroadcastChannel(channelName);
    channel.onmessage = (e: MessageEvent<Wire>) => deliver(e.data);
    const me = sessionUserId();
    setTimeout(() => {
      setStatus("ready");
      if (me) listeners.forEach((fn) => fn({ type: "ready", id: uid(), ts: now(), payload: { userId: me } }));
    }, 50);
  },
  disconnect() {
    channel?.close();
    channel = null;
    setStatus("closed");
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  onStatus(fn) {
    statusListeners.add(fn);
    fn(status);
    return () => statusListeners.delete(fn);
  },
  sendChat(input) {
    try {
      sendChat(input);
      return true;
    } catch {
      return false;
    }
  },
  sendRead(matchId, upToMessageId) {
    const s = load();
    const me = requireMe(s);
    s.reads[`${matchId}:${me.userId}`] = upToMessageId;
    s.notifications.forEach((n) => {
      if (n.userId === me.userId && n.kind === "message" && n.data.matchId === matchId && !n.readAt) n.readAt = now();
    });
    save(s);
  },
  sendTyping(matchId) {
    const s = load();
    const me = requireMe(s);
    const m = s.matches.find((x) => x.id === matchId);
    if (!m) return;
    const otherId = m.userAId === me.userId ? m.userBId : m.userAId;
    emit(otherId, { type: "chat.typing", payload: { matchId, userId: me.userId } } as ServerFrame);
  },
};

// ---- the Api ----

const latency = () => sleep(120);

export const mockApi: Api = {
  mode: "mock",
  realtime,

  async getTags() {
    await latency();
    return TAGS;
  },

  async getMe() {
    await latency();
    const s = load();
    const id = sessionUserId();
    const u = id ? s.users[id] : undefined;
    if (!u) return null;
    const { createdAt, demoRole, ...me } = u;
    void createdAt;
    void demoRole;
    return me;
  },

  async putMe(update) {
    await latency();
    const s = load();
    const me = requireMe(s);
    Object.assign(me, update);
    // Like the api: the register follows gender on every save that carries one.
    if (update.gender) me.politenessRegister = REGISTER_FOR_GENDER[update.gender];
    me.onboardingComplete = !!(me.community && me.displayName && me.give.length + me.learn.length > 0);
    save(s);
    return (await this.getMe())!;
  },

  async putMyTags({ give, learn }) {
    await latency();
    const s = load();
    const me = requireMe(s);
    me.give = [...new Set(give)];
    me.learn = [...new Set(learn)];
    me.onboardingComplete = !!(me.community && me.displayName && me.give.length + me.learn.length > 0);
    save(s);
    return (await this.getMe())!;
  },

  async browse() {
    await latency();
    const s = load();
    const me = requireMe(s);
    const items = Object.values(s.users)
      .filter(
        (u) =>
          u.onboardingComplete &&
          u.community &&
          u.community !== me.community &&
          !blockedEitherWay(s, me.userId, u.userId),
      )
      .map((u) => ({ c: candidate(s, me, u), createdAt: u.createdAt }))
      .sort(
        (a, b) =>
          b.c.sharedEvents.length - a.c.sharedEvents.length ||
          b.c.matchedTags.length - a.c.matchedTags.length ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .map((x) => x.c);
    return { items, nextCursor: null };
  },

  async getUser(userId) {
    await latency();
    const s = load();
    const me = requireMe(s);
    const other = visibleOther(s, me, userId);
    const c = candidate(s, me, other);
    const pending = s.requests.find(
      (r) =>
        r.status === "pending" &&
        ((r.fromUserId === me.userId && r.toUserId === userId) || (r.fromUserId === userId && r.toUserId === me.userId)),
    );
    const [a, b] = [me.userId, userId].sort();
    const match = s.matches.find((m) => m.userAId === a && m.userBId === b);
    const relationship: PublicProfile["relationship"] = match
      ? { kind: "matched", matchId: match.id }
      : pending
        ? pending.fromUserId === me.userId
          ? { kind: "requestSent", requestId: pending.id }
          : { kind: "requestReceived", requestId: pending.id }
        : { kind: "none" };
    return {
      ...c,
      goingEvents: goingIds(s, userId)
        .map(eventSummary)
        .filter((e): e is EventSummary => e !== null),
      relationship,
    };
  },

  async sendRequest({ toUserId, eventId = null, note = null }) {
    await latency();
    const s = load();
    const me = requireMe(s);
    const other = visibleOther(s, me, toUserId);
    if (other.community === me.community) throw new ApiError(400, "same_community", "Same community");
    const dup = s.requests.find((r) => r.status === "pending" && r.fromUserId === me.userId && r.toUserId === toUserId);
    if (dup) throw new ApiError(409, "request_pending", "Request already pending");
    const r: MockRequest = {
      id: uid(),
      fromUserId: me.userId,
      toUserId,
      eventId,
      note,
      status: "pending",
      createdAt: now(),
      matchId: null,
    };
    s.requests.push(r);
    const fire = notify(s, toUserId, "match_request", { requestId: r.id, fromUserId: me.userId, fromName: me.displayName, eventId: eventId ?? undefined }, me.displayName);
    save(s);
    fire();
    return toRequest(s, me, r);
  },

  async listRequests() {
    await latency();
    const s = load();
    const me = requireMe(s);
    return s.requests
      .filter((r) => {
        const otherId = r.fromUserId === me.userId ? r.toUserId : r.fromUserId;
        if (blockedEitherWay(s, me.userId, otherId)) return false;
        if (r.fromUserId === me.userId) return r.status !== "cancelled";
        // A declined request leaves the recipient's inbox.
        return r.toUserId === me.userId && r.status !== "declined" && r.status !== "cancelled";
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => toRequest(s, me, r));
  },

  async acceptRequest(id) {
    await latency();
    const s = load();
    const me = requireMe(s);
    const r = s.requests.find((x) => x.id === id && x.toUserId === me.userId && x.status === "pending");
    if (!r) throw new ApiError(404, "not_found", "Not found");
    const [a, b] = [r.fromUserId, r.toUserId].sort();
    let m = s.matches.find((x) => x.userAId === a && x.userBId === b);
    if (!m) {
      m = { id: uid(), userAId: a, userBId: b, requestId: r.id, createdAt: now() };
      s.matches.push(m);
    }
    r.status = "accepted";
    r.matchId = m.id;
    const fire = notify(s, r.fromUserId, "match_accepted", { requestId: r.id, matchId: m.id, fromUserId: me.userId, fromName: me.displayName }, me.displayName);
    save(s);
    fire();
    return toRequest(s, me, r);
  },

  async declineRequest(id) {
    await latency();
    const s = load();
    const me = requireMe(s);
    const r = s.requests.find((x) => x.id === id && x.toUserId === me.userId && x.status === "pending");
    if (!r) throw new ApiError(404, "not_found", "Not found");
    r.status = "declined";
    save(s);
    return toRequest(s, me, r);
  },

  async listMatches() {
    await latency();
    const s = load();
    const me = requireMe(s);
    return s.matches
      .filter((m) => m.userAId === me.userId || m.userBId === me.userId)
      .map((m) => ({ m, otherId: m.userAId === me.userId ? m.userBId : m.userAId }))
      .filter(({ otherId }) => !blockedEitherWay(s, me.userId, otherId))
      .map(({ m, otherId }): MatchSummary & { sortKey: string } => {
        const msgs = s.messages.filter((x) => x.matchId === m.id);
        const last = msgs.at(-1) ?? null;
        const readUpTo = s.reads[`${m.id}:${me.userId}`];
        const readIdx = readUpTo ? msgs.findIndex((x) => x.id === readUpTo) : -1;
        const unreadCount = msgs.slice(readIdx + 1).filter((x) => x.senderId !== me.userId).length;
        return { id: m.id, other: summary(s.users[otherId]), lastMessage: last, unreadCount, sortKey: last?.createdAt ?? m.createdAt };
      })
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
      .map(({ id, other, lastMessage, unreadCount }) => ({ id, other, lastMessage, unreadCount }));
  },

  async getMessages(matchId) {
    await latency();
    const s = load();
    const me = requireMe(s);
    matchOf(s, me, matchId);
    return { items: s.messages.filter((m) => m.matchId === matchId), nextCursor: null };
  },

  async postMessage(matchId, input) {
    await latency();
    return sendChat({ matchId, ...input });
  },

  async listEvents() {
    await latency();
    const s = load();
    const me = requireMe(s);
    return [...EVENTS]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((e) => ({
        ...e,
        going: s.attendance.some((a) => a.userId === me.userId && a.eventId === e.id),
        goingCount: s.attendance.filter((a) => a.eventId === e.id).length,
      }));
  },

  async getEvent(id) {
    const events = await this.listEvents();
    const e = events.find((x) => x.id === id);
    if (!e) throw new ApiError(404, "not_found", "Not found");
    const s = load();
    const me = requireMe(s);
    const attendees = s.attendance
      .filter((a) => a.eventId === id)
      .map((a) => s.users[a.userId])
      .filter((u) => u && u.community !== me.community && !blockedEitherWay(s, me.userId, u.userId))
      .map(summary);
    return { ...(e as Event), attendees };
  },

  async setGoing(id, going) {
    await latency();
    const s = load();
    const me = requireMe(s);
    s.attendance = s.attendance.filter((a) => !(a.userId === me.userId && a.eventId === id));
    if (going) s.attendance.push({ userId: me.userId, eventId: id });
    save(s);
  },

  async block(userId) {
    await latency();
    const s = load();
    const me = requireMe(s);
    if (!s.blocks.some((b) => b.blockerId === me.userId && b.blockedId === userId))
      s.blocks.push({ blockerId: me.userId, blockedId: userId });
    save(s);
  },

  async report({ userId, reason, matchId = null }) {
    await latency();
    const s = load();
    const me = requireMe(s);
    s.reports.push({ reporterId: me.userId, reportedId: userId, matchId, reason });
    save(s);
  },

  async getNotifications() {
    await latency();
    const s = load();
    const me = requireMe(s);
    const items = s.notifications
      .filter((n) => n.userId === me.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ id, kind, data, readAt, createdAt }) => ({ id, kind, data, readAt, createdAt }));
    return { items, unreadCount: items.filter((n) => !n.readAt).length };
  },

  async markNotificationsRead(ids) {
    await latency();
    const s = load();
    const me = requireMe(s);
    s.notifications.forEach((n) => {
      if (n.userId === me.userId && !n.readAt && (ids === "all" || ids.includes(n.id))) n.readAt = now();
    });
    save(s);
  },
};
