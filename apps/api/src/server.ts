import express from "express";
import { createServer } from "node:http";
import { router } from "./routes.ts";
import { attachRealtime } from "./realtime.ts";

const app = express();
app.disable("x-powered-by");
// ETags invite conditional requests for bodies that are always per-user and always changing.
app.disable("etag");
app.use(express.json({ limit: "1mb" }));

// Auth is a bearer token, never a cookie, so a permissive origin policy leaks nothing and keeps
// local development (web on :3000, api on :4000) working without configuration.
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-admin-secret");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  // Every /v1 response is one person's data behind a bearer token. Without this, a browser or a
  // proxy may serve a previous account's /me or /notifications back after a sign-out — the app
  // looks like it is still signed in as them, and notifications outlive what they point at.
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

app.use("/v1", router);
app.use((req, res) => {
  res.status(404).json({ error: { code: "not_found", message: `no route ${req.method} ${req.path}` } });
});

const server = createServer(app);
attachRealtime(server);

const port = Number(process.env.PORT ?? 4000);
server.listen(port, "0.0.0.0", () => {
  console.log(`[api] listening on :${port}`);
});
