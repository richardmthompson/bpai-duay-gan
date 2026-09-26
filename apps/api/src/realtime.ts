/**
 * /ws — the team's envelope: every frame is {type, id, ts, payload}. A socket is anonymous until
 * it sends `auth` with the same bearer token the REST calls use, then `ready` confirms it.
 */
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { verifyToken } from "./auth.ts";
import * as store from "./store.ts";
import { translate } from "./translate.ts";

const OPEN = 1;
const sockets = new Map<string, Set<WebSocket>>();

function frame(type: string, payload: unknown): string {
  return JSON.stringify({ type, id: randomUUID(), ts: new Date().toISOString(), payload });
}

export function pushTo(userId: string, type: string, payload: unknown): void {
  const set = sockets.get(userId);
  if (!set) return;
  const text = frame(type, payload);
  for (const ws of set) if (ws.readyState === OPEN) ws.send(text);
}

/** A notification row plus the live frame, so the badge and the toast agree. */
export async function notifyUser(
  userId: string,
  kind: store.Notification["kind"],
  data: Record<string, string | undefined>,
  title: string,
  body: string,
): Promise<void> {
  try {
    const notification = await store.notify(userId, kind, data);
    pushTo(userId, "notification", {
      notificationId: notification.id, kind, title, body, data: notification.data,
    });
  } catch (err) {
    console.error("[realtime] notify failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Push the original to both sides, then translate for the reader in the background.
 * Shared by the socket and the REST fallback so a message behaves identically either way.
 */
export async function deliverMessage(message: store.Message, participants: string[], senderId: string): Promise<void> {
  const { id, ...rest } = message;
  const outgoing = { ...rest, messageId: id };
  for (const userId of participants) pushTo(userId, "chat.message", outgoing);

  const readerId = participants.find((p) => p !== senderId);
  if (!readerId) return;

  const [sender, reader] = await Promise.all([
    store.senderProfile(senderId),
    store.senderProfile(readerId),
  ]);
  if (!sender || !reader) return;

  if (sender.lang !== reader.lang) {
    const { translated, note } = await translate(
      message.bodyOriginal, sender.lang, reader.lang, sender.register, reader.name);
    if (translated) {
      await store.saveTranslation(id, translated, note, false);
      pushTo(readerId, "chat.translated", {
        matchId: message.matchId, messageId: id,
        bodyTranslated: translated, langTranslated: reader.lang, culturalNote: note,
      });
    } else {
      // Record the failure so the bubble stops saying "translating…".
      await store.saveTranslation(id, null, null, true);
    }
  } else {
    await store.saveTranslation(id, null, null, false);
  }

  await notifyUser(
    readerId, "message",
    { matchId: message.matchId, fromUserId: senderId, fromName: sender.name },
    sender.name, message.bodyOriginal.slice(0, 120),
  );
}

async function onFrame(socket: WebSocket & { userId?: string }, raw: string): Promise<void> {
  let parsed: { type?: string; payload?: Record<string, string> };
  try { parsed = JSON.parse(raw); } catch { return; }

  const type = parsed.type;
  const payload = parsed.payload ?? {};

  if (type === "auth") {
    const claims = await verifyToken(payload.token);
    if (!claims) {
      socket.send(frame("error", { code: "unauthorized", message: "bad or expired token", ref: null }));
      socket.close();
      return;
    }
    socket.userId = claims.sub;
    let set = sockets.get(claims.sub);
    if (!set) { set = new Set(); sockets.set(claims.sub, set); }
    set.add(socket);
    socket.send(frame("ready", { userId: claims.sub }));
    return;
  }

  const userId = socket.userId;
  if (!userId) {
    socket.send(frame("error", { code: "unauthorized", message: "send auth first", ref: null }));
    return;
  }

  if (type === "ping") { socket.send(frame("pong", {})); return; }

  if (type === "chat.send") {
    const matchId = payload.matchId;
    const body = (payload.body ?? "").trim();
    if (!matchId || !body) return;
    const parts = await store.participants(matchId);
    if (!parts || !parts.includes(userId)) {
      socket.send(frame("error", { code: "forbidden", message: "not your match", ref: payload.clientMsgId ?? null }));
      return;
    }
    const { message, duplicate } = await store.insertMessage(matchId, userId, {
      body, lang: payload.lang === "th" ? "th" : "en", clientMsgId: payload.clientMsgId ?? null,
    });
    if (!duplicate) await deliverMessage(message, parts, userId);
    return;
  }

  if (type === "chat.read") {
    const matchId = payload.matchId;
    if (!matchId) return;
    const parts = await store.participants(matchId);
    if (!parts || !parts.includes(userId)) return;
    await store.markRead(matchId, userId, payload.upToMessageId ?? null);
    for (const p of parts) {
      pushTo(p, "chat.read", { matchId, userId, upToMessageId: payload.upToMessageId ?? null });
    }
    return;
  }

  if (type === "chat.typing") {
    const matchId = payload.matchId;
    if (!matchId) return;
    const parts = await store.participants(matchId);
    if (!parts) return;
    for (const p of parts) if (p !== userId) pushTo(p, "chat.typing", { matchId, userId });
  }
}

export function attachRealtime(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/ws") { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const live = ws as WebSocket & { userId?: string };
      live.on("close", () => {
        if (!live.userId) return;
        const set = sockets.get(live.userId);
        set?.delete(live);
        if (set && set.size === 0) sockets.delete(live.userId);
      });
      live.on("error", () => live.terminate());
      live.on("message", (raw: unknown) => { void onFrame(live, String(raw)); });
    });
  });

  console.log("[realtime] /ws ready");
}
