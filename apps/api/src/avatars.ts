/**
 * Profile photos on disk: what counts as an image, how files are named, and which file a person
 * owns. Kept apart from store.ts so these rules run under test without Postgres; the database
 * write comes in as `setUrl`, which saves the new avatar_url and returns the previous one.
 *
 * Files live in $UPLOAD_DIR/avatars, outside the git checkout (deploy.sh pulls /srv/bpai), and
 * are served back at /v1/media/avatars/<file> by routes.ts.
 */
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_URL_PREFIX = "/v1/media/avatars/";
const DEFAULT_UPLOAD_DIR = "/var/lib/bpai/uploads";

// <userId>-<128 random bits>.<ext>. User ids are uuids; the class also admits the seed's ids.
const FILE_RE = /^[A-Za-z0-9_-]{1,64}-[0-9a-f]{32}\.(jpg|png|webp)$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

type SetUrl = (url: string | null) => Promise<string | null>;
export interface ImageKind { ext: "jpg" | "png" | "webp"; mime: string }

function coded(code: string, message: string): Error {
  return Object.assign(new Error(message), { code });
}

/** The image type the bytes actually are, whatever the Content-Type header claimed. */
export function sniffImage(buf: Uint8Array): ImageKind | null {
  const at = (i: number, bytes: number[]) => bytes.every((b, j) => buf[i + j] === b);
  const ascii = (i: number, s: string) => at(i, [...s].map((c) => c.charCodeAt(0)));
  if (buf.length >= 3 && at(0, [0xff, 0xd8, 0xff])) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length >= 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ext: "png", mime: "image/png" };
  if (buf.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return { ext: "webp", mime: "image/webp" };
  return null;
}

export function isAvatarFileName(name: string): boolean {
  return FILE_RE.test(name);
}

/** Read at call time, so a changed UPLOAD_DIR needs only a restart and tests can pass their own. */
export function avatarDir(env: Record<string, string | undefined> = process.env): string {
  return path.resolve(env.UPLOAD_DIR || DEFAULT_UPLOAD_DIR, "avatars");
}

/** Absolute path for a served file name, or null if the name is not one we could have written. */
export function avatarFilePath(name: string, dir = avatarDir()): string | null {
  return isAvatarFileName(name) ? path.join(dir, name) : null;
}

/**
 * The file behind an avatar_url, only when it is this person's own upload. Google images, seed
 * portraits and anyone else's file (PUT /me accepts any string) all come back null, so nothing
 * but the caller's own uploads is ever deleted.
 */
export function ownedAvatarFile(userId: string, url: string | null): string | null {
  if (!url?.startsWith(AVATAR_URL_PREFIX)) return null;
  const name = url.slice(AVATAR_URL_PREFIX.length);
  return isAvatarFileName(name) && name.startsWith(`${userId}-`) ? name : null;
}

async function removeFile(name: string, dir: string): Promise<void> {
  const file = avatarFilePath(name, dir);
  if (!file) return;
  try {
    await unlink(file);
  } catch (e) {
    // Already gone is fine; anything else leaves an orphan, which is not worth failing the request.
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error("[avatars] could not remove", name, e);
  }
}

/** Stores a new photo, points avatar_url at it, then deletes the person's previous upload. */
export async function replaceAvatar(
  userId: string, bytes: Buffer, setUrl: SetUrl, dir = avatarDir(),
): Promise<{ url: string }> {
  const kind = sniffImage(bytes);
  if (!kind) throw coded("unsupported_media", "that file is not a JPEG, PNG or WebP image");
  if (!USER_ID_RE.test(userId)) throw coded("invalid", "unexpected user id");

  await mkdir(dir, { recursive: true });
  const name = `${userId}-${randomBytes(16).toString("hex")}.${kind.ext}`;
  await writeFile(path.join(dir, name), bytes, { flag: "wx", mode: 0o644 });

  const url = AVATAR_URL_PREFIX + name;
  let previous: string | null;
  try {
    previous = await setUrl(url);
  } catch (e) {
    await removeFile(name, dir);
    throw e;
  }
  const old = ownedAvatarFile(userId, previous);
  if (old && old !== name) await removeFile(old, dir);
  return { url };
}

/** Clears avatar_url and deletes the file if it was the person's own upload. */
export async function clearAvatar(userId: string, setUrl: SetUrl, dir = avatarDir()): Promise<void> {
  const old = ownedAvatarFile(userId, await setUrl(null));
  if (old) await removeFile(old, dir);
}
