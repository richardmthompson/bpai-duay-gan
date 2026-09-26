"use client";

/**
 * Sign-in for the real backend. Mock mode keeps its own controls; everything here is the http path.
 * The token is written to both a cookie (so the /api/ws-token route can hand it to the socket) and
 * localStorage (so a reload keeps the session without a round trip).
 */
import { TOKEN_COOKIE } from "./cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const MAX_AGE = 43_200; // 12 hours

export interface DemoUser {
  userId: string;
  email: string;
  displayName: string;
  community: "local" | "foreigner";
  interfaceLanguage?: "th" | "en";
}

function store(token: string, isDemo: boolean): void {
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
  try {
    localStorage.setItem("bpai.token", token);
    localStorage.setItem("bpai.isDemo", isDemo ? "1" : "0");
  } catch { /* private mode: the cookie still carries the session */ }
}

export function clearSession(): void {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
  try {
    localStorage.removeItem("bpai.token");
    localStorage.removeItem("bpai.isDemo");
  } catch { /* ignore */ }
}

export function isDemoSession(): boolean {
  try { return localStorage.getItem("bpai.isDemo") === "1"; } catch { return false; }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}/v1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new Error(data.message ?? `request failed (${res.status})`);
  return data as T;
}

export async function listDemoAccounts(): Promise<DemoUser[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/demo-accounts`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as DemoUser[]) : [];
  } catch {
    return [];
  }
}

/** One tap for the seeded cast. The api only accepts accounts flagged demo_account. */
export async function signInAsDemo(email: string): Promise<void> {
  const data = await post<{ token: string }>("/dev-login", { email });
  store(data.token, true);
}

export async function requestMagicLink(email: string): Promise<{ sent: boolean; reason?: string }> {
  return post<{ sent: boolean; reason?: string }>("/auth/magic-link", { email });
}

/** Redeems ?token= from the emailed link and returns the signed-in account. */
export async function redeemMagicLink(token: string): Promise<{ displayName?: string }> {
  const data = await post<{ token: string; displayName?: string }>("/auth/verify", { token });
  store(data.token, false);
  return data;
}
