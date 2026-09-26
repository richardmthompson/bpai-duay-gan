"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Lang, Me, ServerFrame, Tag } from "@/lib/contract";
import { en, type Strings } from "@/i18n/en";
import { th } from "@/i18n/th";

const PRE_LANG_KEY = "bpai.lang";

interface Toast {
  id: string;
  text: string;
  href?: string;
}

interface AppState {
  me: Me | null;
  /** false until the first /me call has answered. */
  ready: boolean;
  lang: Lang;
  t: Strings;
  setPreSignInLang(lang: Lang): void;
  refreshMe(): Promise<Me | null>;
  setMe(me: Me | null): void;
  tags: Tag[];
  tagLabel(id: string): string;
  unread: { requests: number; messages: number };
  refreshUnread(): Promise<void>;
  toasts: Toast[];
  dismissToast(id: string): void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

function initialLang(): Lang {
  if (typeof window === "undefined") return "th";
  try {
    const saved = localStorage.getItem(PRE_LANG_KEY);
    if (saved === "th" || saved === "en") return saved;
  } catch {}
  return navigator.language.toLowerCase().startsWith("th") ? "th" : "en";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [preLang, setPreLang] = useState<Lang>("th");
  const [tags, setTags] = useState<Tag[]>([]);
  const [unread, setUnread] = useState({ requests: 0, messages: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const lang: Lang = me?.interfaceLanguage ?? preLang;
  const t = lang === "th" ? th : en;

  // Read after hydration: the server has no localStorage or navigator.language.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreLang(initialLang());
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const refreshMe = useCallback(async () => {
    try {
      const m = await api.getMe();
      setMe(m);
      return m;
    } finally {
      setReady(true);
    }
  }, []);

  const refreshUnread = useCallback(async () => {
    try {
      const n = await api.getNotifications();
      const open = n.items.filter((x) => !x.readAt);
      setUnread({
        requests: open.filter((x) => x.kind !== "message").length,
        messages: open.filter((x) => x.kind === "message").length,
      });
    } catch {}
  }, []);

  useEffect(() => {
    void refreshMe();
    api.getTags().then(setTags).catch(() => {});
  }, [refreshMe]);

  // One socket for the whole signed-in session.
  const userId = me?.userId;
  useEffect(() => {
    if (!userId) return;
    api.realtime.connect();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUnread();
    const off = api.realtime.subscribe((f: ServerFrame) => {
      if (f.type !== "notification") return;
      void refreshUnread();
      if (f.payload.kind === "message" && location.pathname === `/chats/${f.payload.data.matchId}`) return;
      const name = f.payload.data.fromName ?? f.payload.title;
      const tt = (me?.interfaceLanguage ?? "en") === "th" ? th : en;
      const text =
        f.payload.kind === "match_request"
          ? tt.notifications.matchRequest(name)
          : f.payload.kind === "match_accepted"
            ? tt.notifications.matchAccepted(name)
            : tt.notifications.message(name);
      const href =
        f.payload.kind === "match_request"
          ? "/requests"
          : f.payload.data.matchId
            ? `/chats/${f.payload.data.matchId}`
            : undefined;
      const id = f.payload.notificationId;
      setToasts((ts) => [...ts.slice(-2), { id, text, href }]);
      setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 5000);
    });
    return () => {
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const tagLabel = useCallback(
    (id: string) => {
      const tag = tags.find((x) => x.id === id);
      if (!tag) return id;
      return lang === "th" ? tag.labelTh : tag.labelEn;
    },
    [tags, lang],
  );

  const value = useMemo<AppState>(
    () => ({
      me,
      ready,
      lang,
      t,
      setPreSignInLang(l) {
        setPreLang(l);
        try {
          localStorage.setItem(PRE_LANG_KEY, l);
        } catch {}
      },
      refreshMe,
      setMe,
      tags,
      tagLabel,
      unread,
      refreshUnread,
      toasts,
      dismissToast: (id) => setToasts((ts) => ts.filter((x) => x.id !== id)),
    }),
    [me, ready, lang, t, refreshMe, tags, tagLabel, unread, refreshUnread, toasts],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
