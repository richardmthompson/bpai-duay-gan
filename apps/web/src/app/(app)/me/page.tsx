"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { GenderPicker } from "@/components/GenderPicker";
import { LangToggle } from "@/components/LangToggle";
import { TagPicker } from "@/components/TagPicker";
import { Avatar, Button, CommunityBadge, PageHeader, TagChip } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { mockControls } from "@/lib/api/mock";
import { PhotoDecodeError, resizePhoto } from "@/lib/photo";
import { clearSession } from "@/lib/session";
import type { Gender, Lang } from "@/lib/contract";

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
    if (api.mode === "mock") mockControls.signOut();
    else clearSession();
    setMe(null);
    router.replace("/sign-in");
  }

  return (
    <>
      <PageHeader title={t.me.title} />
      <div className="flex flex-col gap-6 p-4">
        <ProfileHeader />

        {editing ? (
          <EditProfile onDone={() => setEditing(false)} />
        ) : (
          <section className="flex flex-col gap-4 rounded-2xl border-2 border-line bg-surface p-4 shadow-hard">
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
        </section>

        <Button variant="secondary" onClick={signOut}>
          {t.me.signOut}
        </Button>

        {api.mode === "mock" && (
          <section className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-line p-4">
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

type PhotoPhase = "idle" | "preparing" | "uploading" | "removing";

/** Name, community and the photo, which is tappable to add or change it. */
function ProfileHeader() {
  const { t, me, setMe } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<PhotoPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!me) return null;
  const busy = phase !== "idle";
  const hasPhoto = Boolean(me.avatarUrl);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires a change
    if (!file) return;
    setError(null);
    setPhase("preparing");
    let image: Blob;
    try {
      image = await resizePhoto(file);
    } catch (err) {
      setError(err instanceof PhotoDecodeError ? t.me.photoNotImage : t.me.photoUploadFailed);
      setPhase("idle");
      return;
    }
    const local = URL.createObjectURL(image);
    setPreview(local);
    setProgress(0);
    setPhase("uploading");
    try {
      setMe(await api.uploadAvatar(image, setProgress));
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setError(status === 415 ? t.me.photoNotImage : status === 413 ? t.me.photoTooLarge : t.me.photoUploadFailed);
    } finally {
      setPreview(null);
      URL.revokeObjectURL(local);
      setPhase("idle");
    }
  }

  async function remove() {
    setError(null);
    setPhase("removing");
    try {
      setMe(await api.removeAvatar());
    } catch {
      setError(t.me.photoRemoveFailed);
    } finally {
      setPhase("idle");
    }
  }

  const percent = Math.round(progress * 100);
  const status =
    phase === "preparing" ? t.me.photoPreparing
    : phase === "uploading" ? t.me.photoUploading(percent)
    : phase === "removing" ? t.me.photoRemoving
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={hasPhoto ? t.me.changePhoto : t.me.addPhoto}
          className="relative shrink-0 rounded-full border-2 border-line bg-surface shadow-hard-sm transition active:scale-95 disabled:active:scale-100"
        >
          <Avatar name={me.displayName} community={me.community} url={preview ?? me.avatarUrl} size={76} />
          {busy && <span aria-hidden className="absolute inset-0 rounded-full bg-ink/40" />}
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-line bg-brand text-brand-ink"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
          </span>
        </button>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <p className="max-w-full truncate text-xl font-semibold">{me.displayName}</p>
          {me.community && <CommunityBadge community={me.community} />}
        </div>
      </div>

      {/* Any image type, so phones offer the camera and the photo library; the resize decides what is readable. */}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="min-h-10 px-3 text-sm" onClick={() => input.current?.click()} disabled={busy}>
          {hasPhoto ? t.me.changePhoto : t.me.addPhoto}
        </Button>
        {hasPhoto && (
          <Button variant="danger" className="min-h-10 px-3 text-sm" onClick={remove} disabled={busy}>
            {t.me.removePhoto}
          </Button>
        )}
      </div>

      {status && (
        <div role="status" className="flex flex-col gap-1.5">
          <p className="text-sm font-medium">{status}</p>
          {phase === "uploading" && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-3 overflow-hidden rounded-full border-2 border-line bg-surface"
            >
              <div className="h-full bg-brand transition-[width]" style={{ width: `${percent}%` }} />
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl border-2 border-line bg-surface px-3 py-2 text-sm font-medium text-danger shadow-hard-sm">
          {error}
        </p>
      )}
    </div>
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
  const [gender, setGender] = useState<Gender | null>(me!.gender);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      // Gender also sets the Thai politeness register the translation uses (the api keeps them in step).
      await api.putMe({ displayName: name.trim(), interestsText: interests.trim(), ...(gender ? { gender } : {}) });
      setMe(await api.putMyTags({ give, learn }));
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-line bg-surface p-4 shadow-hard">
      <input
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        className="min-h-11 rounded-xl border-2 border-line bg-bg px-3 text-base outline-none focus:border-brand"
      />
      <div>
        <p className="mb-2 font-medium">{t.me.gender}</p>
        <GenderPicker value={gender} onChange={setGender} />
      </div>
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
        className="rounded-xl border-2 border-line bg-bg p-3 text-base outline-none focus:border-brand"
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
