"use client";

import Link from "next/link";
import { useApp } from "@/components/AppProvider";
import { GoingButton } from "@/components/GoingButton";
import { Empty, ErrorState, Loading, PageHeader, eventTitle, formatWhen } from "@/components/ui";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";

export default function Events() {
  const { t, lang } = useApp();
  const list = useLoad(() => api.listEvents());

  function setGoing(id: string, going: boolean) {
    list.setData((cur) =>
      cur?.map((e) => (e.id === id ? { ...e, going, goingCount: e.goingCount + (going ? 1 : -1) } : e)) ?? null,
    );
  }

  return (
    <>
      <PageHeader title={t.events.title} subtitle={t.events.subtitle} />
      {list.loading && <Loading />}
      {list.error ? <ErrorState onRetry={list.reload} /> : null}
      {list.data?.length === 0 && <Empty text={t.events.empty} />}
      <ul className="flex flex-col gap-3 p-4">
        {list.data?.map((e) => (
          <li key={e.id}>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              <Link href={`/events/${e.id}`} className="block active:bg-surface-2">
              {e.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.imageUrl} alt="" className="h-36 w-full object-cover" />
              )}
              <div className="p-4">
                <p className="text-sm font-medium text-brand">{formatWhen(e.startsAt, lang)}</p>
                <p className="mt-0.5 text-lg font-semibold leading-snug">{eventTitle(e, lang)}</p>
                <p className="text-sm text-muted">{e.venueName}</p>
              </div>
              </Link>
              <div className="flex items-center justify-between gap-2 px-4 pb-4">
                <span className="text-sm text-muted">{t.events.goingCount(e.goingCount)}</span>
                <GoingButton eventId={e.id} going={e.going} onChange={(g) => setGoing(e.id, g)} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
