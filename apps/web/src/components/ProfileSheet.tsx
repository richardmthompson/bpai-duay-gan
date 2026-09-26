"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Candidate, PublicProfile } from "@/lib/contract";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { RequestForm } from "./RequestForm";
import { Avatar, Button, CommunityBadge, eventTitle, formatWhen, Sheet, TagChip } from "./ui";

/**
 * The whole profile, on the page the card was swiped on — no separate profile screen.
 * Everything the card cannot fit (full tag lists, the events they are going to, the request flow)
 * appears here, over the deck.
 */
export function ProfileSheet({
  candidate,
  onClose,
}: {
  candidate: Candidate | null;
  onClose: () => void;
}) {
  const { t, lang, tagLabel } = useApp();
  const [full, setFull] = useState<PublicProfile | null>(null);
  const [asking, setAsking] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const userId = candidate?.userId;
  useEffect(() => {
    setFull(null);
    setAsking(false);
    setSent(false);
    setFailed(false);
    if (!userId) return;
    let alive = true;
    api
      .getUser(userId)
      .then((u) => alive && setFull(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [userId]);

  if (!candidate) return null;
  const matched = new Set(candidate.matchedTags.map((m) => m.tagId));
  const give = full?.give ?? candidate.give;
  const learn = full?.learn ?? candidate.learn;
  const rel = full?.relationship;
  const gives = candidate.matchedTags.filter((m) => m.side === "theyGive");
  const learns = candidate.matchedTags.filter((m) => m.side === "youGive");

  return (
    <Sheet open onClose={onClose} title={candidate.displayName}>
      <div className="-mx-4 max-h-[70vh] overflow-y-auto px-4">
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={candidate.displayName} community={candidate.community} url={candidate.avatarUrl} size={64} />
          <CommunityBadge community={candidate.community} />
        </div>

        {asking ? (
          <RequestForm
            userId={candidate.userId}
            events={[...candidate.sharedEvents, ...(full?.goingEvents ?? []).filter((e) => !candidate.sharedEvents.some((s) => s.id === e.id))]}
            onCancel={() => setAsking(false)}
            onSent={() => {
              setAsking(false);
              setSent(true);
            }}
          />
        ) : (
          <>
            {gives.length + learns.length + candidate.sharedEvents.length > 0 && (
              <section className="mb-4 rounded-2xl bg-brand-soft p-4">
                <h3 className="mb-2 font-semibold text-brand">{t.profile.whyMatch}</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {gives.map((m) => (
                    <li key={`give-${m.tagId}`}>
                      {t.browse.canTeachYou}: <span className="font-medium">{tagLabel(m.tagId)}</span>
                    </li>
                  ))}
                  {learns.map((m) => (
                    <li key={`learn-${m.tagId}`}>
                      {t.browse.wantsToLearn}: <span className="font-medium">{tagLabel(m.tagId)}</span>
                    </li>
                  ))}
                  {candidate.sharedEvents.map((e) => (
                    <li key={e.id}>
                      {t.browse.bothGoing}: <span className="font-medium">{eventTitle(e, lang)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <TagSection title={t.profile.gives} ids={give} matched={matched} label={tagLabel} />
            <TagSection title={t.profile.learns} ids={learn} matched={matched} label={tagLabel} />

            {candidate.interestsText && (
              <section className="mb-4">
                <h3 className="mb-1 font-semibold">{t.profile.about}</h3>
                <p className="whitespace-pre-line text-sm text-muted">{candidate.interestsText}</p>
              </section>
            )}

            {full && full.goingEvents.length > 0 && (
              <section className="mb-4">
                <h3 className="mb-2 font-semibold">{t.profile.going}</h3>
                <ul className="flex flex-col gap-2">
                  {full.goingEvents.map((e) => (
                    <li key={e.id} className="rounded-xl border border-line bg-surface-2 p-3">
                      <p className="font-medium">{eventTitle(e, lang)}</p>
                      <p className="text-sm text-muted">{formatWhen(e.startsAt, lang)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!full && !failed && <p className="mb-4 text-sm text-muted">{t.common.loading}</p>}

            <div className="sticky bottom-0 -mx-4 border-t border-line bg-surface px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {sent || rel?.kind === "requestSent" ? (
                <Button className="w-full" variant="secondary" disabled>
                  {t.profile.requestSent}
                </Button>
              ) : rel?.kind === "matched" ? (
                <Link href={`/chats/${rel.matchId}`} className="block">
                  <Button className="w-full">{t.profile.openChat}</Button>
                </Link>
              ) : (
                <Button className="w-full" onClick={() => setAsking(true)}>
                  {t.profile.requestMatch}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

function TagSection({ title, ids, matched, label }: { title: string; ids: string[]; matched: Set<string>; label: (id: string) => string }) {
  if (ids.length === 0) return null;
  return (
    <section className="mb-4">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <TagChip key={id} label={label(id)} tone={matched.has(id) ? "match" : "plain"} />
        ))}
      </div>
    </section>
  );
}
