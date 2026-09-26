"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { GoingButton } from "@/components/GoingButton";
import { Avatar, ErrorState, Loading, PageHeader, eventTitle, formatWhen } from "@/components/ui";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useApp();
  const ev = useLoad(() => api.getEvent(id), [id]);

  if (ev.error) return <ErrorState onRetry={ev.reload} />;
  if (!ev.data) return <Loading />;
  const e = ev.data;
  const description = lang === "th" ? e.descriptionTh : e.descriptionEn;

  return (
    <>
      <PageHeader title="" back="/events" />
      <div className="px-4 pt-3">
        <div className="overflow-hidden rounded-2xl border-2 border-line bg-event text-event-ink shadow-hard">
          {e.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.imageUrl} alt="" className="h-48 w-full border-b-2 border-line object-cover" />
          )}
          <div className="flex flex-col gap-4 p-4">
            <div>
              <p className="text-sm font-bold text-accent">
                {formatWhen(e.startsAt, lang)}
                {e.endsAt && ` – ${formatWhen(e.endsAt, lang, { weekday: undefined, day: undefined, month: undefined })}`}
              </p>
              <h1 className="mt-1 text-2xl font-semibold leading-snug">{eventTitle(e, lang)}</h1>
              <p className="mt-1 text-event-ink/80">
                {e.venueName}
                {e.address && ` · ${e.address}`}
              </p>
              {e.priceText && <p className="mt-1 text-sm">{e.priceText === "Free" && lang === "th" ? t.events.free : e.priceText}</p>}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-event-ink/80">{t.events.goingCount(e.goingCount)}</span>
              <GoingButton
                eventId={e.id}
                going={e.going}
                onChange={(going) => {
                  ev.setData((cur) => (cur ? { ...cur, going, goingCount: cur.goingCount + (going ? 1 : -1) } : cur));
                }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-5 px-4 pb-6 pt-5">
        {description && <p className="whitespace-pre-line">{description}</p>}
        {e.sourceUrl && (
          <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="text-sm text-accent underline">
            {t.events.details} ↗
          </a>
        )}

        <section>
          <h2 className="mb-2 font-semibold">{t.events.whoIsGoing}</h2>
          {e.attendees.length === 0 ? (
            <p className="text-sm text-muted">{t.events.nobodyGoing}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {e.attendees.map((p) => (
                <li key={p.userId}>
                  <Link href={`/people/${p.userId}`} className="flex items-center gap-3 rounded-xl border-2 border-line bg-surface p-3 shadow-hard-sm">
                    <Avatar name={p.displayName} community={p.community} url={p.avatarUrl} size={40} />
                    <span className="flex-1 font-medium">{p.displayName}</span>
                    <span className="text-sm text-accent">{t.browse.viewProfile} →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
