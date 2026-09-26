"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { SafetyActions } from "@/components/SafetyActions";
import { Avatar, ErrorState, Loading, cx, formatTime } from "@/components/ui";
import { api, type SocketStatus } from "@/lib/api";
import type { Lang, Message } from "@/lib/contract";
import { useLoad } from "@/lib/useLoad";

type Bubble = Message & { sending?: boolean; sendFailed?: boolean };

export default function Chat() {
  const { id: matchId } = useParams<{ id: string }>();
  const { t, lang, me, refreshUnread } = useApp();
  const router = useRouter();

  const match = useLoad(async () => {
    const all = await api.listMatches();
    return all.find((m) => m.id === matchId) ?? null;
  }, [matchId]);
  // Messages live in local state because socket frames patch them in place.
  const [msgs, setMsgs] = useState<Bubble[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const loadHistory = useCallback(() => {
    api
      .getMessages(matchId)
      .then((p) => {
        setHistoryError(false);
        setMsgs(p.items);
      })
      .catch(() => setHistoryError(true));
  }, [matchId]);
  useEffect(loadHistory, [loadHistory]);

  // Opening a conversation is reading it. Without this the Chats badge counts messages you have
  // already seen, and nothing ever clears it.
  useEffect(() => {
    (async () => {
      const n = await api.getNotifications();
      const ids = n.items
        .filter((x) => !x.readAt && x.kind === "message" && x.data.matchId === matchId)
        .map((x) => x.id);
      if (ids.length) {
        await api.markNotificationsRead(ids);
        await refreshUnread();
      }
    })().catch(() => {});
  }, [matchId, refreshUnread]);

  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<SocketStatus>("idle");
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const myLang: Lang = me?.speaksLanguage ?? lang;

  useEffect(() => api.realtime.onStatus(setStatus), []);

  useEffect(
    () =>
      api.realtime.subscribe((f) => {
        if (f.type === "chat.message" && f.payload.matchId === matchId) {
          const { messageId, ...rest } = f.payload;
          const incoming: Bubble = { ...rest, id: messageId };
          setMsgs((prev) => {
            const cur = prev ?? [];
            // Reconcile the optimistic bubble by clientMsgId, or ignore an echo we already have.
            const i = cur.findIndex((m) => m.id === messageId || (incoming.clientMsgId && m.clientMsgId === incoming.clientMsgId));
            if (i === -1) return [...cur, incoming];
            const next = [...cur];
            // A translation that already landed wins over a pending echo.
            next[i] = next[i].translationStatus === "done" && !next[i].sending ? next[i] : incoming;
            return next;
          });
          if (f.payload.senderId !== me?.userId) setTyping(false);
        }
        if (f.type === "chat.translated" && f.payload.matchId === matchId) {
          const p = f.payload;
          setMsgs((cur) =>
            cur?.map((m) =>
              m.id === p.messageId
                ? { ...m, bodyTranslated: p.bodyTranslated, langTranslated: p.langTranslated, culturalNote: p.culturalNote, translationStatus: "done" }
                : m,
            ) ?? null,
          );
        }
        if (f.type === "chat.typing" && f.payload.matchId === matchId && f.payload.userId !== me?.userId) {
          setTyping(true);
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setTyping(false), 3000);
        }
      }),
    [matchId, me?.userId],
  );

  // Scroll to newest and mark read.
  const lastId = msgs?.at(-1)?.id;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
    const last = msgs?.at(-1);
    if (last && !last.sending) {
      api.realtime.sendRead(matchId, last.id);
      void refreshUnread();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastId, typing]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || !me) return;
    setDraft("");
    const clientMsgId = crypto.randomUUID();
    const optimistic: Bubble = {
      id: `local-${clientMsgId}`,
      matchId,
      senderId: me.userId,
      clientMsgId,
      bodyOriginal: body,
      langOriginal: myLang,
      bodyTranslated: null,
      langTranslated: null,
      culturalNote: null,
      translationStatus: "pending",
      createdAt: new Date().toISOString(),
      sending: true,
    };
    setMsgs((cur) => [...(cur ?? []), optimistic]);
    const input = { matchId, body, lang: myLang, clientMsgId };
    if (api.realtime.sendChat(input)) return;
    // Socket down: the HTTP route produces the same row and fan-out.
    try {
      const saved = await api.postMessage(matchId, { body, lang: myLang, clientMsgId });
      setMsgs((cur) => cur?.map((m) => (m.clientMsgId === clientMsgId && m.sending ? saved : m)) ?? null);
    } catch {
      setMsgs((cur) => cur?.map((m) => (m.clientMsgId === clientMsgId ? { ...m, sending: false, sendFailed: true } : m)) ?? null);
    }
  }

  function onDraft(v: string) {
    setDraft(v);
    const now = Date.now();
    if (now - lastTypingSent.current > 2500) {
      lastTypingSent.current = now;
      api.realtime.sendTyping(matchId);
    }
  }

  if (match.error || historyError) return <ErrorState onRetry={() => (match.reload(), loadHistory())} />;
  if (match.data === null && !match.loading)
    return (
      <div className="p-8 text-center">
        <p className="text-muted">{t.chat.unavailable}</p>
        <Link href="/chats" className="mt-3 inline-block text-accent">
          ← {t.chats.title}
        </Link>
      </div>
    );
  if (!match.data || !msgs) return <Loading />;

  const other = match.data.other;

  return (
    // Full-height column above the bottom nav: header, scrolling messages, composer.
    <div className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-bg/90 px-3 py-2 backdrop-blur">
        <Link href="/chats" aria-label={t.common.back} className="grid h-10 w-8 place-items-center text-xl text-muted">
          ←
        </Link>
        <Link href={`/people/${other.userId}`} className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar name={other.displayName} community={other.community} url={other.avatarUrl} size={36} />
          <div className="min-w-0">
            <p className="truncate font-semibold leading-tight">{other.displayName}</p>
            <p className="text-xs text-muted">{typing ? t.chat.typing : status !== "ready" ? t.chat.offline : " "}</p>
          </div>
        </Link>
        <SafetyActions compact userId={other.userId} name={other.displayName} matchId={matchId} onBlocked={() => router.replace("/chats")} />
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {msgs.length === 0 && <p className="mt-8 text-center text-sm text-muted">{t.chat.hint}</p>}
        <ul className="flex flex-col gap-2">
          {msgs.map((m) => (
            <MessageBubble key={m.clientMsgId ?? m.id} m={m} mine={m.senderId === me?.userId} readerLang={myLang} />
          ))}
        </ul>
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="flex items-end gap-2 border-t border-line bg-surface p-2">
        <textarea
          rows={1}
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={t.chat.placeholder}
          aria-label={t.chat.placeholder}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border-2 border-line bg-surface px-4 py-2.5 text-base outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="min-h-11 rounded-2xl border-2 border-line bg-accent px-4 font-semibold text-accent-ink shadow-hard-sm disabled:opacity-40"
        >
          {t.chat.send}
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ m, mine, readerLang }: { m: Bubble; mine: boolean; readerLang: Lang }) {
  const { t, lang } = useApp();
  const [flipped, setFlipped] = useState(false);

  const needsTranslation = !mine && m.langOriginal !== readerLang;
  const translated = m.translationStatus === "done" && m.bodyTranslated;

  // What the reader sees by default: their language. Tap flips to the other side.
  let main = m.bodyOriginal;
  let sub: string | null = null;
  if (needsTranslation) {
    if (translated) {
      main = flipped ? m.bodyOriginal : m.bodyTranslated!;
      sub = flipped ? t.chat.original : null;
    } else {
      sub = m.translationStatus === "failed" ? t.chat.translationFailed : t.chat.translating;
    }
  } else if (mine && translated && flipped) {
    main = m.bodyTranslated!;
  }
  const canFlip = !!translated;

  return (
    <li className={cx("flex flex-col", mine ? "items-end" : "items-start")}>
      <button
        type="button"
        disabled={!canFlip}
        onClick={() => setFlipped((f) => !f)}
        aria-label={canFlip ? (flipped ? t.chat.showTranslation : t.chat.showOriginal) : undefined}
        className={cx(
          "max-w-[80%] rounded-2xl px-4 py-2 text-left text-base whitespace-pre-wrap",
          mine ? "rounded-br-md border-2 border-line bg-brand text-brand-ink" : "rounded-bl-md border-2 border-line bg-surface",
          needsTranslation && !translated && "opacity-70",
          m.sendFailed && "border-2 border-danger",
        )}
      >
        {main}
      </button>
      <div className={cx("mt-0.5 flex gap-2 px-1 text-[11px] text-muted", mine && "flex-row-reverse")}>
        <span>{m.sending ? "…" : formatTime(m.createdAt, lang)}</span>
        {sub && <span className={cx(!translated && m.translationStatus === "pending" && "animate-pulse")}>{sub}</span>}
        {canFlip && !sub && <span>{flipped === mine ? t.chat.showOriginal : t.chat.showTranslation}</span>}
      </div>
      {!mine && translated && m.culturalNote && (
        <p className="mt-1 max-w-[80%] rounded-xl bg-surface-2 px-3 py-1.5 text-xs text-muted">
          <span aria-hidden>💡 </span>
          {m.culturalNote}
        </p>
      )}
    </li>
  );
}
