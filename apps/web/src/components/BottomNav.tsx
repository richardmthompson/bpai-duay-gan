"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";
import { cx } from "./ui";

const ICONS: Record<string, string> = {
  browse: "M16 11a4 4 0 1 0-8 0M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 18a7 7 0 0 1 14 0",
  events: "M7 3v3m10-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  requests: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z",
  chats: "M4 5h16v11H9l-5 4V5Z",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
};

export function BottomNav() {
  const { t, unread } = useApp();
  const path = usePathname();
  const items = [
    { href: "/browse", key: "browse", label: t.nav.browse },
    { href: "/events", key: "events", label: t.nav.events },
    { href: "/requests", key: "requests", label: t.nav.requests, badge: unread.requests },
    { href: "/chats", key: "chats", label: t.nav.chats, badge: unread.messages },
    { href: "/me", key: "me", label: t.nav.me },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(`${it.href}/`) || (it.href === "/browse" && path.startsWith("/people"));
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cx("relative flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-brand" : "text-muted")}
              >
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={ICONS[it.key]} />
                </svg>
                {it.label}
                {!!it.badge && (
                  <span className="absolute right-[calc(50%-20px)] top-1 min-w-5 rounded-full bg-brand px-1 text-center text-[11px] font-semibold leading-5 text-brand-ink">
                    {it.badge > 9 ? "9+" : it.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
