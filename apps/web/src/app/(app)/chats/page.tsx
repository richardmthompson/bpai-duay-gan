"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useApp } from "@/components/AppProvider";
import { Avatar, Empty, ErrorState, Loading, PageHeader, formatTime } from "@/components/ui";
import { api } from "@/lib/api";
import type { Message } from "@/lib/contract";
import { useLoad } from "@/lib/useLoad";

export default function Chats() {
  const { t, lang, me } = useApp();
  const list = useLoad(() => api.listMatches());
  const reloadList = list.reload;

  useEffect(
    () =>
      api.realtime.subscribe((f) => {
        if (f.type === "chat.message" || f.type === "chat.translated" || f.type === "notification") void reloadList();
      }),
    [reloadList],
  );

  function preview(m: Message) {
    const mine = m.senderId === me?.userId;
    const text = !mine && m.bodyTranslated && m.langTranslated === lang ? m.bodyTranslated : m.bodyOriginal;
    return mine ? `${t.chats.you}: ${text}` : text;
  }

  return (
    <>
      <PageHeader title={t.chats.title} />
      {list.loading && <Loading />}
      {list.error ? <ErrorState onRetry={list.reload} /> : null}
      {list.data?.length === 0 && <Empty text={t.chats.empty} />}
      <ul className="flex flex-col gap-3 p-4">
        {list.data?.map((m) => (
          <li key={m.id}>
            <Link href={`/chats/${m.id}`} className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface p-3 shadow-hard-sm active:bg-surface-2">
              <Avatar name={m.other.displayName} community={m.other.community} url={m.other.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-semibold">{m.other.displayName}</p>
                  {m.lastMessage && <span className="shrink-0 text-xs text-muted">{formatTime(m.lastMessage.createdAt, lang)}</span>}
                </div>
                <p className="truncate text-sm text-muted">{m.lastMessage ? preview(m.lastMessage) : t.chats.noMessages}</p>
              </div>
              {m.unreadCount > 0 && (
                <span className="min-w-6 rounded-full border-2 border-line bg-brand px-1.5 text-center text-xs font-semibold leading-5 text-brand-ink">
                  {m.unreadCount}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
