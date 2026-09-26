import { cookies } from "next/headers";
import { TOKEN_COOKIE } from "@/lib/cookie";

// Hands back whoever is signed in on this request; it must never be prerendered or cached.
export const dynamic = "force-dynamic";

/**
 * The api cannot read this app's cookie, so the browser hands the same bearer token to both the
 * REST calls and the socket. The client fetches it here (see lib/api/http.ts) and re-fetches
 * before expiry; 401 means "not signed in" and the client treats that as signed out.
 */
export async function GET() {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return Response.json(
      { code: "unauthorized", message: "not signed in" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ token, expiresIn: 3600 }, { headers: { "Cache-Control": "no-store" } });
}
