"use client";

import Link from "next/link";
import type { Candidate } from "@/lib/contract";
import { useApp } from "./AppProvider";
import { Avatar, CommunityBadge, TagChip, eventTitle, formatWhen } from "./ui";

export function PersonCard({ c }: { c: Candidate }) {
  const { t, lang, tagLabel } = useApp();
  const theyGive = c.matchedTags.filter((m) => m.side === "theyGive");
  const youGive = c.matchedTags.filter((m) => m.side === "youGive");
  const hasReason = theyGive.length + youGive.length + c.sharedEvents.length > 0;

  return (
    <Link href={`/people/${c.userId}`} className="block rounded-2xl border-2 border-line bg-surface p-4 shadow-hard active:bg-surface-2">
      <div className="flex items-center gap-3">
        <Avatar name={c.displayName} community={c.community} url={c.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{c.displayName}</p>
          <CommunityBadge community={c.community} />
        </div>
      </div>

      {hasReason ? (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {c.sharedEvents.length > 0 && (
            <Reason label={t.browse.bothGoing}>
              {/* the whole card is already a link to the profile, so these tags are not links */}
              {c.sharedEvents.map((e) => (
                <p key={e.id} className="flex w-full items-center gap-2.5 rounded-xl border-2 border-line bg-event px-3 py-2 text-event-ink">
                  <span aria-hidden>📅</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{eventTitle(e, lang)}</span>
                    <span className="block text-xs text-event-ink/80">{formatWhen(e.startsAt, lang)}</span>
                  </span>
                </p>
              ))}
            </Reason>
          )}
          {theyGive.length > 0 && (
            <Reason label={t.browse.canTeachYou}>
              {theyGive.map((m) => (
                <TagChip key={m.tagId} tone="match" label={tagLabel(m.tagId)} />
              ))}
            </Reason>
          )}
          {youGive.length > 0 && (
            <Reason label={t.browse.wantsToLearn}>
              {youGive.map((m) => (
                <TagChip key={m.tagId} tone="match" label={tagLabel(m.tagId)} />
              ))}
            </Reason>
          )}
        </div>
      ) : (
        c.give.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {c.give.slice(0, 4).map((id) => (
              <TagChip key={id} label={tagLabel(id)} />
            ))}
          </div>
        )
      )}

      {c.interestsText && <p className="mt-3 line-clamp-2 text-sm text-muted">{c.interestsText}</p>}
    </Link>
  );
}

function Reason({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
