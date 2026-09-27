"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { LangToggle } from "@/components/LangToggle";
import { Avatar, Button, CommunityBadge } from "@/components/ui";
import { api } from "@/lib/api";
import { mockControls } from "@/lib/api/mock";
import type { Community } from "@/lib/contract";
import { listDemoAccounts, redeemMagicLink, requestMagicLink, signInAsDemo } from "@/lib/session";

/** Mock users carry no email; the real demo accounts do, and dev-login needs it. */
interface DemoRow {
  userId: string;
  displayName: string;
  community: Community;
  email?: string;
}

export default function SignIn() {
  const { t, lang, me, ready, setPreSignInLang, refreshMe } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoRow[]>(
    api.mode === "mock" ? (mockControls.demoUsers() as DemoRow[]) : [],
  );

  useEffect(() => {
    if (ready && me) router.replace(me.onboardingComplete ? "/browse" : "/onboarding");
  }, [ready, me, router]);

  // The emailed link lands back here as /sign-in?token=… — redeem it, then continue.
  useEffect(() => {
    if (api.mode !== "http") return;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return;
    setBusy(true);
    redeemMagicLink(token)
      .then(() => {
        window.history.replaceState({}, "", "/sign-in");
        return after();
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "could not sign you in"))
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (api.mode !== "http") return;
    void listDemoAccounts().then(setDemo);
  }, []);

  async function after() {
    const m = await refreshMe();
    router.replace(m?.onboardingComplete ? "/browse" : "/onboarding");
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) return;
    setBusy(true);
    if (api.mode === "mock") {
      mockControls.signInWithEmail(email, lang);
      await after();
    } else {
      try {
        setError(null);
        await requestMagicLink(email);
        setSent(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "could not send the link");
      }
    }
    setBusy(false);
  }


  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-5 py-10">
      <div className="flex justify-end">
        <LangToggle value={lang} onChange={setPreSignInLang} />
      </div>

      <div className="flex flex-col items-center text-center">
        {/* The wordmark is dark green on transparent and sits straight on the sand background, in light and dark mode alike. */}
        <div className="p-2">
          <Image src="/logo-woven.png" alt="Bpai Duay Gan · ไปด้วยกัน" width={808} height={807} priority className="h-auto w-64" />
        </div>
        <p className="mt-4 text-muted">{t.tagline}</p>
      </div>

      <form onSubmit={submitEmail} className="flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="email">
          {t.signIn.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.signIn.emailPlaceholder}
          className="min-h-12 rounded-xl border-2 border-line bg-surface px-4 text-base outline-none focus:border-brand"
        />
        <Button type="submit" disabled={busy}>
          {t.signIn.submit}
        </Button>
        {sent && <p className="text-sm text-muted">{t.signIn.checkEmail}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {demo.length > 0 && (
        <section className="rounded-2xl border-2 border-dashed border-line p-4">
          <h2 className="font-semibold">{t.signIn.demoTitle}</h2>
          <p className="mb-3 text-sm text-muted">{t.signIn.demoHint}</p>
          <ul className="flex flex-col gap-2">
            {demo.map((u) => (
              <li key={u.userId}>
                <button
                  type="button"
                  onClick={async () => {
                    if (api.mode === "mock") {
                      mockControls.signInAs(u.userId);
                    } else if (u.email) {
                      setBusy(true);
                      setError(null);
                      try {
                        await signInAsDemo(u.email);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "could not sign in");
                        setBusy(false);
                        return;
                      }
                    }
                    await after();
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-line bg-surface p-3 text-left shadow-hard-sm"
                >
                  <Avatar name={u.displayName} community={u.community} size={40} />
                  <span className="flex-1 font-medium">{u.displayName}</span>
                  <CommunityBadge community={u.community as Community} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
