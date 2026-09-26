import { SignJWT, jwtVerify } from "jose";

const secret = process.env.WS_TOKEN_SECRET ? new TextEncoder().encode(process.env.WS_TOKEN_SECRET) : null;

/** The web app mints these at /api/ws-token; the api only ever verifies them. */
export async function verifyToken(token: string | undefined | null): Promise<{ sub: string } | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sub ? { sub: String(payload.sub) } : null;
  } catch {
    return null;
  }
}

/** Only the seeded-account demo login uses this; the web mints its own tokens at /api/ws-token. */
export async function mintToken(userId: string): Promise<string | null> {
  if (!secret) return null;
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
}

export function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && value ? value : null;
}
