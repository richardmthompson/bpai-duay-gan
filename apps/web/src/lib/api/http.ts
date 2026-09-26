// The real backend: /v1 on the Node API, /ws for realtime (CONTRACT.md sections 4 and 5).
import type { Lang, ServerFrame } from "@/lib/contract";
import { ApiError, type Api, type Realtime, type SocketStatus } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "";

// The Node API cannot read the Auth.js cookie, so every /v1 call carries the same short-lived
// token the socket uses. CONTRACT.md only specifies it for /ws; confirm with role 1.
//
// The cache is keyed on the cookie it came from: a cache that only expires would keep serving the
// previous session's bearer token for its full hour, so signing in as someone else on the same
// browser showed the previous person — and the app could not see a new session at all.
let cached: { token: string; source: string; until: number } | null = null;

function sessionCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)bpai_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

/** Signing out must empty this too; see clearSession(). */
export function resetTokenCache(): void {
  cached = null;
}

async function token(): Promise<string | null> {
  const source = sessionCookie();
  if (cached && cached.source === source && cached.until > Date.now()) return cached.token;
  const res = await fetch("/api/ws-token", { credentials: "same-origin", cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiError(res.status, "ws_token_failed", "Could not get a session token");
  const body = (await res.json()) as { token: string; expiresIn?: number };
  const ttl = (body.expiresIn ?? 60) * 1000;
  cached = { token: body.token, source, until: Date.now() + ttl - 5_000 };
  return body.token;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const t = await token();
  const res = await fetch(`${API_BASE}/v1${path}`, {
    method,
    // The response depends on who is asking; letting the browser reuse one would show the
    // previous session's people and notifications.
    cache: "no-store",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.code ?? "error", data.message ?? res.statusText);
  return data as T;
}

const enc = encodeURIComponent;

// fetch cannot report upload progress, and on slow mobile data the bar is the only sign of life.
async function upload<T>(method: string, path: string, body: Blob, onProgress?: (f: number) => void): Promise<T> {
  const t = await token();
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}/v1${path}`);
    xhr.setRequestHeader("Content-Type", body.type || "application/octet-stream");
    if (t) xhr.setRequestHeader("Authorization", `Bearer ${t}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let data: { code?: string; message?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else reject(new ApiError(xhr.status, data.code ?? "error", data.message ?? xhr.statusText));
    };
    xhr.onerror = () => reject(new ApiError(0, "network", "Network error"));
    xhr.send(body);
  });
}

// ---- realtime ----

const listeners = new Set<(f: ServerFrame) => void>();
const statusListeners = new Set<(s: SocketStatus) => void>();
let ws: WebSocket | null = null;
let status: SocketStatus = "idle";
let wanted = false;
let retry = 0;
let pingTimer: ReturnType<typeof setInterval> | null = null;

function setStatus(next: SocketStatus) {
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

function frame(type: string, payload: unknown) {
  return JSON.stringify({ type, id: crypto.randomUUID(), ts: new Date().toISOString(), payload });
}

async function open() {
  if (!wanted || ws) return;
  setStatus("connecting");
  let t: string | null;
  try {
    t = await token();
  } catch {
    t = null;
  }
  if (!t) return scheduleReconnect();
  const sock = new WebSocket(WS_URL);
  ws = sock;
  sock.onopen = () => sock.send(frame("auth", { token: t }));
  sock.onmessage = (e) => {
    let f: ServerFrame;
    try {
      f = JSON.parse(e.data);
    } catch {
      return;
    }
    if (f.type === "ready") {
      retry = 0;
      setStatus("ready");
      pingTimer = setInterval(() => sock.readyState === WebSocket.OPEN && sock.send(frame("ping", {})), 25_000);
    }
    listeners.forEach((fn) => fn(f));
  };
  sock.onclose = () => {
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    ws = null;
    setStatus("closed");
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (!wanted) return;
  const delay = Math.min(10_000, 500 * 2 ** retry++);
  setTimeout(open, delay);
}

function send(type: string, payload: unknown) {
  if (ws?.readyState !== WebSocket.OPEN || status !== "ready") return false;
  ws.send(frame(type, payload));
  return true;
}

const realtime: Realtime = {
  connect() {
    if (typeof window === "undefined") return;
    wanted = true;
    void open();
  },
  disconnect() {
    wanted = false;
    ws?.close();
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
  sendChat(input: { matchId: string; body: string; lang: Lang; clientMsgId: string }) {
    return send("chat.send", input);
  },
  sendRead(matchId, upToMessageId) {
    send("chat.read", { matchId, upToMessageId });
  },
  sendTyping(matchId) {
    send("chat.typing", { matchId });
  },
};

export const httpApi: Api = {
  mode: "http",
  realtime,
  getTags: () => call("GET", "/tags"),
  async getMe() {
    try {
      return await call("GET", "/me");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  putMe: (update) => call("PUT", "/me", update),
  putMyTags: (sel) => call("PUT", "/me/tags", sel),
  uploadAvatar: (image, onProgress) => upload("PUT", "/me/avatar", image, onProgress),
  removeAvatar: () => call("DELETE", "/me/avatar"),
  browse: (cursor) => call("GET", `/browse${cursor ? `?cursor=${enc(cursor)}` : ""}`),
  getUser: (id) => call("GET", `/users/${enc(id)}`),
  sendRequest: (input) => call("POST", "/match-requests", input),
  listRequests: () => call("GET", "/match-requests"),
  acceptRequest: (id) => call("POST", `/match-requests/${enc(id)}/accept`),
  declineRequest: (id) => call("POST", `/match-requests/${enc(id)}/decline`),
  listMatches: () => call("GET", "/matches"),
  getMessages: (matchId, before) =>
    call("GET", `/matches/${enc(matchId)}/messages${before ? `?before=${enc(before)}` : ""}`),
  postMessage: (matchId, input) => call("POST", `/matches/${enc(matchId)}/messages`, input),
  listEvents: () => call("GET", "/events"),
  getEvent: (id) => call("GET", `/events/${enc(id)}`),
  setGoing: (id, going) => call(going ? "PUT" : "DELETE", `/events/${enc(id)}/going`),
  block: (userId) => call("POST", "/blocks", { userId }),
  report: (input) => call("POST", "/reports", input),
  getNotifications: () => call("GET", "/notifications"),
  markNotificationsRead: (ids) => call("POST", "/notifications/read", ids === "all" ? { all: true } : { ids }),
};
