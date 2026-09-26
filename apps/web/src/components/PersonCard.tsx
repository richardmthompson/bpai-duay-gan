"use client";

import Link from "next/link";
import type { Candidate } from "@/lib/contract";
import { useApp } from "./AppProvider";
import { Avatar, CommunityBadge, TagChip, eventTitle } from "./ui";

export function PersonCard({ c }: { c: Candidate }) {
  const { t, lang, tagLabel } = useApp();
  const theyGive = c.matchedTags.filter((m) => m.side === "theyGive");
  const youGive = c.matchedTags.filter((m) => m.side === "youGive");
  const hasReason = theyGive.length + youGive.length + c.sharedEvents.length > 0;

  return (
    <Link href={`/people/${c.userId}`} className="block rounded-2xl border border-line bg-surface p-4 active:bg-surface-2">
      <div className="flex items-center gap-3">
        <Avatar name={c.displayName} community={c.community} url={c.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{c.displayName}</p>
          <CommunityBadge community={c.community} />
        </div>
      </div>

      {hasReason ? (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          {c.sharedEvents.map((e) => (
            <p key={e.id} className="rounded-xl bg-surface-2 px-3 py-2">
              <span aria-hidden>📅 </span>
              {t.browse.bothGoing}: <span className="font-medium">{eventTitle(e, lang)}</span>
            </p>
          ))}
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
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
