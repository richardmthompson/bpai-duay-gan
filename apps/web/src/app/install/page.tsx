"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import type { Lang } from "@/lib/contract";

/** Chrome's install event is not in the DOM types. */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * The lander the QR code points at: install first, sign in second. Everything it needs is
 * already in the manifest — this page just walks people through whichever way their browser
 * offers, and hands the real prompt to Chrome when it is available.
 */
export default function Install() {
  const { t, lang, me, setMe, setPreSignInLang } = useApp();
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    const mq = window.matchMedia("(display-mode: standalone)");
    setStandalone(mq.matches);
    const onMode = () => setStandalone(mq.matches);
    mq.addEventListener("change", onMode);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener("change", onMode);
    };
  }, []);

  // The app shows a signed-in person's own language, so for them the switch changes that setting,
  // the same one the Me screen's switch saves. Signed out, it only changes the pre-sign-in choice (#54).
  async function chooseLanguage(l: Lang) {
    setPreSignInLang(l);
    if (!me) return;
    setMe({ ...me, interfaceLanguage: l });
    try {
      setMe(await api.putMe({ interfaceLanguage: l }));
    } catch {}
  }

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }, [prompt]);

  const steps = ios
    ? [{ title: t.install.iosTitle, body: t.install.iosSteps }]
    : [
        { title: t.install.androidTitle, body: t.install.androidSteps },
        { title: t.install.desktopTitle, body: t.install.desktopSteps },
      ];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-5 py-10">
      <div className="flex justify-end">
        <LangToggle value={lang} onChange={chooseLanguage} />
      </div>

      <div className="flex flex-col items-center text-center">
        <div className="p-2">
          <Image src={lang === "th" ? "/logo-woven-th.png" : "/logo-woven.png"} alt={lang === "th" ? "ไปด้วยกัน · Bpai Dûay Gan" : "Bpai Dûay Gan · ไปด้วยกัน"} width={808} height={821} priority className="h-auto w-52" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {standalone ? t.install.inAppTitle : t.install.title}
        </h1>
        <p className="mt-2 text-muted">{standalone ? t.install.installedBody : t.install.lead}</p>
      </div>

      {!standalone && (
        <section className="flex flex-col gap-3">
          <Button onClick={install} disabled={!prompt} className="min-h-12">
            {installed ? t.install.installedTitle : t.install.cta}
          </Button>
          {!prompt && <p className="text-center text-sm text-muted">{t.install.promptPending}</p>}
        </section>
      )}

      {installed && <p className="text-center font-medium text-ok">{t.install.installedTitle}</p>}

      <section className="rounded-2xl border border-dashed border-line p-4">
        <h2 className="mb-3 font-semibold">{t.install.stepsTitle}</h2>
        <ul className="flex flex-col gap-3">
          {steps.map((s) => (
            <li key={s.title}>
              <p className="font-medium">{s.title}</p>
              <p className="text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col items-center gap-3">
        <p className="text-center text-sm text-muted">{t.install.signInHint}</p>
        <Link href="/sign-in" className="w-full">
          <Button className="min-h-12 w-full">{t.install.openApp}</Button>
        </Link>
      </section>
    </main>
  );
}
