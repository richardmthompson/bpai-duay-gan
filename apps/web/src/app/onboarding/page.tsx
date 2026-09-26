"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { LangToggle } from "@/components/LangToggle";
import { TagPicker } from "@/components/TagPicker";
import { Button, Loading, cx } from "@/components/ui";
import { api } from "@/lib/api";
import type { Community, Lang, Me, Register } from "@/lib/contract";

type Step = "language" | "community" | "name" | "register" | "give" | "learn" | "interests";

export default function Onboarding() {
  const { me, ready } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    if (!me) router.replace("/sign-in");
    else if (me.onboardingComplete) router.replace("/browse");
  }, [ready, me, router]);
  if (!me || me.onboardingComplete) return <Loading />;
  return <Wizard me={me} />;
}

function Wizard({ me }: { me: Me }) {
  const { t, lang, setPreSignInLang, setMe } = useApp();
  const router = useRouter();

  const [step, setStep] = useState<Step>("language");
  const [community, setCommunity] = useState<Community | null>(me.community);
  const [name, setName] = useState(me.displayName);
  const [register, setRegister] = useState<Register | null>(me.politenessRegister);
  const [give, setGive] = useState<string[]>(me.give);
  const [learn, setLearn] = useState<string[]>(me.learn);
  const [interests, setInterests] = useState(me.interestsText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Thai writers choose their own particles; only messages translated into Thai need the sender's register.
  const steps = useMemo<Step[]>(
    () => ["language", "community", "name", ...(lang === "en" ? (["register"] as const) : []), "give", "learn", "interests"],
    [lang],
  );
  const idx = steps.indexOf(step);
  const next = () => setStep(steps[Math.min(idx + 1, steps.length - 1)]);
  const back = () => setStep(steps[Math.max(idx - 1, 0)]);

  async function chooseLanguage(l: Lang) {
    setPreSignInLang(l);
    setMe({ ...me, interfaceLanguage: l, speaksLanguage: l });
  }

  async function finish() {
    setBusy(true);
    setError(false);
    try {
      await api.putMe({
        displayName: name.trim(),
        community,
        interfaceLanguage: lang,
        speaksLanguage: lang,
        politenessRegister: lang === "en" ? (register ?? "neutral") : null,
        interestsText: interests.trim(),
      });
      const m = await api.putMyTags({ give, learn });
      setMe(m);
      router.replace("/browse");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const canNext: Record<Step, boolean> = {
    language: true,
    community: !!community,
    name: name.trim().length > 0,
    register: !!register,
    give: true,
    learn: give.length + learn.length > 0,
    interests: true,
  };

  const o = t.onboarding;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
      <div className="mb-6 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-muted">
          <Image src="/emblem.png" alt="" width={32} height={32} />
          {o.stepOf(idx + 1, steps.length)}
        </span>
        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-brand transition-all" style={{ width: `${((idx + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1">
        {step === "language" && (
          <Section title={o.languageTitle}>
            <LangToggle value={lang} onChange={chooseLanguage} />
          </Section>
        )}

        {step === "community" && (
          <Section title={o.communityTitle}>
            <div className="flex flex-col gap-3">
              <Choice selected={community === "local"} onClick={() => setCommunity("local")} title={o.communityLocal} hint={o.communityLocalHint} />
              <Choice selected={community === "foreigner"} onClick={() => setCommunity("foreigner")} title={o.communityForeigner} hint={o.communityForeignerHint} />
            </div>
          </Section>
        )}

        {step === "name" && (
          <Section title={o.nameTitle}>
            <input
              autoFocus
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              placeholder={o.namePlaceholder}
              className="min-h-12 w-full rounded-xl border-2 border-line bg-surface px-4 text-base outline-none focus:border-brand"
            />
          </Section>
        )}

        {step === "register" && (
          <Section title={o.registerTitle} hint={o.registerHint}>
            <div className="flex flex-col gap-3">
              <Choice selected={register === "male"} onClick={() => setRegister("male")} title={o.registerMale} hint={o.registerMaleHint} />
              <Choice selected={register === "female"} onClick={() => setRegister("female")} title={o.registerFemale} hint={o.registerFemaleHint} />
              <Choice selected={register === "neutral"} onClick={() => setRegister("neutral")} title={o.registerNeutral} hint={o.registerNeutralHint} />
            </div>
          </Section>
        )}

        {step === "give" && (
          <Section title={o.giveTitle} hint={o.giveHint}>
            <TagPicker value={give} onChange={setGive} />
          </Section>
        )}

        {step === "learn" && (
          <Section title={o.learnTitle} hint={o.learnHint}>
            <TagPicker value={learn} onChange={setLearn} />
            {!canNext.learn && <p className="mt-4 text-sm text-muted">{o.pickAtLeastOne}</p>}
          </Section>
        )}

        {step === "interests" && (
          <Section title={o.interestsTitle} hint={o.interestsHint}>
            <textarea
              autoFocus
              rows={6}
              maxLength={600}
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
              placeholder={o.interestsPlaceholder}
              className="w-full rounded-xl border-2 border-line bg-surface p-4 text-base outline-none focus:border-brand"
            />
            {error && <p className="mt-2 text-sm text-danger">{t.common.somethingWrong}</p>}
          </Section>
        )}
      </div>

      <div className="mt-8 flex gap-3">
        {idx > 0 && (
          <Button variant="secondary" onClick={back} className="flex-1">
            {t.common.back}
          </Button>
        )}
        {step === "interests" ? (
          <Button onClick={finish} disabled={busy} className="flex-[2]">
            {o.finish}
          </Button>
        ) : (
          <Button onClick={next} disabled={!canNext[step]} className="flex-[2]">
            {t.common.next}
          </Button>
        )}
      </div>
    </main>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {hint && <p className="mt-2 text-muted">{hint}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Choice({ selected, onClick, title, hint }: { selected: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "rounded-2xl border-2 border-line p-4 text-left shadow-hard-sm transition-colors",
        selected ? "bg-brand-soft" : "bg-surface",
      )}
    >
      <span className="block font-semibold">{title}</span>
      <span className="block text-sm text-muted">{hint}</span>
    </button>
  );
}
