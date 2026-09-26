"use client";

import { useCallback, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { SwipeDeck } from "@/components/SwipeDeck";
import { Empty, ErrorState, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import type { Candidate } from "@/lib/contract";
import { useLoad } from "@/lib/useLoad";

export default function Browse() {
  const { t, me } = useApp();
  const first = useLoad(() => api.browse(null));
  const [more, setMore] = useState<Candidate[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const busy = useRef(false);

  const items = [...(first.data?.items ?? []), ...more];
  const nextCursor = cursor === undefined ? first.data?.nextCursor : cursor;

  const loadMore = useCallback(async () => {
    if (!nextCursor || busy.current) return;
    busy.current = true;
    try {
      const p = await api.browse(nextCursor);
      setMore((m) => [...m, ...p.items]);
      setCursor(p.nextCursor);
    } finally {
      busy.current = false;
    }
  }, [nextCursor]);

  return (
    <>
      <PageHeader
        title={t.browse.title}
        subtitle={me?.community === "local" ? t.browse.subtitleLocal : t.browse.subtitleForeigner}
      />
      {first.loading && <Loading />}
      {first.error ? <ErrorState onRetry={first.reload} /> : null}
      {first.data && items.length === 0 && <Empty text={t.browse.empty} />}
      {items.length > 0 && <SwipeDeck items={items} onNeedMore={loadMore} />}
    </>
  );
}
