"use client";

import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { PersonCard } from "@/components/PersonCard";
import { Button, Empty, ErrorState, Loading, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import type { Candidate } from "@/lib/contract";
import { useLoad } from "@/lib/useLoad";

export default function Browse() {
  const { t, me } = useApp();
  const first = useLoad(() => api.browse(null));
  const [more, setMore] = useState<Candidate[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  const items = [...(first.data?.items ?? []), ...more];
  const nextCursor = cursor === undefined ? first.data?.nextCursor : cursor;

  async function loadMore() {
    if (!nextCursor) return;
    setBusy(true);
    try {
      const p = await api.browse(nextCursor);
      setMore((m) => [...m, ...p.items]);
      setCursor(p.nextCursor);
    } finally {
      setBusy(false);
    }
  }

  const firstZero = items.findIndex((c) => c.score === 0);

  return (
    <>
      <PageHeader
        title={t.browse.title}
        subtitle={me?.community === "local" ? t.browse.subtitleLocal : t.browse.subtitleForeigner}
      />
      {first.loading && <Loading />}
      {first.error ? <ErrorState onRetry={first.reload} /> : null}
      {first.data && items.length === 0 && <Empty text={t.browse.empty} />}
      <ul className="flex flex-col gap-3 p-4">
        {items.map((c, i) => (
          <li key={c.userId}>
            {i === firstZero && i > 0 && (
              <p className="mb-3 mt-2 text-center text-sm font-medium text-muted">— {t.browse.noOverlapDivider} —</p>
            )}
            <PersonCard c={c} />
          </li>
        ))}
      </ul>
      {nextCursor && (
        <div className="px-4 pb-4">
          <Button variant="secondary" className="w-full" onClick={loadMore} disabled={busy}>
            {busy ? t.common.loading : t.common.next}
          </Button>
        </div>
      )}
    </>
  );
}
