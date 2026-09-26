// Run: node --test apps/api/src/avatars.test.ts   (no database needed)
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AVATAR_URL_PREFIX, avatarDir, avatarFilePath, clearAvatar, isAvatarFileName, ownedAvatarFile,
  replaceAvatar, sniffImage,
} from "./avatars.ts";

const USER = "3f1c2d4e-0000-4000-8000-000000000001";
const OTHER = "3f1c2d4e-0000-4000-8000-000000000002";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0x24, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);

async function tempDir() {
  return path.join(await mkdtemp(path.join(tmpdir(), "bpai-avatars-")), "avatars");
}

/** Stands in for store.setAvatarUrl: remembers the url and hands back the previous one. */
function fakeProfile(initial: string | null) {
  const state = { url: initial, calls: 0 };
  return {
    state,
    setUrl: async (url: string | null) => { state.calls++; const prev = state.url; state.url = url; return prev; },
  };
}

test("sniffImage recognises JPEG, PNG and WebP by their bytes", () => {
  assert.deepEqual(sniffImage(JPEG), { ext: "jpg", mime: "image/jpeg" });
  assert.deepEqual(sniffImage(PNG), { ext: "png", mime: "image/png" });
  assert.deepEqual(sniffImage(WEBP), { ext: "webp", mime: "image/webp" });
});

test("sniffImage rejects text, GIF, SVG, a bare RIFF and short buffers", () => {
  assert.equal(sniffImage(Buffer.from("hello, this is not a photo")), null);
  assert.equal(sniffImage(Buffer.from("GIF89a......")), null);
  assert.equal(sniffImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")), null);
  assert.equal(sniffImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")])), null);
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8])), null);
  assert.equal(sniffImage(Buffer.alloc(0)), null);
});

test("isAvatarFileName accepts only <userId>-<32 hex>.<jpg|png|webp>", () => {
  assert.ok(isAvatarFileName(`${USER}-${"a".repeat(32)}.jpg`));
  assert.ok(isAvatarFileName(`${USER}-${"0".repeat(32)}.webp`));
  for (const bad of [
    "../etc/passwd", `..%2F${USER}-${"a".repeat(32)}.jpg`, `${USER}-${"a".repeat(32)}.jpg/..`,
    `${USER}-${"a".repeat(31)}.jpg`, `${USER}-${"A".repeat(32)}.jpg`, `${USER}-${"a".repeat(32)}.gif`,
    `${USER}-${"a".repeat(32)}.jpg.html`, `.${USER}-${"a".repeat(32)}.jpg`, "", "avatars",
    `sub/${USER}-${"a".repeat(32)}.jpg`, `${USER}-${"a".repeat(32)}.JPG`,
  ]) assert.equal(isAvatarFileName(bad), false, bad);
});

test("avatarFilePath resolves inside the folder and refuses traversal", () => {
  const dir = "/data/uploads/avatars";
  const name = `${USER}-${"b".repeat(32)}.png`;
  assert.equal(avatarFilePath(name, dir), path.join(dir, name));
  assert.equal(avatarFilePath("../../../etc/passwd", dir), null);
  assert.equal(avatarFilePath("..", dir), null);
});

test("avatarDir reads UPLOAD_DIR and defaults outside the checkout", () => {
  assert.equal(avatarDir({ UPLOAD_DIR: "/srv/uploads" }), "/srv/uploads/avatars");
  assert.equal(avatarDir({}), "/var/lib/bpai/uploads/avatars");
  assert.equal(avatarDir({ UPLOAD_DIR: "" }), "/var/lib/bpai/uploads/avatars");
});

test("ownedAvatarFile only claims this person's uploads, never Google or seed urls", () => {
  const mine = `${USER}-${"c".repeat(32)}.jpg`;
  const theirs = `${OTHER}-${"c".repeat(32)}.jpg`;
  assert.equal(ownedAvatarFile(USER, AVATAR_URL_PREFIX + mine), mine);
  assert.equal(ownedAvatarFile(USER, AVATAR_URL_PREFIX + theirs), null);
  assert.equal(ownedAvatarFile(USER, "https://lh3.googleusercontent.com/a/abc=s96-c"), null);
  assert.equal(ownedAvatarFile(USER, "/portraits/nok.jpg"), null);
  assert.equal(ownedAvatarFile(USER, `https://evil.example${AVATAR_URL_PREFIX}${mine}`), null);
  assert.equal(ownedAvatarFile(USER, `${AVATAR_URL_PREFIX}../${mine}`), null);
  assert.equal(ownedAvatarFile(USER, null), null);
});

test("replaceAvatar creates the folder, stores the bytes under an unguessable name and sets the url", async () => {
  const dir = await tempDir();
  const p = fakeProfile(null);
  const { url } = await replaceAvatar(USER, JPEG, p.setUrl, dir);
  const files = await readdir(dir);
  assert.equal(files.length, 1);
  assert.match(files[0], new RegExp(`^${USER}-[0-9a-f]{32}\\.jpg$`));
  assert.equal(url, AVATAR_URL_PREFIX + files[0]);
  assert.equal(p.state.url, url);
  assert.deepEqual(await readFile(path.join(dir, files[0])), JPEG);
});

test("two uploads never share a name", async () => {
  const dir = await tempDir();
  const a = await replaceAvatar(USER, JPEG, fakeProfile(null).setUrl, dir);
  const b = await replaceAvatar(USER, JPEG, fakeProfile(null).setUrl, dir);
  assert.notEqual(a.url, b.url);
});

test("replaceAvatar names the file by what the bytes are, not what the client said", async () => {
  const dir = await tempDir();
  const { url } = await replaceAvatar(USER, PNG, fakeProfile(null).setUrl, dir);
  assert.ok(url.endsWith(".png"));
});

test("replaceAvatar rejects a non-image with unsupported_media and writes nothing", async () => {
  const dir = await tempDir();
  const p = fakeProfile(null);
  await assert.rejects(replaceAvatar(USER, Buffer.from("just some text"), p.setUrl, dir),
    (e: { code?: string }) => e.code === "unsupported_media");
  assert.equal(p.state.calls, 0);
  await assert.rejects(readdir(dir)); // folder never created
});

test("replacing deletes the person's previous upload", async () => {
  const dir = await tempDir();
  const p = fakeProfile(null);
  const first = await replaceAvatar(USER, JPEG, p.setUrl, dir);
  const second = await replaceAvatar(USER, PNG, p.setUrl, dir);
  const files = await readdir(dir);
  assert.deepEqual(files, [second.url.slice(AVATAR_URL_PREFIX.length)]);
  assert.notEqual(first.url, second.url);
});

test("replacing leaves Google and seed images, and other people's files, alone", async () => {
  const dir = await tempDir();
  await mkdir(dir, { recursive: true });
  const theirs = `${OTHER}-${"d".repeat(32)}.jpg`;
  await writeFile(path.join(dir, theirs), JPEG);
  // Someone pointed their avatar_url at another person's file (PUT /me accepts any string).
  await replaceAvatar(USER, JPEG, fakeProfile(AVATAR_URL_PREFIX + theirs).setUrl, dir);
  await replaceAvatar(USER, JPEG, fakeProfile("https://lh3.googleusercontent.com/a/x").setUrl, dir);
  const files = await readdir(dir);
  assert.ok(files.includes(theirs));
  assert.equal(files.length, 3);
});

test("a failed database write removes the new file again", async () => {
  const dir = await tempDir();
  const boom = async () => { throw Object.assign(new Error("finish your profile first"), { code: "not_found" }); };
  await assert.rejects(replaceAvatar(USER, JPEG, boom, dir), (e: { code?: string }) => e.code === "not_found");
  assert.deepEqual(await readdir(dir), []);
});

test("a previous file that is already gone does not fail the upload", async () => {
  const dir = await tempDir();
  const missing = `${USER}-${"e".repeat(32)}.jpg`;
  const { url } = await replaceAvatar(USER, JPEG, fakeProfile(AVATAR_URL_PREFIX + missing).setUrl, dir);
  assert.ok(url.startsWith(AVATAR_URL_PREFIX));
});

test("clearAvatar sets the url to null and removes the uploaded file", async () => {
  const dir = await tempDir();
  const p = fakeProfile(null);
  await replaceAvatar(USER, JPEG, p.setUrl, dir);
  await clearAvatar(USER, p.setUrl, dir);
  assert.equal(p.state.url, null);
  assert.deepEqual(await readdir(dir), []);
});

test("clearAvatar on a Google image clears the url and touches no file", async () => {
  const dir = await tempDir();
  const p = fakeProfile("https://lh3.googleusercontent.com/a/x");
  await clearAvatar(USER, p.setUrl, dir);
  assert.equal(p.state.url, null);
});
