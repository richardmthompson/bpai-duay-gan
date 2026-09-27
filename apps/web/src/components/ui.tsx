"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import type { Community, EventSummary, Lang } from "@/lib/contract";
import { useApp } from "./AppProvider";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

// ---- formatting ----

export function eventTitle(e: Pick<EventSummary, "titleEn" | "titleTh">, lang: Lang) {
  return lang === "th" ? e.titleTh : e.titleEn;
}

export function formatWhen(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  }).format(new Date(iso));
}

export function formatTime(iso: string, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Photos uploaded through the api are stored as a path, "/v1/media/avatars/…". In production the
 * web app and api share an origin, so the path works as is; this also covers an api on another
 * origin in development. Google, seed and mock (data:) urls pass through untouched.
 */
export function mediaUrl(url: string) {
  return url.startsWith("/v1/") ? `${process.env.NEXT_PUBLIC_API_BASE ?? ""}${url}` : url;
}

// ---- pieces ----

export function Avatar({
  name,
  community,
  url,
  size = 48,
}: {
  name: string;
  community: Community | null;
  url?: string | null;
  size?: number;
}) {
  const initials = name.trim().slice(0, 1).toUpperCase() || "?";
  const tone = community === "local" ? "bg-local-soft text-local" : "bg-foreigner-soft text-foreigner";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl(url)} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  }
  return (
    <div
      aria-hidden
      className={cx("rounded-full grid place-items-center font-semibold shrink-0", tone)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials}
    </div>
  );
}

export function CommunityBadge({ community }: { community: Community }) {
  const { t } = useApp();
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border-2 border-line px-2 py-0.5 text-xs font-semibold",
        community === "local" ? "bg-local text-local-ink" : "bg-foreigner text-foreigner-ink",
      )}
    >
      {community === "local" ? t.common.local : t.common.foreigner}
    </span>
  );
}

export function TagChip({
  label,
  tone = "plain",
  selected,
  onClick,
}: {
  label: string;
  tone?: "plain" | "match" | "brand";
  selected?: boolean;
  onClick?: () => void;
}) {
  // Selectable chips (the tag picker) are pills: a light outline when off, filled with a hard shadow when on.
  // The 20px radius is fully round at the 40px minimum height and stays soft if a long label wraps.
  if (onClick)
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={cx(
          "inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-[20px] px-3.5 py-1.5 text-left text-sm transition-colors active:scale-95",
          selected
            ? "border-2 border-line bg-brand font-medium text-brand-ink shadow-hard-sm"
            : "border-[1.5px] border-muted/50 bg-surface text-ink",
        )}
      >
        {selected && <span aria-hidden>✓</span>}
        <span>{label}</span>
      </button>
    );
  const cls = cx(
    "inline-flex items-center gap-1 rounded-[10px] border-2 px-3 py-1 text-sm transition-colors",
    tone === "match" && "border-line bg-match text-match-ink font-medium",
    tone === "brand" && "border-line bg-brand text-brand-ink",
    tone === "plain" && "border-line bg-surface text-ink",
  );
  return <span className={cls}>{label}</span>;
}

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
        variant === "primary" && "border-2 border-line bg-brand font-semibold text-brand-ink shadow-hard-sm",
        variant === "secondary" && "border-2 border-line bg-surface text-ink shadow-hard-sm",
        variant === "ghost" && "text-muted",
        variant === "danger" && "border-2 border-line bg-surface text-danger shadow-hard-sm",
        className,
      )}
    />
  );
}

/** The app's mark with the app's hard shadow, so it stands off the sand background. Decorative. */
export function Emblem({ size }: { size: number }) {
  return (
    <Image
      src="/emblem-mark.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className="shrink-0 drop-shadow-[2px_2px_0_var(--line)]"
    />
  );
}

export function PageHeader({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  const { t } = useApp();
  return (
    <header className="sticky top-0 z-10 bg-bg/90 px-4 pb-3 pt-4 backdrop-blur">
      {back && (
        <Link href={back} className="mb-1 inline-block text-sm text-muted">
          ← {t.common.back}
        </Link>
      )}
      <div className="flex items-center gap-3">
        {!back && <Emblem size={40} />}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}

export function Loading() {
  const { t } = useApp();
  return <p className="p-8 text-center text-muted">{t.common.loading}</p>;
}

export function ErrorState({ onRetry, text }: { onRetry?: () => void; text?: string }) {
  const { t } = useApp();
  return (
    <div className="p-8 text-center">
      <p className="text-muted">{text ?? t.common.somethingWrong}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          {t.common.retry}
        </Button>
      )}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="p-8 text-center text-muted">{text}</p>;
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="w-full max-w-md rounded-t-2xl border-2 border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:shadow-hard"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
