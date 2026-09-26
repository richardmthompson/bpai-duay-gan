"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { SafetyActions } from "@/components/SafetyActions";
import { RequestForm } from "@/components/RequestForm";
import { Avatar, Button, CommunityBadge, ErrorState, Loading, PageHeader, Sheet, TagChip, eventTitle, formatWhen } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";

export default function Person() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, tagLabel } = useApp();
  const router = useRouter();
  const p = useLoad(() => api.getUser(id), [id]);
  const [asking, setAsking] = useState(false);

  if (p.error) {
    const gone = p.error instanceof ApiError && p.error.status === 404;
    return (
      <>
        <PageHeader title="" back="/browse" />
        <ErrorState text={gone ? t.profile.notFound : undefined} onRetry={gone ? undefined : p.reload} />
      </>
    );
  }
  if (!p.data) return <Loading />;
  const u = p.data;
  const matched = new Set(u.matchedTags.map((m) => m.tagId));
  const rel = u.relationship;

  return (
    <>
      <PageHeader title="" back="/browse" />
      <div className="flex flex-col gap-6 px-4 pb-4">
        <div className="flex items-center gap-4">
          <Avatar name={u.displayName} community={u.community} url={u.avatarUrl} size={72} />
          <div>
            <h1 className="text-2xl font-semibold">{u.displayName}</h1>
            <CommunityBadge community={u.community} />
          </div>
        </div>

        {u.matchedTags.length + u.sharedEvents.length > 0 && (
          <section className="rounded-2xl border-2 border-line bg-brand-soft p-4 shadow-hard-sm">
            <h2 className="mb-2 font-semibold text-accent">{t.profile.whyMatch}</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {u.sharedEvents.map((e) => (
                <li key={e.id}>
                  {t.browse.bothGoing}: <span className="font-medium">{eventTitle(e, lang)}</span>
                </li>
              ))}
              {u.matchedTags.map((m) => (
                <li key={`${m.side}-${m.tagId}`}>
                  {m.side === "theyGive" ? t.browse.canTeachYou : t.browse.wantsToLearn}:{" "}
                  <span className="font-medium">{tagLabel(m.tagId)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <TagSection title={t.profile.gives} ids={u.give} matched={matched} label={tagLabel} />
        <TagSection title={t.profile.learns} ids={u.learn} matched={matched} label={tagLabel} />

        {u.interestsText && (
          <section>
            <h2 className="mb-1 font-semibold">{t.profile.about}</h2>
            <p className="whitespace-pre-line text-muted">{u.interestsText}</p>
          </section>
        )}

        {u.goingEvents.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">{t.profile.going}</h2>
            <ul className="flex flex-col gap-2">
              {u.goingEvents.map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className="block rounded-xl border-2 border-line bg-surface p-3 shadow-hard-sm">
                    <p className="font-medium">{eventTitle(e, lang)}</p>
                    <p className="text-sm text-muted">{formatWhen(e.startsAt, lang)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] -mx-4 bg-bg/90 px-4 py-3 backdrop-blur">
          {rel.kind === "none" && (
            <Button className="w-full" onClick={() => setAsking(true)}>
              {t.profile.requestMatch}
            </Button>
          )}
          {rel.kind === "requestSent" && (
            <Button className="w-full" variant="secondary" disabled>
              {t.profile.requestSent}
            </Button>
          )}
          {rel.kind === "requestReceived" && (
            <Button className="w-full" onClick={() => router.push("/requests")}>
              {t.profile.respond}
            </Button>
          )}
          {rel.kind === "matched" && (
            <Button className="w-full" onClick={() => router.push(`/chats/${rel.matchId}`)}>
              {t.profile.openChat}
            </Button>
          )}
        </div>

        <SafetyActions userId={u.userId} name={u.displayName} onBlocked={() => router.replace("/browse")} />
      </div>

      <RequestSheet
        open={asking}
        onClose={() => setAsking(false)}
        name={u.displayName}
        userId={u.userId}
        events={[...u.sharedEvents, ...u.goingEvents.filter((e) => !u.sharedEvents.some((s) => s.id === e.id))]}
        onSent={() => {
          setAsking(false);
          void p.reload();
        }}
      />
    </>
  );
}

function TagSection({ title, ids, matched, label }: { title: string; ids: string[]; matched: Set<string>; label: (id: string) => string }) {
  if (ids.length === 0) return null;
  return (
    <section>
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <TagChip key={id} label={label(id)} tone={matched.has(id) ? "match" : "plain"} />
        ))}
      </div>
    </section>
  );
}

function RequestSheet({
  open,
  onClose,
  name,
  userId,
  events,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  userId: string;
  events: { id: string; titleEn: string; titleTh: string; startsAt: string }[];
  onSent: () => void;
}) {
  const { t } = useApp();
  return (
    <Sheet open={open} onClose={onClose} title={t.profile.requestTitle(name)}>
      <RequestForm userId={userId} events={events} onSent={onSent} onCancel={onClose} />
    </Sheet>
  );
}
