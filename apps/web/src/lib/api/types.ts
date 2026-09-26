import type {
  Candidate,
  Event,
  EventDetail,
  Lang,
  MatchRequest,
  MatchSummary,
  Me,
  Message,
  Notification,
  Page,
  ProfileUpdate,
  PublicProfile,
  ServerFrame,
  Tag,
} from "@/lib/contract";

/** Everything the screens need from the backend. One implementation talks to /v1, the other is in-browser. */
export interface Api {
  mode: "mock" | "http";

  getTags(): Promise<Tag[]>;
  /** null when nobody is signed in. */
  getMe(): Promise<Me | null>;
  putMe(update: ProfileUpdate): Promise<Me>;
  putMyTags(sel: { give: string[]; learn: string[] }): Promise<Me>;

  browse(cursor?: string | null): Promise<Page<Candidate>>;
  getUser(userId: string): Promise<PublicProfile>;

  sendRequest(input: { toUserId: string; eventId?: string | null; note?: string | null }): Promise<MatchRequest>;
  listRequests(): Promise<MatchRequest[]>;
  acceptRequest(id: string): Promise<MatchRequest>;
  declineRequest(id: string): Promise<MatchRequest>;

  listMatches(): Promise<MatchSummary[]>;
  getMessages(matchId: string, before?: string | null): Promise<Page<Message>>;
  /** HTTP fallback for when the socket is down. */
  postMessage(matchId: string, input: { body: string; lang: Lang; clientMsgId: string }): Promise<Message>;

  listEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<EventDetail>;
  setGoing(id: string, going: boolean): Promise<void>;

  block(userId: string): Promise<void>;
  report(input: { userId: string; reason: string; matchId?: string | null }): Promise<void>;

  getNotifications(): Promise<{ items: Notification[]; unreadCount: number }>;
  markNotificationsRead(ids: string[] | "all"): Promise<void>;

  realtime: Realtime;
}

export interface Realtime {
  /** Opens (or reuses) the connection for the signed-in user. */
  connect(): void;
  disconnect(): void;
  subscribe(fn: (frame: ServerFrame) => void): () => void;
  onStatus(fn: (status: SocketStatus) => void): () => void;
  sendChat(input: { matchId: string; body: string; lang: Lang; clientMsgId: string }): boolean;
  sendRead(matchId: string, upToMessageId: string): void;
  sendTyping(matchId: string): void;
}

export type SocketStatus = "idle" | "connecting" | "ready" | "closed";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
