// Shapes from CONTRACT.md sections 2, 4 and 5, as the web app reads them.
// Move to packages/shared once it exists; until then this is the web app's copy.
// JSON field casing is assumed camelCase (the WebSocket payloads in section 5 are camelCase).

export type Lang = "th" | "en";
export type Community = "local" | "foreigner";
export type Register = "male" | "female" | "neutral";
export type Gender = "male" | "female" | "other" | "undisclosed";
export const GENDERS: readonly Gender[] = ["male", "female", "other", "undisclosed"];
/** People set gender; the translation reads the register. The api applies the same map on save. */
export const REGISTER_FOR_GENDER: Record<Gender, Register> = {
  male: "male",
  female: "female",
  other: "neutral",
  undisclosed: "neutral",
};
export type Direction = "give" | "learn";

export interface Tag {
  id: string;
  labelEn: string;
  labelTh: string;
  sortOrder: number;
}

export interface Me {
  userId: string;
  email: string | null;
  displayName: string;
  community: Community | null;
  interfaceLanguage: Lang;
  speaksLanguage: Lang;
  politenessRegister: Register | null;
  gender: Gender | null;
  interestsText: string;
  avatarUrl: string | null;
  onboardingComplete: boolean;
  give: string[];
  learn: string[];
}

export type ProfileUpdate = Partial<
  Pick<
    Me,
    | "displayName"
    | "community"
    | "interfaceLanguage"
    | "speaksLanguage"
    | "gender"
    | "interestsText"
    | "avatarUrl"
  >
>;

export interface EventSummary {
  id: string;
  titleEn: string;
  titleTh: string;
  startsAt: string;
}

export interface Event extends EventSummary {
  source: string;
  sourceUrl: string | null;
  descriptionEn: string | null;
  descriptionTh: string | null;
  endsAt: string | null;
  venueName: string;
  address: string;
  priceText: string | null;
  imageUrl: string | null;
  going: boolean;
  goingCount: number;
}

export interface EventDetail extends Event {
  /** People from the other community who are going. */
  attendees: PersonSummary[];
}

export interface PersonSummary {
  userId: string;
  displayName: string;
  community: Community;
  avatarUrl: string | null;
}

/** A tag that makes two people complementary: one gives what the other wants to learn. */
export interface MatchedTag {
  tagId: string;
  /** "theyGive": the candidate gives what the viewer learns. "youGive": the reverse. */
  side: "theyGive" | "youGive";
}

export interface Candidate extends PersonSummary {
  score: number;
  interestsText: string;
  /** The same bio in the other language when we have it; null falls back to interestsText. */
  interestsTextTranslated: string | null;
  give: string[];
  learn: string[];
  matchedTags: MatchedTag[];
  sharedEvents: EventSummary[];
}

export type Relationship =
  | { kind: "none" }
  | { kind: "requestSent"; requestId: string }
  | { kind: "requestReceived"; requestId: string }
  | { kind: "matched"; matchId: string };

export interface PublicProfile extends Candidate {
  goingEvents: EventSummary[];
  /** Not in CONTRACT.md yet; the profile screen needs it to pick the right button. */
  relationship: Relationship;
}

export type RequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface MatchRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  direction: "incoming" | "outgoing";
  other: PersonSummary;
  event: EventSummary | null;
  note: string | null;
  status: RequestStatus;
  createdAt: string;
  matchId: string | null;
}

export type TranslationStatus = "pending" | "done" | "failed";

export interface Message {
  id: string;
  matchId: string;
  senderId: string;
  clientMsgId: string | null;
  bodyOriginal: string;
  langOriginal: Lang;
  bodyTranslated: string | null;
  langTranslated: Lang | null;
  culturalNote: string | null;
  translationStatus: TranslationStatus;
  createdAt: string;
}

export interface MatchSummary {
  id: string;
  other: PersonSummary;
  lastMessage: Message | null;
  unreadCount: number;
}

export type NotificationKind = "match_request" | "match_accepted" | "message";

export interface Notification {
  id: string;
  kind: NotificationKind;
  data: {
    requestId?: string;
    matchId?: string;
    fromUserId?: string;
    fromName?: string;
    eventId?: string;
  };
  readAt: string | null;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// WebSocket envelope, section 5.
export interface Envelope<T extends string = string, P = unknown> {
  type: T;
  id: string;
  ts: string;
  payload: P;
}

export type ServerFrame =
  | Envelope<"ready", { userId: string }>
  | Envelope<"chat.message", Omit<Message, "id"> & { messageId: string }>
  | Envelope<
      "chat.translated",
      Pick<Message, "matchId" | "bodyTranslated" | "langTranslated" | "culturalNote"> & {
        messageId: string;
      }
    >
  | Envelope<"chat.read", { matchId: string; userId: string; upToMessageId: string }>
  | Envelope<"chat.typing", { matchId: string; userId: string }>
  | Envelope<
      "notification",
      { notificationId: string; kind: NotificationKind; title: string; body: string; data: Notification["data"] }
    >
  | Envelope<"error", { code: string; message: string; ref: string | null }>
  | Envelope<"pong", Record<string, never>>;
