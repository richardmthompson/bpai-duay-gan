"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { LangToggle } from "@/components/LangToggle";
import { TagPicker } from "@/components/TagPicker";
import { Avatar, Button, CommunityBadge, PageHeader, TagChip, cx } from "@/components/ui";
import { api } from "@/lib/api";
import { mockControls } from "@/lib/api/mock";
import type { Lang, Register } from "@/lib/contract";

export default function MePage() {
  const { t, me, setMe, tagLabel } = useApp();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  if (!me) return null;

  async function update(patch: Parameters<typeof api.putMe>[0]) {
    if (!me) return;
    setMe({ ...me, ...patch });
    setMe(await api.putMe(patch));
  }

  async function signOut() {
    api.realtime.disconnect();
    if (api.mode === "mock") {
      mockControls.signOut();
      setMe(null);
      router.replace("/sign-in");
    } else {
      window.location.href = "/api/auth/signout";
    }
  }

  return (
    <>
      <PageHeader title={t.me.title} />
      <div className="flex flex-col gap-6 p-4">
        <div className="flex items-center gap-4">
          <Avatar name={me.displayName} community={me.community} url={me.avatarUrl} size={64} />
          <div>
            <p className="text-xl font-semibold">{me.displayName}</p>
            {me.community && <CommunityBadge community={me.community} />}
          </div>
        </div>

        {editing ? (
          <EditProfile onDone={() => setEditing(false)} />
        ) : (
          <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
            <TagRow title={t.profile.gives} ids={me.give} label={tagLabel} />
            <TagRow title={t.profile.learns} ids={me.learn} label={tagLabel} />
            {me.interestsText && <p className="whitespace-pre-line text-sm text-muted">{me.interestsText}</p>}
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {t.me.editProfile}
            </Button>
          </section>
        )}

        <section className="flex flex-col gap-4">
          <Row label={t.me.language}>
            <LangToggle value={me.interfaceLanguage} onChange={(l: Lang) => update({ interfaceLanguage: l })} />
          </Row>
          <Row label={t.me.speaks}>
            <LangToggle value={me.speaksLanguage} onChange={(l: Lang) => update({ speaksLanguage: l })} />
          </Row>
          {me.speaksLanguage === "en" && (
            <Row label={t.me.register}>
              <div className="inline-flex rounded-full border border-line bg-surface p-1 text-sm">
                {(
                  [
                    ["male", "ครับ"],
                    ["female", "ค่ะ"],
                    ["neutral", "–"],
                  ] as [Register, string][]
                ).map(([r, label]) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={me.politenessRegister === r}
                    onClick={() => update({ politenessRegister: r })}
                    className={cx("min-h-9 rounded-full px-4", me.politenessRegister === r ? "bg-ink text-bg" : "text-muted")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Row>
          )}
        </section>

        <Button variant="secondary" onClick={signOut}>
          {t.me.signOut}
        </Button>

        {api.mode === "mock" && (
          <section className="flex flex-col gap-2 rounded-2xl border border-dashed border-line p-4">
            <p className="text-sm text-muted">{t.signIn.demoHint}</p>
            <Button variant="secondary" onClick={signOut}>
              {t.me.demoSwitch}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                mockControls.reset();
                mockControls.signOut();
                window.location.href = "/sign-in";
              }}
            >
              {t.me.resetMock}
            </Button>
          </section>
        )}
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="font-medium">{label}</span>
      {children}
    </div>
  );
}

function TagRow({ title, ids, label }: { title: string; ids: string[]; label: (id: string) => string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {ids.length ? ids.map((id) => <TagChip key={id} label={label(id)} />) : <span className="text-sm text-muted">–</span>}
      </div>
    </div>
  );
}

function EditProfile({ onDone }: { onDone: () => void }) {
  const { t, me, setMe } = useApp();
  const [name, setName] = useState(me!.displayName);
  const [give, setGive] = useState(me!.give);
  const [learn, setLearn] = useState(me!.learn);
  const [interests, setInterests] = useState(me!.interestsText);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.putMe({ displayName: name.trim(), interestsText: interests.trim() });
      setMe(await api.putMyTags({ give, learn }));
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <input
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        className="min-h-11 rounded-xl border border-line bg-bg px-3 text-base outline-none focus:border-brand"
      />
      <div>
        <p className="mb-2 font-medium">{t.onboarding.giveTitle}</p>
        <TagPicker value={give} onChange={setGive} />
      </div>
      <div>
        <p className="mb-2 font-medium">{t.onboarding.learnTitle}</p>
        <TagPicker value={learn} onChange={setLearn} />
      </div>
      <textarea
        rows={4}
        maxLength={600}
        value={interests}
        onChange={(e) => setInterests(e.target.value)}
        placeholder={t.onboarding.interestsPlaceholder}
        className="rounded-xl border border-line bg-bg p-3 text-base outline-none focus:border-brand"
      />
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onDone}>
          {t.common.cancel}
        </Button>
        <Button className="flex-1" onClick={save} disabled={busy || !name.trim() || give.length + learn.length === 0}>
          {t.common.save}
        </Button>
      </div>
    </section>
  );
}
