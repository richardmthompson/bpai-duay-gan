"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candidate } from "@/lib/contract";
import { ProfileSheet } from "./ProfileSheet";
import { useApp } from "./AppProvider";
import { cx, CommunityBadge, eventTitle, TagChip } from "./ui";

const SWIPE_PX = 80;
const MAX_TILT = 12;

/**
 * One card at a time, best match first. Right (or a tap) opens the profile over the deck,
 * left skips to the next person.
 *
 * The drag is painted straight onto the node and the commit reads the ref, never React state:
 * a fast flick delivers pointermove and pointerup in the same burst, so a state read at
 * pointerup is still the pre-drag value and every swipe would look like a tap.
 */
export function SwipeDeck({ items, onNeedMore }: { items: Candidate[]; onNeedMore: () => void }) {
  const { t, lang, tagLabel } = useApp();
  const [index, setIndex] = useState(0);
  const [sheetFor, setSheetFor] = useState<Candidate | null>(null);
  const card = useRef<HTMLElement | null>(null);
  const meet = useRef<HTMLDivElement | null>(null);
  const skip = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ x: 0, y: 0, dx: 0, dy: 0, down: false, locked: false });

  const current = items[index];

  useEffect(() => {
    if (index >= items.length - 2) onNeedMore();
  }, [index, items.length, onNeedMore]);

  const paint = (dx: number, dy: number) => {
    const el = card.current;
    if (!el) return;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-MAX_TILT, Math.min(MAX_TILT, dx / 14))}deg)`;
    const strength = String(Math.min(1, Math.abs(dx) / SWIPE_PX));
    if (meet.current) meet.current.style.opacity = dx > 0 ? strength : "0";
    if (skip.current) skip.current.style.opacity = dx < 0 ? strength : "0";
  };

  const springBack = () => {
    const el = card.current;
    if (el) {
      el.style.transition = "transform 200ms ease";
      el.style.transform = "translate(0px, 0px) rotate(0deg)";
    }
    if (meet.current) meet.current.style.opacity = "0";
    if (skip.current) skip.current.style.opacity = "0";
    drag.current.dx = 0;
    drag.current.dy = 0;
  };

  const commit = useCallback(
    (dir: "left" | "right") => {
      const person = items[index];
      if (!person || drag.current.locked) return;
      drag.current.locked = true;
      const el = card.current;
      const dy = drag.current.dy;
      if (el) {
        el.style.transition = "transform 170ms ease-out";
        el.style.transform = `translate(${dir === "right" ? 560 : -560}px, ${dy}px) rotate(${dir === "right" ? 18 : -18}deg)`;
      }
      if (dir === "right") setSheetFor(person);
      window.setTimeout(() => {
        drag.current = { x: 0, y: 0, dx: 0, dy: 0, down: false, locked: false };
        setIndex((n) => n + 1); // the next card is already under the sheet when it closes
      }, 170);
    },
    [items, index],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheetFor) return;
      if (e.key === "ArrowLeft") commit("left");
      else if (e.key === "ArrowRight" || e.key === "Enter") commit("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, sheetFor]);

  if (!current) {
    return <p className="p-8 text-center text-muted">{t.browse.noMore}</p>;
  }

  const firstZero = items.findIndex((c) => c.score === 0);

  return (
    <div className="px-4 pb-4">
      <p className="mb-2 text-center text-xs text-muted">
        {index + 1} / {items.length} · {t.browse.swipeHint}
      </p>
      {firstZero >= 0 && index >= firstZero && (
        <p className="mb-2 text-center text-xs font-medium text-muted">— {t.browse.noOverlapDivider} —</p>
      )}

      <div className="relative h-[62vh] max-h-[560px] select-none">
        {[2, 1, 0].map((depth) => {
          const c = items[index + depth];
          if (!c) return null;
          const top = depth === 0;
          return (
            <article
              key={c.userId}
              ref={top ? card : undefined}
              aria-hidden={!top}
              onPointerDown={
                top
                  ? (e) => {
                      try {
                        (e.currentTarget as Element).setPointerCapture(e.pointerId);
                      } catch {
                        // best-effort: the drag works without capture too
                      }
                      const el = e.currentTarget as HTMLElement;
                      el.style.transition = "none";
                      drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, down: true, locked: false };
                    }
                  : undefined
              }
              onPointerMove={
                top
                  ? (e) => {
                      const d = drag.current;
                      if (!d.down) return;
                      d.dx = e.clientX - d.x;
                      d.dy = e.clientY - d.y;
                      paint(d.dx, d.dy);
                    }
                  : undefined
              }
              onPointerUp={
                top
                  ? () => {
                      const d = drag.current;
                      if (!d.down) return;
                      d.down = false;
                      if (Math.abs(d.dx) > SWIPE_PX) commit(d.dx > 0 ? "right" : "left");
                      else if (Math.abs(d.dx) < 8) commit("right"); // a tap opens the profile
                      else springBack();
                    }
                  : undefined
              }
              onPointerCancel={
                top
                  ? () => {
                      // some browsers claim the gesture mid-drag; a committed swipe still counts
                      const d = drag.current;
                      if (!d.down) return;
                      d.down = false;
                      if (Math.abs(d.dx) > SWIPE_PX) commit(d.dx > 0 ? "right" : "left");
                      else springBack();
                    }
                  : undefined
              }
              style={
                top
                  ? { touchAction: "none" }
                  : { transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`, transition: "transform 180ms ease" }
              }
              className={cx(
                "absolute inset-0 flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm",
                top ? "z-10 cursor-grab active:cursor-grabbing" : "z-0",
              )}
            >
              <CardBody c={c} lang={lang} tagLabel={tagLabel} t={t} />
              {top && (
                <>
                  <div
                    ref={meet}
                    style={{ opacity: 0 }}
                    className="pointer-events-none absolute left-5 top-5 rounded-xl border-2 border-ok px-3 py-1 text-lg font-bold uppercase text-ok"
                  >
                    🤝 {t.browse.meet}
                  </div>
                  <div
                    ref={skip}
                    style={{ opacity: 0 }}
                    className="pointer-events-none absolute right-5 top-5 rounded-xl border-2 border-danger px-3 py-1 text-lg font-bold uppercase text-danger"
                  >
                    ✕ {t.browse.skip}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          aria-label={t.browse.skip}
          onClick={() => commit("left")}
          className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-2xl text-muted active:scale-95"
        >
          ✕
        </button>
        <button
          type="button"
          aria-label={t.browse.meet}
          onClick={() => commit("right")}
          className="grid h-16 w-16 place-items-center rounded-full bg-brand text-3xl text-brand-ink active:scale-95"
        >
          🤝
        </button>
      </div>

      <ProfileSheet
        candidate={sheetFor}
        onClose={() => setSheetFor(null)}
      />
    </div>
  );
}

function CardBody({
  c,
  lang,
  tagLabel,
  t,
}: {
  c: Candidate;
  lang: "th" | "en";
  tagLabel: (id: string) => string;
  t: ReturnType<typeof useApp>["t"];
}) {
  const theyGive = c.matchedTags.filter((m) => m.side === "theyGive");
  const youGive = c.matchedTags.filter((m) => m.side === "youGive");
  const reasons = theyGive.length + youGive.length + c.sharedEvents.length;
  const initials = c.displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <>
      <div className="relative h-[54%] w-full shrink-0 bg-surface-2">
        {c.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="grid h-full place-items-center text-6xl font-semibold text-muted">{initials}</div>
        )}
        <div className="absolute left-3 top-3">
          <CommunityBadge community={c.community} />
        </div>
        {c.score === 0 && (
          <div className="absolute right-3 top-3 rounded-full bg-surface/90 px-2 py-0.5 text-xs text-muted">
            {t.browse.noShared}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden px-4 pb-3 pt-2.5">
        <h2 className="truncate text-xl font-semibold">{c.displayName}</h2>

        {reasons > 0 ? (
          <>
            {theyGive.length > 0 && (
              <ReasonRow label={t.browse.canTeachYou} ids={theyGive.map((m) => m.tagId)} tagLabel={tagLabel} />
            )}
            {youGive.length > 0 && (
              <ReasonRow label={t.browse.wantsToLearn} ids={youGive.map((m) => m.tagId)} tagLabel={tagLabel} />
            )}
            {c.sharedEvents.slice(0, 1).map((e) => (
              <p key={e.id} className="truncate rounded-xl bg-surface-2 px-3 py-1">
                <span aria-hidden>📅 </span>
                {t.browse.bothGoing}: <span className="font-medium">{eventTitle(e, lang)}</span>
              </p>
            ))}
          </>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {c.give.slice(0, 4).map((id) => (
              <TagChip key={id} label={tagLabel(id)} />
            ))}
          </div>
        )}

        {reasons === 0 && c.interestsText && <p className="line-clamp-3 text-sm text-muted">{c.interestsText}</p>}
      </div>
    </>
  );
}

/** The card is a fixed height, so a long tag list is capped rather than allowed to overflow. */
function ReasonRow({ label, ids, tagLabel }: { label: string; ids: string[]; tagLabel: (id: string) => string }) {
  const shown = ids.slice(0, 2);
  const extra = ids.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</span>
      {shown.map((id) => (
        <TagChip key={id} tone="match" label={tagLabel(id)} />
      ))}
      {extra > 0 && <span className="text-xs text-muted">+{extra}</span>}
    </div>
  );
}
