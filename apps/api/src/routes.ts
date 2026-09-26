/**
 * /v1 — the paths and shapes the web app calls (apps/web/src/lib/api/http.ts). Errors are flat
 * `{code, message}`; the client reads them at the top level, not nested.
 */
import express, { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { bearer, mintToken, verifyToken } from "./auth.ts";
import * as avatars from "./avatars.ts";
import { sendMagicLink } from "./mailer.ts";
import * as store from "./store.ts";
import { deliverMessage, notifyUser } from "./realtime.ts";

const STATUS: Record<string, number> = {
  unauthorized: 401, forbidden: 403, not_found: 404, conflict: 409, invalid: 422,
  already_matched: 409, already_asked: 409, too_large: 413, unsupported_media: 415,
  rate_limited: 429, internal: 500,
};

interface Authed extends Request { userId: string }

async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const claims = await verifyToken(bearer(req.headers.authorization));
  if (!claims) { res.status(401).json({ code: "unauthorized", message: "sign in first" }); return; }
  (req as Authed).userId = claims.sub;
  next();
}

function fail(res: Response, err: unknown): void {
  const code = (err as { code?: string }).code ?? "internal";
  const known = Boolean(STATUS[code]);
  if (!known) console.error("[api]", err);
  res.status(known ? STATUS[code] : 500).json({
    code: known ? code : "internal",
    message: err instanceof Error ? err.message : "unexpected error",
  });
}

export const router: Router = Router();

router.get("/health", (_req, res) => { res.json({ ok: true }); });

// ── Sign-in: magic link, plus a guarded one-click login for the demo cast ─────────────────────

router.post("/auth/magic-link", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      res.status(422).json({ code: "invalid", message: "that does not look like an email" });
      return;
    }
    const token = await store.createMagicToken(email);
    const base = process.env.PUBLIC_BASE_URL ?? "https://bpai.drdos.shivamsaluja.com";
    const result = await sendMagicLink(email, `${base}/sign-in?token=${token}`);
    res.json({ ok: true, ...result });
  } catch (e) { fail(res, e); }
});

router.post("/auth/verify", async (req, res) => {
  try {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    const account = token ? await store.consumeMagicToken(token) : null;
    if (!account) { res.status(400).json({ code: "invalid", message: "that link has expired or was already used" }); return; }
    const jwt = await mintToken(account.userId);
    if (!jwt) { res.status(500).json({ code: "internal", message: "WS_TOKEN_SECRET is unset" }); return; }
    res.json({ token: jwt, expiresIn: 43_200, ...account });
  } catch (e) { fail(res, e); }
});

router.post("/dev-login", async (req, res) => {
  try {
    if (process.env.ALLOW_DEV_LOGIN !== "true") {
      res.status(403).json({ code: "forbidden", message: "dev login is disabled" });
      return;
    }
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const account = email ? await store.demoAccount(email) : null;
    if (!account) { res.status(404).json({ code: "not_found", message: "no such demo account" }); return; }
    const token = await mintToken(account.userId);
    if (!token) { res.status(500).json({ code: "internal", message: "WS_TOKEN_SECRET is unset" }); return; }
    res.json({ token, expiresIn: 43_200, ...account });
  } catch (e) { fail(res, e); }
});

router.get("/demo-accounts", async (_req, res) => {
  try {
    if (process.env.ALLOW_DEV_LOGIN !== "true") { res.json([]); return; }
    res.json(await store.listDemoAccounts());
  } catch (e) { fail(res, e); }
});

// ── Tags and me ──────────────────────────────────────────────────────────────────────────────

router.get("/tags", requireAuth, async (_req, res) => {
  try { res.json(await store.listTags()); } catch (e) { fail(res, e); }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const me = await store.getMe((req as Authed).userId);
    if (!me) { res.status(404).json({ code: "not_found", message: "no such account" }); return; }
    res.json(me);
  } catch (e) { fail(res, e); }
});

router.put("/me", requireAuth, async (req, res) => {
  try {
    res.json(await store.putMe((req as Authed).userId, req.body ?? {}));
  } catch (e) { fail(res, e); }
});

// ── Profile photo ────────────────────────────────────────────────────────────────────────────
// The body is the raw image (the web app sends a JPEG it has already resized to 512px). The
// Content-Type only decides whether the body is read at all; the bytes decide what it is.

const readImage = express.raw({ type: avatars.AVATAR_TYPES, limit: avatars.AVATAR_MAX_BYTES });

/** express.raw, but its errors come back in the {code, message} shape instead of an HTML page. */
function imageBody(req: Request, res: Response, next: NextFunction): void {
  readImage(req, res, (err?: unknown) => {
    if (!err) { next(); return; }
    const tooBig = (err as { type?: string }).type === "entity.too.large";
    res.status(tooBig ? 413 : 400).json(tooBig
      ? { code: "too_large", message: "photos must be 2 MB or smaller" }
      : { code: "invalid", message: "could not read the upload" });
  });
}

router.put("/me/avatar", requireAuth, imageBody, async (req, res) => {
  try {
    const userId = (req as Authed).userId;
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(415).json({ code: "unsupported_media", message: "send a JPEG, PNG or WebP image" });
      return;
    }
    await avatars.replaceAvatar(userId, req.body, (url) => store.setAvatarUrl(userId, url));
    res.json(await store.getMe(userId));
  } catch (e) { fail(res, e); }
});

router.delete("/me/avatar", requireAuth, async (req, res) => {
  try {
    const userId = (req as Authed).userId;
    await avatars.clearAvatar(userId, (url) => store.setAvatarUrl(userId, url));
    res.json(await store.getMe(userId));
  } catch (e) { fail(res, e); }
});

// Public, like any <img>: the name carries 128 random bits and a file never changes once written
// (a new photo is a new name), so it can be cached for a year.
router.get("/media/avatars/:file", (req, res) => {
  const file = avatars.avatarFilePath(req.params.file);
  if (!file) { res.status(404).json({ code: "not_found", message: "no such photo" }); return; }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); // sendFile keeps a set header
  res.sendFile(file, (err) => {
    if (!err || res.headersSent) return;
    res.removeHeader("Cache-Control"); // a missing photo must not be cached for a year
    res.status(404).json({ code: "not_found", message: "no such photo" });
  });
});

router.put("/me/tags", requireAuth, async (req, res) => {
  try {
    const give = Array.isArray(req.body?.give) ? req.body.give : [];
    const learn = Array.isArray(req.body?.learn) ? req.body.learn : [];
    res.json(await store.putMyTags((req as Authed).userId, { give, learn }));
  } catch (e) { fail(res, e); }
});

// ── Browse and people ────────────────────────────────────────────────────────────────────────

router.get("/browse", requireAuth, async (req, res) => {
  try {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : null;
    res.json(await store.browse((req as Authed).userId, cursor));
  } catch (e) { fail(res, e); }
});

router.get("/users/:id", requireAuth, async (req, res) => {
  try {
    const profile = await store.getPublicProfile((req as Authed).userId, req.params.id);
    if (!profile) { res.status(404).json({ code: "not_found", message: "no such person" }); return; }
    res.json(profile);
  } catch (e) { fail(res, e); }
});

// ── Match requests ───────────────────────────────────────────────────────────────────────────

router.post("/match-requests", requireAuth, async (req, res) => {
  try {
    const userId = (req as Authed).userId;
    const toUserId = typeof req.body?.toUserId === "string" ? req.body.toUserId : "";
    if (!toUserId) { res.status(422).json({ code: "invalid", message: "toUserId is required" }); return; }
    const request = await store.sendRequest(userId, {
      toUserId,
      eventId: typeof req.body?.eventId === "string" ? req.body.eventId : null,
      note: typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null,
    });
    const sender = await store.getMe(userId);
    await notifyUser(
      toUserId, "match_request",
      { requestId: request.id, fromUserId: userId, fromName: sender?.displayName ?? "Someone",
        ...(request.event ? { eventId: request.event.id } : {}) },
      sender?.displayName ?? "Someone",
      request.note ?? "wants to meet you",
    );
    res.status(201).json(request);
  } catch (e) { fail(res, e); }
});

router.get("/match-requests", requireAuth, async (req, res) => {
  try { res.json(await store.listRequests((req as Authed).userId)); } catch (e) { fail(res, e); }
});

router.post("/match-requests/:id/accept", requireAuth, async (req, res) => {
  try {
    const userId = (req as Authed).userId;
    const { request, matchId, fromUserId } = await store.resolveRequest(userId, req.params.id, true);
    const accepter = await store.getMe(userId);
    if (matchId) {
      await notifyUser(
        fromUserId, "match_accepted",
        { matchId, requestId: request.id, fromUserId: userId, fromName: accepter?.displayName ?? "Someone" },
        accepter?.displayName ?? "Someone", "accepted — say hello",
      );
    }
    res.json(request);
  } catch (e) { fail(res, e); }
});

router.post("/match-requests/:id/decline", requireAuth, async (req, res) => {
  try {
    const { request } = await store.resolveRequest((req as Authed).userId, req.params.id, false);
    res.json(request);
  } catch (e) { fail(res, e); }
});

// ── Matches and messages ─────────────────────────────────────────────────────────────────────

router.get("/matches", requireAuth, async (req, res) => {
  try { res.json(await store.listMatches((req as Authed).userId)); } catch (e) { fail(res, e); }
});

async function membership(matchId: string, userId: string, res: Response): Promise<string[] | null> {
  const parts = await store.participants(matchId);
  if (!parts) { res.status(404).json({ code: "not_found", message: "no such match" }); return null; }
  if (!parts.includes(userId)) { res.status(403).json({ code: "forbidden", message: "not your match" }); return null; }
  return parts;
}

router.get("/matches/:id/messages", requireAuth, async (req, res) => {
  try {
    const userId = (req as Authed).userId;
    if (!(await membership(req.params.id, userId, res))) return;
    const before = typeof req.query.before === "string" && req.query.before ? req.query.before : null;
    res.json(await store.getMessages(req.params.id, before));
  } catch (e) { fail(res, e); }
});

router.post("/matches/:id/messages", requireAuth, async (req, res) => {
  try {
    const userId = (req as Authed).userId;
    const parts = await membership(req.params.id, userId, res);
    if (!parts) return;
    const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
    if (!body) { res.status(422).json({ code: "invalid", message: "empty message" }); return; }
    const lang = req.body?.lang === "th" ? "th" : "en";
    const { message, duplicate } = await store.insertMessage(req.params.id, userId, {
      body, lang, clientMsgId: typeof req.body?.clientMsgId === "string" ? req.body.clientMsgId : null,
    });
    // The same delivery path as the socket, so a REST send still translates and notifies.
    if (!duplicate) await deliverMessage(message, parts, userId);
    res.status(201).json(message);
  } catch (e) { fail(res, e); }
});

// ── Events ───────────────────────────────────────────────────────────────────────────────────

router.get("/events", requireAuth, async (req, res) => {
  try { res.json(await store.listEvents((req as Authed).userId)); } catch (e) { fail(res, e); }
});

router.get("/events/:id", requireAuth, async (req, res) => {
  try {
    const event = await store.getEvent((req as Authed).userId, req.params.id);
    if (!event) { res.status(404).json({ code: "not_found", message: "no such event" }); return; }
    res.json(event);
  } catch (e) { fail(res, e); }
});

router.put("/events/:id/going", requireAuth, async (req, res) => {
  try {
    await store.setGoing((req as Authed).userId, req.params.id, true);
    res.status(204).end();
  } catch (e) { fail(res, e); }
});

router.delete("/events/:id/going", requireAuth, async (req, res) => {
  try {
    await store.setGoing((req as Authed).userId, req.params.id, false);
    res.status(204).end();
  } catch (e) { fail(res, e); }
});

// ── Safety ───────────────────────────────────────────────────────────────────────────────────

router.post("/blocks", requireAuth, async (req, res) => {
  try {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
    if (!userId) { res.status(422).json({ code: "invalid", message: "userId is required" }); return; }
    await store.block((req as Authed).userId, userId);
    res.status(204).end();
  } catch (e) { fail(res, e); }
});

router.post("/reports", requireAuth, async (req, res) => {
  try {
    const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
    if (!userId) { res.status(422).json({ code: "invalid", message: "userId is required" }); return; }
    await store.report((req as Authed).userId, {
      userId,
      reason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : "",
      matchId: typeof req.body?.matchId === "string" ? req.body.matchId : null,
    });
    res.status(204).end();
  } catch (e) { fail(res, e); }
});

// ── Notifications ────────────────────────────────────────────────────────────────────────────

router.get("/notifications", requireAuth, async (req, res) => {
  try { res.json(await store.listNotifications((req as Authed).userId)); } catch (e) { fail(res, e); }
});

router.post("/notifications/read", requireAuth, async (req, res) => {
  try {
    const ids = req.body?.all === true
      ? "all" as const
      : Array.isArray(req.body?.ids) ? req.body.ids.filter((x: unknown) => typeof x === "string") : [];
    await store.markNotificationsRead((req as Authed).userId, ids);
    res.status(204).end();
  } catch (e) { fail(res, e); }
});

// ── Admin ingest (Ollie's seed + scraper) ────────────────────────────────────────────────────

router.post("/admin/events/upsert", async (req, res) => {
  try {
    const expected = process.env.ADMIN_INGEST_SECRET;
    if (!expected || req.headers["x-admin-secret"] !== expected) {
      res.status(401).json({ code: "unauthorized", message: "bad admin secret" });
      return;
    }
    const events = Array.isArray(req.body?.events) ? req.body.events : null;
    if (!events) { res.status(422).json({ code: "invalid", message: "expected {events: [...]}" }); return; }
    res.json(await store.upsertEvents(events));
  } catch (e) { fail(res, e); }
});
