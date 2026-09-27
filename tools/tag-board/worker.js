const TAGS_URLS = [
  "https://raw.githubusercontent.com/richardmthompson/bpai-duay-gan/main/docs/drafts/tag-taxonomy-proposal.json",
];

const KINDS = ["comment", "thai", "rename", "remove", "merge", "new"];
const GIVERS = ["local", "foreigner", "either"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/") return html(PAGE);
      if (url.pathname === "/profiles") return html(PROFILES_PAGE);
      if (url.pathname === "/api/profiles" && request.method === "GET") return listProfiles(env);
      const img = url.pathname.match(/^\/img\/([a-z0-9]{1,10})$/);
      if (img && request.method === "GET") return profileImage(env, img[1]);
      if (url.pathname.startsWith("/api/admin/")) {
        if (!env.ADMIN_SECRET || request.headers.get("x-admin-secret") !== env.ADMIN_SECRET) {
          return json({ error: "forbidden" }, 403);
        }
        if (url.pathname === "/api/admin/profiles" && request.method === "POST") return importProfiles(request, env);
        const gen = url.pathname.match(/^\/api\/admin\/profiles\/([a-z0-9]{1,10})\/image$/);
        if (gen && request.method === "POST") return generateImage(env, gen[1]);
        if (gen && request.method === "PUT") return uploadImage(request, env, gen[1]);
      }
      if (url.pathname === "/api/tags" && request.method === "GET") return tags();
      if (url.pathname === "/api/comments" && request.method === "GET") return list(env);
      if (url.pathname === "/api/comments" && request.method === "POST") return create(request, env);
      const m = url.pathname.match(/^\/api\/comments\/(\d+)$/);
      if (m && request.method === "DELETE") return remove(request, env, Number(m[1]));
      if (url.pathname === "/api/ideas" && request.method === "GET") return listIdeas(env);
      if (url.pathname === "/api/ideas" && request.method === "POST") return createIdea(request, env);
      const mi = url.pathname.match(/^\/api\/ideas\/(\d+)$/);
      if (mi && request.method === "DELETE") return removeIdea(request, env, Number(mi[1]));
      return json({ error: "not found" }, 404);
    } catch (err) {
      return json({ error: "server error" }, 500);
    }
  },
};

async function tags() {
  for (const src of TAGS_URLS) {
    const res = await fetch(src, { cf: { cacheTtl: 60, cacheEverything: true } });
    if (res.ok) {
      return new Response(await res.text(), {
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "max-age=30" },
      });
    }
  }
  return json({ error: "could not load tags from GitHub" }, 502);
}

async function list(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, tag_id, kind, author, body, created_at FROM comments ORDER BY created_at ASC, id ASC"
  ).all();
  return json({ comments: results });
}

async function create(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (input.website) return json({ ok: true });

  const tagId = String(input.tagId || "");
  const kind = String(input.kind || "comment");
  const author = String(input.author || "").trim().slice(0, 40);
  const body = String(input.body || "").trim();

  if (!/^(_new|[a-z0-9-]{1,60})$/.test(tagId)) return json({ error: "bad tag" }, 400);
  if (!KINDS.includes(kind)) return json({ error: "bad kind" }, 400);
  if (!author) return json({ error: "name required" }, 400);
  if (!body || body.length > 1000) return json({ error: "comment must be 1-1000 characters" }, 400);

  const token = crypto.randomUUID();
  const row = await env.DB.prepare(
    "INSERT INTO comments (tag_id, kind, author, body, delete_token) VALUES (?, ?, ?, ?, ?) RETURNING id, tag_id, kind, author, body, created_at"
  )
    .bind(tagId, kind, author, body, token)
    .first();
  return json({ comment: row, deleteToken: token }, 201);
}

async function remove(request, env, id) {
  const token = request.headers.get("x-delete-token") || "";
  const { meta } = await env.DB.prepare("DELETE FROM comments WHERE id = ? AND delete_token = ?")
    .bind(id, token)
    .run();
  if (!meta.changes) return json({ error: "not allowed" }, 403);
  return json({ ok: true });
}

async function listIdeas(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, label_en, label_th, category, typical_giver, emoji, author, created_at FROM tag_ideas ORDER BY created_at ASC, id ASC"
  ).all();
  return json({ ideas: results });
}

async function createIdea(request, env) {
  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  if (input.website) return json({ ok: true });

  const labelEn = String(input.label_en || "").trim().slice(0, 60);
  const labelTh = String(input.label_th || "").trim().slice(0, 60);
  const category = String(input.category || "other").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 40) || "other";
  const giver = String(input.typical_giver || "either");
  const emoji = String(input.emoji || "").trim().slice(0, 8);
  const author = String(input.author || "").trim().slice(0, 40);

  if (!labelEn) return json({ error: "English name required" }, 400);
  if (!author) return json({ error: "name required" }, 400);
  if (!GIVERS.includes(giver)) return json({ error: "bad giver" }, 400);

  const token = crypto.randomUUID();
  const row = await env.DB.prepare(
    "INSERT INTO tag_ideas (label_en, label_th, category, typical_giver, emoji, author, delete_token) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id, label_en, label_th, category, typical_giver, emoji, author, created_at"
  )
    .bind(labelEn, labelTh, category, giver, emoji, author, token)
    .first();
  return json({ idea: row, deleteToken: token }, 201);
}

async function removeIdea(request, env, id) {
  const token = request.headers.get("x-delete-token") || "";
  const { meta } = await env.DB.prepare("DELETE FROM tag_ideas WHERE id = ? AND delete_token = ?")
    .bind(id, token)
    .run();
  if (!meta.changes) return json({ error: "not allowed" }, 403);
  await env.DB.prepare("DELETE FROM comments WHERE tag_id = ?").bind("idea-" + id).run();
  return json({ ok: true });
}

async function listProfiles(env) {
  const [people, tagRows, imgRows] = await env.DB.batch([
    env.DB.prepare(
      "SELECT id, display_name, community, gender, age, occupation, occupation_th, origin, neighborhood, stay, interface_language, intro, intro_en FROM profiles ORDER BY community DESC, id ASC"
    ),
    env.DB.prepare("SELECT profile_id, tag_id, direction FROM profile_tags"),
    env.DB.prepare("SELECT profile_id FROM profile_images"),
  ]);
  const withImage = new Set(imgRows.results.map((r) => r.profile_id));
  const byId = {};
  const profiles = people.results.map((p) => {
    byId[p.id] = { ...p, give: [], learn: [], has_image: withImage.has(p.id) };
    return byId[p.id];
  });
  for (const t of tagRows.results) byId[t.profile_id]?.[t.direction].push(t.tag_id);
  return new Response(JSON.stringify({ profiles }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "max-age=30" },
  });
}

async function profileImage(env, id) {
  const row = await env.DB.prepare("SELECT mime, data FROM profile_images WHERE profile_id = ?").bind(id).first();
  if (!row) return new Response("not found", { status: 404 });
  const bytes = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
  return new Response(bytes, { headers: { "content-type": row.mime, "cache-control": "public, max-age=86400" } });
}

async function importProfiles(request, env) {
  const list = await request.json();
  if (!Array.isArray(list)) return json({ error: "expected an array" }, 400);
  const stmts = [];
  for (const p of list) {
    stmts.push(
      env.DB.prepare(
        "INSERT OR REPLACE INTO profiles (id, display_name, community, gender, age, occupation, occupation_th, origin, neighborhood, stay, interface_language, politeness_register, intro, intro_en, image_prompt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(
        p.id, p.display_name, p.community, p.gender, p.age, p.occupation, p.occupation_th, p.origin,
        p.neighborhood, p.stay, p.interface_language, p.politeness_register, p.intro, p.intro_en, p.image_prompt
      ),
      env.DB.prepare("DELETE FROM profile_tags WHERE profile_id = ?").bind(p.id)
    );
    for (const dir of ["give", "learn"]) {
      for (const tag of p[dir] || []) {
        stmts.push(
          env.DB.prepare("INSERT OR IGNORE INTO profile_tags (profile_id, tag_id, direction) VALUES (?, ?, ?)").bind(p.id, tag, dir)
        );
      }
    }
  }
  await env.DB.batch(stmts);
  return json({ ok: true, imported: list.length });
}

async function generateImage(env, id) {
  const p = await env.DB.prepare("SELECT image_prompt FROM profiles WHERE id = ?").bind(id).first();
  if (!p) return json({ error: "no such profile" }, 404);
  const out = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt: p.image_prompt, steps: 6 });
  if (!out || !out.image) return json({ error: "no image returned" }, 502);
  await env.DB.prepare("INSERT OR REPLACE INTO profile_images (profile_id, mime, data) VALUES (?, 'image/jpeg', ?)")
    .bind(id, out.image)
    .run();
  return json({ ok: true, id, bytes: Math.round((out.image.length * 3) / 4) });
}

async function uploadImage(request, env, id) {
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > 1500000) return json({ error: "image must be under 1.5 MB" }, 400);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  await env.DB.prepare("INSERT OR REPLACE INTO profile_images (profile_id, mime, data) VALUES (?, ?, ?)")
    .bind(id, request.headers.get("content-type") || "image/jpeg", btoa(bin))
    .run();
  return json({ ok: true, id, bytes: bytes.length });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function html(body) {
  return new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bpai Dûay Gan — tag board</title>
<style>
  :root { --bg:#faf7f2; --card:#fff; --ink:#1f1b16; --muted:#6f675c; --line:#e7e0d5; --accent:#c2410c; --local:#0f766e; --foreigner:#7c3aed; --either:#6b7280; }
  * { box-sizing: border-box; }
  [hidden] { display:none !important; }
  body { margin:0; font:15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Thai", sans-serif; background:var(--bg); color:var(--ink); }
  header { padding:28px 20px 12px; max-width:1200px; margin:0 auto; }
  h1 { margin:0 0 4px; font-size:26px; }
  header p { margin:0; color:var(--muted); }
  .bar { max-width:1200px; margin:0 auto; padding:12px 20px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; position:sticky; top:0; background:var(--bg); z-index:2; border-bottom:1px solid var(--line); }
  .bar input, .bar select { padding:8px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; background:#fff; }
  .bar input[type=search] { flex:1; min-width:200px; }
  .stats { color:var(--muted); font-size:13px; }
  main { max-width:1200px; margin:0 auto; padding:8px 20px 80px; }
  h2 { font-size:17px; margin:26px 0 10px; text-transform:capitalize; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px; }
  .tag { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; cursor:pointer; text-align:left; font:inherit; color:inherit; display:flex; flex-direction:column; gap:4px; transition:border-color .15s, transform .15s; }
  .tag:hover { border-color:var(--accent); transform:translateY(-1px); }
  .tag .top { display:flex; justify-content:space-between; align-items:center; }
  .emoji { font-size:22px; }
  .en { font-weight:600; }
  .th { color:var(--muted); }
  .meta { display:flex; justify-content:space-between; align-items:center; margin-top:4px; font-size:12px; }
  .giver { padding:2px 8px; border-radius:99px; color:#fff; }
  .giver.local { background:var(--local); } .giver.foreigner { background:var(--foreigner); } .giver.either { background:var(--either); }
  .count { color:var(--muted); }
  .count.has { color:var(--accent); font-weight:600; }
  .newbox { margin-top:30px; }
  .newbox button { padding:10px 14px; border-radius:10px; border:1px dashed var(--accent); background:#fff; color:var(--accent); font:inherit; cursor:pointer; }
  .panel { position:fixed; top:0; right:0; height:100%; width:min(440px, 100%); background:#fff; border-left:1px solid var(--line); box-shadow:-8px 0 30px rgba(0,0,0,.08); transform:translateX(100%); transition:transform .2s; display:flex; flex-direction:column; z-index:5; }
  .panel.open { transform:none; }
  .panel .head { padding:18px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:10px; }
  .panel .head h3 { margin:0; font-size:18px; }
  .panel .head .sub { color:var(--muted); font-size:13px; }
  .close { border:0; background:none; font-size:22px; cursor:pointer; color:var(--muted); }
  .thread { flex:1; overflow:auto; padding:14px 18px; display:flex; flex-direction:column; gap:10px; }
  .c { border:1px solid var(--line); border-radius:10px; padding:10px; }
  .c .who { font-size:12px; color:var(--muted); display:flex; justify-content:space-between; gap:8px; }
  .c .kind { font-size:11px; padding:1px 7px; border-radius:99px; background:#fdebd3; color:#9a3412; margin-left:6px; }
  .c .body { white-space:pre-wrap; margin-top:4px; }
  .c .del { border:0; background:none; color:var(--muted); cursor:pointer; font-size:12px; }
  .empty { color:var(--muted); }
  form { border-top:1px solid var(--line); padding:14px 18px; display:flex; flex-direction:column; gap:8px; }
  form input, form select, form textarea { padding:8px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; }
  form textarea { min-height:80px; resize:vertical; }
  form .row { display:flex; gap:8px; }
  form .row > * { flex:1; }
  form button { padding:10px; border:0; border-radius:8px; background:var(--accent); color:#fff; font:inherit; font-weight:600; cursor:pointer; }
  .tag.idea { border-style:dashed; border-color:#e9b98f; background:#fffaf4; }
  .ideabadge { font-size:11px; padding:1px 7px; border-radius:99px; background:#fdebd3; color:#9a3412; }
  .addbtn { padding:8px 12px; border:0; border-radius:8px; background:var(--accent); color:#fff; font:inherit; font-weight:600; cursor:pointer; }
  .delidea { align-self:flex-start; border:1px solid var(--line); background:#fff; color:var(--muted); border-radius:8px; padding:4px 10px; font:inherit; font-size:12px; cursor:pointer; margin:0 18px 10px; }
  .hp { position:absolute; left:-9999px; }
  .err { color:#b91c1c; font-size:13px; min-height:1em; }
  .nav { max-width:1200px; margin:0 auto; padding:16px 20px 0; display:flex; gap:8px; }
  .nav a { padding:8px 16px; border-radius:99px; border:1px solid var(--line); background:#fff; color:var(--ink); text-decoration:none; font-weight:600; }
  .nav a.on { background:var(--accent); border-color:var(--accent); color:#fff; }
</style>
</head>
<body>
<nav class="nav"><a href="/" class="on">🏷️ Tags</a><a href="/profiles">🙂 Profiles</a></nav>
<header>
  <h1>ไปด้วยกัน · Bpai Dûay Gan — tag board</h1>
  <p>Every Give / Learn tag in the merged list (our draft plus the 85-tag taxonomy, deduplicated), plus tag ideas from anyone. Click a tag to leave a note: a comment, a Thai label fix, a rename, a merge, or a vote to remove it.</p>
</header>
<div class="bar">
  <input type="search" id="q" placeholder="Search tags in English or Thai">
  <select id="giver">
    <option value="">Anyone gives</option>
    <option value="local">Usually locals give</option>
    <option value="foreigner">Usually foreigners give</option>
    <option value="either">Either</option>
  </select>
  <label class="stats"><input type="checkbox" id="onlyNotes"> Only tags with notes</label>
  <span class="stats" id="stats"></span>
  <button class="addbtn" id="addIdea">＋ Add a tag idea</button>
</div>
<main id="main"><p class="empty">Loading tags…</p></main>

<aside class="panel" id="panel" aria-hidden="true">
  <div class="head">
    <div><h3 id="pTitle"></h3><div class="sub" id="pSub"></div></div>
    <button class="close" id="pClose" aria-label="Close">×</button>
  </div>
  <div class="thread" id="thread"></div>
  <button class="delidea" id="delIdea" hidden>Delete my idea</button>
  <form id="ideaForm" hidden>
    <input id="iEn" placeholder="Tag name in English (e.g. Pottery)" maxlength="60" required>
    <input id="iTh" placeholder="ชื่อแท็กภาษาไทย (optional)" maxlength="60">
    <div class="row">
      <select id="iCat"></select>
      <select id="iGiver">
        <option value="either">Either gives</option>
        <option value="local">Usually locals give</option>
        <option value="foreigner">Usually foreigners give</option>
      </select>
    </div>
    <div class="row">
      <input id="iEmoji" placeholder="Emoji (optional)" maxlength="8">
      <input id="iAuthor" placeholder="Your name" maxlength="40" required>
    </div>
    <input class="hp" id="iWebsite" tabindex="-1" autocomplete="off">
    <div class="err" id="iErr"></div>
    <button type="submit">Add tag idea</button>
  </form>
  <form id="form">
    <div class="row">
      <input id="author" placeholder="Your name" maxlength="40" required>
      <select id="kind">
        <option value="comment">Comment</option>
        <option value="thai">Thai label fix</option>
        <option value="rename">Rename</option>
        <option value="merge">Merge with…</option>
        <option value="remove">Remove</option>
      </select>
    </div>
    <textarea id="body" placeholder="Your note" maxlength="1000" required></textarea>
    <input class="hp" id="website" tabindex="-1" autocomplete="off">
    <div class="err" id="err"></div>
    <button type="submit">Post note</button>
  </form>
</aside>

<script>
var tagsById = {};
var categories = [];
var comments = [];
var current = null;
var mine = JSON.parse(localStorage.getItem("tb-mine") || "{}");
var mineIdeas = JSON.parse(localStorage.getItem("tb-ideas") || "{}");
var $ = function (id) { return document.getElementById(id); };

$("author").value = localStorage.getItem("tb-author") || "";

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function load() {
  return Promise.all([
    fetch("/api/tags").then(function (r) { return r.json(); }),
    fetch("/api/comments").then(function (r) { return r.json(); }),
    fetch("/api/ideas").then(function (r) { return r.json(); })
  ]).then(function (res) {
    var data = res[0];
    comments = res[1].comments || [];
    tagsById = {};
    var byCat = {};
    categories = [];
    function add(t) {
      tagsById[t.id] = t;
      var c = t.category || "other";
      if (!byCat[c]) { byCat[c] = []; categories.push(c); }
      byCat[c].push(t);
    }
    (data.tags || []).forEach(add);
    (res[2].ideas || []).forEach(function (i) {
      add({
        id: "idea-" + i.id, ideaId: i.id, idea: true, author: i.author,
        label_en: i.label_en, label_th: i.label_th, emoji: i.emoji,
        category: i.category, typical_giver: i.typical_giver, sort_order: 100000 + i.id
      });
    });
    categories = categories.map(function (c) {
      return { id: c, tags: byCat[c].sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); }) };
    });
    fillCategories();
    render();
    if (current && current !== "_idea" && tagsById[current]) openPanel(current);
  }).catch(function () {
    $("main").textContent = "Could not load tags.";
  });
}

function countFor(id) {
  return comments.filter(function (c) { return c.tag_id === id; }).length;
}

function render() {
  var q = $("q").value.trim().toLowerCase();
  var giver = $("giver").value;
  var onlyNotes = $("onlyNotes").checked;
  var main = $("main");
  main.textContent = "";
  var shown = 0, total = 0;

  categories.forEach(function (cat) {
    var tags = cat.tags.filter(function (t) {
      total++;
      if (giver && t.typical_giver !== giver) return false;
      if (onlyNotes && !countFor(t.id)) return false;
      if (q && (t.label_en + " " + t.label_th + " " + t.id).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    if (!tags.length) return;
    shown += tags.length;
    main.appendChild(el("h2", null, cat.id.replace(/-/g, " ") + " · " + tags.length));
    var grid = el("div", "grid");
    tags.forEach(function (t) {
      var b = el("button", "tag" + (t.idea ? " idea" : ""));
      var top = el("div", "top");
      top.appendChild(el("span", "emoji", t.emoji || "🏷️"));
      if (t.idea) top.appendChild(el("span", "ideabadge", "idea · " + t.author));
      b.appendChild(top);
      b.appendChild(el("div", "en", t.label_en));
      b.appendChild(el("div", "th", t.label_th));
      var meta = el("div", "meta");
      var g = t.typical_giver || "either";
      meta.appendChild(el("span", "giver " + g, g === "either" ? "either gives" : g + "s give"));
      var n = countFor(t.id);
      meta.appendChild(el("span", "count" + (n ? " has" : ""), n ? n + (n === 1 ? " note" : " notes") : "no notes"));
      b.appendChild(meta);
      b.onclick = function () { openPanel(t.id); };
      grid.appendChild(b);
    });
    main.appendChild(grid);
  });

  var box = el("div", "newbox");
  var nb = el("button", null, "＋ Add a tag idea");
  nb.onclick = openIdeaForm;
  box.appendChild(nb);
  main.appendChild(box);

  $("stats").textContent = shown + " of " + total + " tags · " + comments.length + " notes";
}

function openPanel(id) {
  current = id;
  var t = tagsById[id];
  $("pTitle").textContent = t ? (t.emoji || "") + " " + t.label_en : id;
  $("pSub").textContent = t ? (t.idea ? (t.label_th || "no Thai name yet") + " · idea by " + t.author : t.label_th + " · " + id) : "";
  $("form").hidden = false;
  $("ideaForm").hidden = true;
  $("delIdea").hidden = !(t && t.idea && mineIdeas[t.ideaId]);
  $("thread").hidden = false;
  var thread = $("thread");
  thread.textContent = "";
  var list = comments.filter(function (c) { return c.tag_id === id; });
  if (!list.length) thread.appendChild(el("p", "empty", "No notes yet. Be the first."));
  list.forEach(function (c) {
    var d = el("div", "c");
    var who = el("div", "who");
    var left = el("span", null, c.author);
    if (c.kind && c.kind !== "comment") left.appendChild(el("span", "kind", kindLabel(c.kind)));
    who.appendChild(left);
    var right = el("span", null, new Date(c.created_at).toLocaleString());
    if (mine[c.id]) {
      var del = el("button", "del", " · delete");
      del.onclick = function () { removeComment(c.id); };
      right.appendChild(del);
    }
    who.appendChild(right);
    d.appendChild(who);
    d.appendChild(el("div", "body", c.body));
    thread.appendChild(d);
  });
  $("panel").classList.add("open");
  $("panel").setAttribute("aria-hidden", "false");
  $("err").textContent = "";
}

function fillCategories() {
  var sel = $("iCat");
  var keep = sel.value;
  sel.textContent = "";
  var ids = categories.map(function (c) { return c.id; });
  if (ids.indexOf("other") === -1) ids.push("other");
  ids.forEach(function (c) {
    var o = el("option", null, c.replace(/-/g, " "));
    o.value = c;
    sel.appendChild(o);
  });
  if (keep) sel.value = keep;
}

function openIdeaForm() {
  current = "_idea";
  $("pTitle").textContent = "Add a tag idea";
  $("pSub").textContent = "It shows up as a tag card that anyone can comment on.";
  $("thread").hidden = true;
  $("form").hidden = true;
  $("delIdea").hidden = true;
  $("ideaForm").hidden = false;
  $("iAuthor").value = localStorage.getItem("tb-author") || "";
  $("iErr").textContent = "";
  $("panel").classList.add("open");
  $("panel").setAttribute("aria-hidden", "false");
  $("iEn").focus();
}

$("addIdea").onclick = openIdeaForm;

$("ideaForm").onsubmit = function (e) {
  e.preventDefault();
  var author = $("iAuthor").value.trim();
  localStorage.setItem("tb-author", author);
  $("author").value = author;
  var payload = {
    label_en: $("iEn").value,
    label_th: $("iTh").value,
    category: $("iCat").value,
    typical_giver: $("iGiver").value,
    emoji: $("iEmoji").value,
    author: author,
    website: $("iWebsite").value
  };
  fetch("/api/ideas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { $("iErr").textContent = res.d.error || "Could not add."; return; }
      if (res.d.idea) {
        mineIdeas[res.d.idea.id] = res.d.deleteToken;
        localStorage.setItem("tb-ideas", JSON.stringify(mineIdeas));
        current = "idea-" + res.d.idea.id;
      }
      $("iEn").value = ""; $("iTh").value = ""; $("iEmoji").value = "";
      load();
    });
};

$("delIdea").onclick = function () {
  var t = tagsById[current];
  if (!t || !t.idea || !confirm("Delete this tag idea and its notes?")) return;
  fetch("/api/ideas/" + t.ideaId, { method: "DELETE", headers: { "x-delete-token": mineIdeas[t.ideaId] } })
    .then(function () {
      delete mineIdeas[t.ideaId];
      localStorage.setItem("tb-ideas", JSON.stringify(mineIdeas));
      $("pClose").onclick();
      load();
    });
};

function kindLabel(k) {
  return { thai: "Thai label fix", rename: "rename", merge: "merge", remove: "remove", "new": "new tag" }[k] || k;
}

function removeComment(id) {
  fetch("/api/comments/" + id, { method: "DELETE", headers: { "x-delete-token": mine[id] } })
    .then(function () { delete mine[id]; localStorage.setItem("tb-mine", JSON.stringify(mine)); load(); });
}

$("pClose").onclick = function () {
  current = null;
  $("panel").classList.remove("open");
  $("panel").setAttribute("aria-hidden", "true");
};

$("form").onsubmit = function (e) {
  e.preventDefault();
  var author = $("author").value.trim();
  localStorage.setItem("tb-author", author);
  var payload = {
    tagId: current,
    kind: $("kind").value,
    author: author,
    body: $("body").value,
    website: $("website").value
  };
  fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
    .then(function (res) {
      if (!res.ok) { $("err").textContent = res.d.error || "Could not post."; return; }
      if (res.d.comment) { mine[res.d.comment.id] = res.d.deleteToken; localStorage.setItem("tb-mine", JSON.stringify(mine)); }
      $("body").value = "";
      load();
    });
};

["q", "giver", "onlyNotes"].forEach(function (id) { $(id).addEventListener("input", render); });
load();
setInterval(load, 20000);
</script>
</body>
</html>`;

const PROFILES_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bpai Dûay Gan — demo profiles</title>
<style>
  :root { --bg:#faf7f2; --card:#fff; --ink:#1f1b16; --muted:#6f675c; --line:#e7e0d5; --accent:#c2410c; --local:#0f766e; --foreigner:#7c3aed; }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans Thai", sans-serif; background:var(--bg); color:var(--ink); }
  header, .bar, main { max-width:1200px; margin:0 auto; padding-left:20px; padding-right:20px; }
  header { padding-top:28px; padding-bottom:8px; }
  h1 { margin:0 0 4px; font-size:26px; }
  header p { margin:0; color:var(--muted); }
  a { color:var(--accent); }
  .bar { padding-top:12px; padding-bottom:12px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; position:sticky; top:0; background:var(--bg); z-index:2; border-bottom:1px solid var(--line); }
  .bar input, .bar select, .bar button { padding:8px 10px; border:1px solid var(--line); border-radius:8px; font:inherit; background:#fff; }
  .bar input { flex:1; min-width:180px; }
  .bar button { cursor:pointer; }
  .stats { color:var(--muted); font-size:13px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(270px, 1fr)); gap:14px; padding:18px 0 80px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; }
  .photo { aspect-ratio:1/1; background:#eee6da; position:relative; }
  .photo img { width:100%; height:100%; object-fit:cover; display:block; }
  .photo .badge { position:absolute; top:10px; left:10px; padding:3px 9px; border-radius:99px; color:#fff; font-size:12px; font-weight:600; }
  .badge.local { background:var(--local); } .badge.foreigner { background:var(--foreigner); }
  .noimg { display:flex; align-items:center; justify-content:center; height:100%; font-size:54px; color:#c9bca9; }
  .body { padding:12px 14px 14px; display:flex; flex-direction:column; gap:6px; }
  .name { font-weight:700; font-size:17px; }
  .job { font-size:14px; }
  .where { color:var(--muted); font-size:12px; }
  .intro { font-size:14px; }
  .intro-en { color:var(--muted); font-size:13px; }
  .label { font-size:11px; text-transform:uppercase; letter-spacing:.04em; color:var(--muted); margin-top:4px; }
  .chips { display:flex; flex-wrap:wrap; gap:5px; }
  .chip { font-size:12px; padding:3px 8px; border-radius:99px; border:1px solid var(--line); background:#fbf8f3; cursor:pointer; }
  .chip.give { border-color:#b7e0d8; background:#effaf7; }
  .chip.learn { border-color:#e4d3fb; background:#f7f2ff; }
  .chip.on { outline:2px solid var(--accent); }
  .nav { max-width:1200px; margin:0 auto; padding:16px 20px 0; display:flex; gap:8px; }
  .nav a { padding:8px 16px; border-radius:99px; border:1px solid var(--line); background:#fff; color:var(--ink); text-decoration:none; font-weight:600; }
  .nav a.on { background:var(--accent); border-color:var(--accent); color:#fff; }
</style>
</head>
<body>
<nav class="nav"><a href="/">🏷️ Tags</a><a href="/profiles" class="on">🙂 Profiles</a></nav>
<header>
  <h1>ไปด้วยกัน · Bpai Dûay Gan — demo profiles</h1>
  <p>100 made-up people for the demo: 50 Thai locals and 50 foreigners, each with what they can give and what they want to learn. Portraits are AI-generated.</p>
</header>
<div class="bar">
  <input type="search" id="q" placeholder="Search name, job, neighbourhood">
  <select id="community">
    <option value="">Everyone</option>
    <option value="local">Thai locals</option>
    <option value="foreigner">Foreigners</option>
  </select>
  <select id="tag"><option value="">Any tag</option></select>
  <button id="lang">ภาษาไทย</button>
  <span class="stats" id="stats"></span>
</div>
<main><div class="grid" id="grid"><p class="stats">Loading profiles…</p></div></main>
<script>
var people = [];
var tags = {};
var lang = "en";
var $ = function (id) { return document.getElementById(id); };

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function tagLabel(id) {
  var t = tags[id];
  if (!t) return id;
  return (t.emoji ? t.emoji + " " : "") + (lang === "th" ? t.label_th : t.label_en);
}

Promise.all([
  fetch("/api/profiles").then(function (r) { return r.json(); }),
  fetch("/api/tags").then(function (r) { return r.json(); })
]).then(function (res) {
  people = res[0].profiles || [];
  (res[1].tags || []).forEach(function (t) { tags[t.id] = t; });
  fillTagFilter();
  render();
});

function fillTagFilter() {
  var sel = $("tag");
  var keep = sel.value;
  sel.textContent = "";
  var any = el("option", null, lang === "th" ? "ทุกแท็ก" : "Any tag");
  any.value = "";
  sel.appendChild(any);
  Object.keys(tags).sort(function (a, b) { return (tags[a].sort_order || 0) - (tags[b].sort_order || 0); }).forEach(function (id) {
    var o = el("option", null, tagLabel(id));
    o.value = id;
    sel.appendChild(o);
  });
  sel.value = keep;
}

function render() {
  var q = $("q").value.trim().toLowerCase();
  var community = $("community").value;
  var tag = $("tag").value;
  var grid = $("grid");
  grid.textContent = "";
  var shown = 0;
  people.forEach(function (p) {
    if (community && p.community !== community) return;
    if (tag && p.give.indexOf(tag) === -1 && p.learn.indexOf(tag) === -1) return;
    var hay = [p.display_name, p.occupation, p.occupation_th || "", p.neighborhood, p.origin].join(" ").toLowerCase();
    if (q && hay.indexOf(q) === -1) return;
    shown++;
    grid.appendChild(card(p, tag));
  });
  $("stats").textContent = shown + " of " + people.length + " people";
}

function card(p, activeTag) {
  var c = el("div", "card");
  var photo = el("div", "photo");
  if (p.has_image) {
    var im = el("img");
    im.loading = "lazy";
    im.alt = p.display_name;
    im.src = "/img/" + p.id;
    photo.appendChild(im);
  } else {
    photo.appendChild(el("div", "noimg", "🙂"));
  }
  var isLocal = p.community === "local";
  photo.appendChild(el("span", "badge " + p.community, isLocal ? (lang === "th" ? "คนท้องถิ่น" : "Thai local") : (lang === "th" ? "ชาวต่างชาติ" : "Foreigner")));
  c.appendChild(photo);

  var b = el("div", "body");
  b.appendChild(el("div", "name", p.display_name + ", " + p.age));
  b.appendChild(el("div", "job", lang === "th" && p.occupation_th ? p.occupation_th : p.occupation));
  var where = isLocal ? p.neighborhood : p.origin + " · " + p.neighborhood + " · " + p.stay;
  b.appendChild(el("div", "where", where));
  if (isLocal) {
    b.appendChild(el("div", "intro", lang === "th" ? p.intro : p.intro_en));
    b.appendChild(el("div", "intro-en", lang === "th" ? p.intro_en : p.intro));
  } else {
    b.appendChild(el("div", "intro", p.intro));
  }
  b.appendChild(el("div", "label", lang === "th" ? "ให้ได้" : "Can give"));
  b.appendChild(chips(p.give, "give", activeTag));
  b.appendChild(el("div", "label", lang === "th" ? "อยากเรียน" : "Wants to learn"));
  b.appendChild(chips(p.learn, "learn", activeTag));
  c.appendChild(b);
  return c;
}

function chips(list, kind, activeTag) {
  var wrap = el("div", "chips");
  list.forEach(function (id) {
    var ch = el("span", "chip " + kind + (id === activeTag ? " on" : ""), tagLabel(id));
    ch.title = tags[id] ? tags[id].label_en + " · " + tags[id].label_th : id;
    ch.onclick = function () { $("tag").value = id; render(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    wrap.appendChild(ch);
  });
  return wrap;
}

$("lang").onclick = function () {
  lang = lang === "en" ? "th" : "en";
  $("lang").textContent = lang === "en" ? "ภาษาไทย" : "English";
  fillTagFilter();
  render();
};
["q", "community", "tag"].forEach(function (id) { $(id).addEventListener("input", render); });
</script>
</body>
</html>`;
