"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Avatar, Button, Empty, ErrorState, Loading, PageHeader, cx, eventTitle } from "@/components/ui";
import { api } from "@/lib/api";
import type { MatchRequest } from "@/lib/contract";
import { useLoad } from "@/lib/useLoad";

export default function Requests() {
  const { t, refreshUnread } = useApp();
  const list = useLoad(() => api.listRequests());
  const reloadList = list.reload;
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");

  // New requests and acceptances arrive over the socket.
  useEffect(
    () =>
      api.realtime.subscribe((f) => {
        if (f.type === "notification" && f.payload.kind !== "message") void reloadList();
      }),
    [reloadList],
  );

  // Seeing the inbox clears the request badges.
  useEffect(() => {
    (async () => {
      const n = await api.getNotifications();
      const ids = n.items.filter((x) => !x.readAt && x.kind !== "message").map((x) => x.id);
      if (ids.length) {
        await api.markNotificationsRead(ids);
        await refreshUnread();
      }
    })().catch(() => {});
  }, [list.data, refreshUnread]);

  const items = (list.data ?? []).filter((r) => r.direction === tab);

  return (
    <>
      <PageHeader title={t.requests.title} />
      <div role="tablist" className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-xl border-2 border-line bg-surface-2 p-1">
        {(["incoming", "outgoing"] as const).map((k) => {
          const pending = (list.data ?? []).filter((r) => r.direction === k && r.status === "pending").length;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cx("min-h-10 rounded-lg border-2 text-sm font-medium", tab === k ? "border-line bg-surface shadow-hard-sm" : "border-transparent text-muted")}
            >
              {k === "incoming" ? t.requests.incoming : t.requests.outgoing}
              {pending > 0 && <span className="ml-1 text-accent">({pending})</span>}
            </button>
          );
        })}
      </div>

      {list.loading && <Loading />}
      {list.error ? <ErrorState onRetry={list.reload} /> : null}
      {list.data && items.length === 0 && (
        <Empty text={tab === "incoming" ? t.requests.emptyIncoming : t.requests.emptyOutgoing} />
      )}

      <ul className="flex flex-col gap-3 p-4">
        {items.map((r) => (
          <li key={r.id}>
            <RequestRow r={r} onChanged={list.reload} />
          </li>
        ))}
      </ul>
    </>
  );
}

function RequestRow({ r, onChanged }: { r: MatchRequest; onChanged: () => void }) {
  const { t, lang } = useApp();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(kind: "accept" | "decline") {
    setBusy(true);
    try {
      const res = kind === "accept" ? await api.acceptRequest(r.id) : await api.declineRequest(r.id);
      if (kind === "accept" && res.matchId) router.push(`/chats/${res.matchId}`);
      else onChanged();
    } finally {
      setBusy(false);
    }
  }

  const statusLabel =
    r.status === "accepted" ? t.requests.accepted : r.status === "declined" ? t.requests.declined : t.requests.pending;

  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-4 shadow-hard">
      <Link href={`/people/${r.other.userId}`} className="flex items-center gap-3">
        <Avatar name={r.other.displayName} community={r.other.community} url={r.other.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{r.other.displayName}</p>
          {r.direction === "outgoing" && <p className="text-sm text-muted">{statusLabel}</p>}
        </div>
      </Link>
      {r.event && (
        <p className="mt-3 rounded-xl border-2 border-line bg-event px-3 py-2 text-sm text-event-ink">
          <span aria-hidden>📅 </span>
          {t.requests.becauseEvent}: <span className="font-medium">{eventTitle(r.event, lang)}</span>
        </p>
      )}
      {r.note && <p className="mt-2 text-sm italic text-muted">“{r.note}”</p>}

      {r.direction === "incoming" && r.status === "pending" && (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => act("decline")} disabled={busy}>
            {t.requests.decline}
          </Button>
          <Button className="flex-[2]" onClick={() => act("accept")} disabled={busy}>
            {t.requests.accept}
          </Button>
        </div>
      )}
      {r.status === "accepted" && r.matchId && (
        <Button variant="secondary" className="mt-3 w-full" onClick={() => router.push(`/chats/${r.matchId}`)}>
          {t.requests.openChat}
        </Button>
      )}
    </div>
  );
}
