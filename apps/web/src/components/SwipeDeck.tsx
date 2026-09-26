"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Candidate, PublicProfile } from "@/lib/contract";
import { api } from "@/lib/api";
import { RequestForm } from "./RequestForm";
import { useApp } from "./AppProvider";
import { cx, CommunityBadge, eventTitle, formatWhen, Sheet, TagChip } from "./ui";

const SWIPE_PX = 80;
const MAX_TILT = 12;

/**
 * One card at a time, best match first, and the card carries the whole profile -- nothing to tap
 * open. Swipe right (or the floating handshake) asks to match, swipe left (or ✕) skips.
 *
 * The drag paints straight onto the node and the commit reads the ref, never React state: a fast
 * flick delivers pointermove and pointerup in the same burst, so a state read at pointerup is
 * still the pre-drag value and every swipe would register as a tap instead.
 */
export function SwipeDeck({ items, onNeedMore }: { items: Candidate[]; onNeedMore: () => void }) {
  const { t, lang, tagLabel } = useApp();
  const [index, setIndex] = useState(0);
  const [askFor, setAskFor] = useState<Candidate | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const card = useRef<HTMLElement | null>(null);
  const meet = useRef<HTMLDivElement | null>(null);
  const skip = useRef<HTMLDivElement | null>(null);
  const scrim = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ x: 0, y: 0, dx: 0, dy: 0, down: false, locked: false });
  const asked = useRef(new Set<string>());

  const current = items[index];

  useEffect(() => {
    if (index >= items.length - 2) onNeedMore();
  }, [index, items.length, onNeedMore]);

  // The card shows the whole profile, so fetch the parts Browse does not carry (their events).
  useEffect(() => {
    for (const c of [items[index], items[index + 1]]) {
      if (!c || asked.current.has(c.userId)) continue;
      asked.current.add(c.userId);
      api
        .getUser(c.userId)
        .then((u) => setProfiles((p) => ({ ...p, [c.userId]: u })))
        .catch(() => {});
    }
  }, [index, items]);

  const veil = (value: number) => {
    if (scrim.current) scrim.current.style.opacity = String(value);
  };

  const paint = (dx: number, dy: number) => {
    const el = card.current;
    if (!el) return;
    el.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-MAX_TILT, Math.min(MAX_TILT, dx / 14))}deg)`;
    const strength = Math.min(1, Math.abs(dx) / SWIPE_PX);
    if (meet.current) meet.current.style.opacity = dx > 0 ? String(strength) : "0";
    if (skip.current) skip.current.style.opacity = dx < 0 ? String(strength) : "0";
    // the next profile stays veiled for as long as this one is on its way out
    veil(strength);
  };

  const springBack = () => {
    const el = card.current;
    if (el) {
      el.style.transition = "transform 200ms ease";
      el.style.transform = "translate(0px, 0px) rotate(0deg)";
    }
    if (meet.current) meet.current.style.opacity = "0";
    if (skip.current) skip.current.style.opacity = "0";
    veil(0);
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
      if (dir === "right") setAskFor(person);
      veil(1);
      window.setTimeout(() => {
        drag.current = { x: 0, y: 0, dx: 0, dy: 0, down: false, locked: false };
        setIndex((n) => n + 1);
        veil(0); // the new card is on top now, so nothing to hide any more
      }, 170);
    },
    [items, index],
  );

  // A gesture only counts as a swipe when it went sideways -- vertically the profile scrolls.
  const release = (canceled: boolean) => {
    const d = drag.current;
    if (!d.down) return;
    d.down = false;
    const horizontal = Math.abs(d.dx) > Math.abs(d.dy);
    if (horizontal && Math.abs(d.dx) > SWIPE_PX) commit(d.dx > 0 ? "right" : "left");
    else if (!canceled && !horizontal && Math.abs(d.dx) < 8 && Math.abs(d.dy) < 8) {
      // a still tap does nothing; the profile is already on the card
      springBack();
    } else springBack();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (askFor) return;
      if (e.key === "ArrowLeft") commit("left");
      else if (e.key === "ArrowRight" || e.key === "Enter") commit("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit, askFor]);

  if (!current) {
    return <p className="p-8 text-center text-muted">{t.browse.noMore}</p>;
  }

  const firstZero = items.findIndex((c) => c.score === 0);

  return (
    <div className="px-4 pb-4">
      {firstZero >= 0 && index >= firstZero && (
        <p className="mb-2 text-center text-xs font-medium text-muted">— {t.browse.noOverlapDivider} —</p>
      )}

      <div className="relative h-[68vh] max-h-[620px] select-none">
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
                      (e.currentTarget as HTMLElement).style.transition = "none";
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
                      // while the finger is going up or down the profile is scrolling, not swiping
                      if (Math.abs(d.dx) >= Math.abs(d.dy)) paint(d.dx, d.dy);
                    }
                  : undefined
              }
              onPointerUp={top ? () => release(false) : undefined}
              onPointerCancel={top ? () => release(true) : undefined}
              style={top ? undefined : { transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.04})`, transition: "transform 180ms ease" }}
              className={cx(
                "absolute inset-0 flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm",
                top ? "z-10" : "z-0",
              )}
            >
              <CardBody c={c} full={profiles[c.userId]} lang={lang} tagLabel={tagLabel} t={t} sent={sentTo.includes(c.userId)} />
              {top && (
                <>
                  <div
                    ref={meet}
                    style={{ opacity: 0 }}
                    className="pointer-events-none absolute left-5 top-5 rounded-xl border-2 border-ok bg-surface/90 px-3 py-1 text-lg font-bold uppercase text-ok"
                  >
                    🤝 {t.browse.meet}
                  </div>
                  <div
                    ref={skip}
                    style={{ opacity: 0 }}
                    className="pointer-events-none absolute right-5 top-5 rounded-xl border-2 border-danger bg-surface/90 px-3 py-1 text-lg font-bold uppercase text-danger"
                  >
                    ✕ {t.browse.skip}
                  </div>
                </>
              )}
            </article>
          );
        })}

        {/* Veils the next profile for as long as the current card is on its way out. */}
        <div
          ref={scrim}
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-[5] rounded-3xl bg-bg/80 backdrop-blur-sm"
        />

        {/* Floating over the card, and above the bottom nav (fixed, z-20), so neither hides them. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+1.25rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-center gap-8">
          <button
            type="button"
            aria-label={t.browse.skip}
            onClick={() => commit("left")}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-surface/95 text-2xl text-muted shadow-lg ring-1 ring-line backdrop-blur active:scale-95"
          >
            ✕
          </button>
          <button
            type="button"
            aria-label={t.browse.meet}
            onClick={() => commit("right")}
            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full bg-brand text-3xl text-brand-ink shadow-xl active:scale-95"
          >
            🤝
          </button>
        </div>
      </div>

      <Sheet
        open={askFor !== null}
        onClose={() => setAskFor(null)}
        title={askFor ? t.profile.requestTitle(askFor.displayName) : ""}
      >
        {askFor && (
          <RequestForm
            userId={askFor.userId}
            events={[
              ...askFor.sharedEvents,
              ...(profiles[askFor.userId]?.goingEvents ?? []).filter((e) => !askFor.sharedEvents.some((s) => s.id === e.id)),
            ]}
            onCancel={() => setAskFor(null)}
            onSent={() => {
              setSentTo((s) => [...s, askFor.userId]);
              setAskFor(null);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function CardBody({
  c,
  full,
  lang,
  tagLabel,
  t,
  sent,
}: {
  c: Candidate;
  full?: PublicProfile;
  lang: "th" | "en";
  tagLabel: (id: string) => string;
  t: ReturnType<typeof useApp>["t"];
  sent: boolean;
}) {
  const matched = new Set(c.matchedTags.map((m) => m.tagId));
  const initials = c.displayName.trim().slice(0, 1).toUpperCase() || "?";

  return (
    <>
      <div className="relative h-[40%] w-full shrink-0 bg-surface-2" style={{ touchAction: "none" }}>
        {c.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="grid h-full place-items-center text-6xl font-semibold text-muted">{initials}</div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <CommunityBadge community={c.community} />
          {sent && <span className="rounded-full bg-surface/90 px-2 py-0.5 text-xs text-muted">{t.profile.requestSent}</span>}
        </div>
        {c.score === 0 && (
          <div className="absolute right-3 top-3 rounded-full bg-surface/90 px-2 py-0.5 text-xs text-muted">
            {t.browse.noShared}
          </div>
        )}
      </div>

      {/* The name sits above the scroller, not inside it: `truncate` implies overflow-hidden, which
          cancels the automatic min-height, and a flex column that overflows then shrinks it to 0. */}
      <div className="shrink-0 px-4 pt-3">
        <h2 className="truncate text-2xl font-semibold">{c.displayName}</h2>
      </div>

      {/* the rest of the card scrolls, so the floating buttons never hide anything for good */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-24 pt-2" style={{ touchAction: "pan-y" }}>
        {c.matchedTags.length + c.sharedEvents.length > 0 && (
          <section className="rounded-2xl bg-brand-soft p-3">
            <h3 className="mb-1 text-sm font-semibold text-brand">{t.profile.whyMatch}</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {c.matchedTags.map((m) => (
                <li key={`${m.side}-${m.tagId}`}>
                  {m.side === "theyGive" ? t.browse.canTeachYou : t.browse.wantsToLearn}:{" "}
                  <span className="font-medium">{tagLabel(m.tagId)}</span>
                </li>
              ))}
              {c.sharedEvents.map((e) => (
                <li key={e.id}>
                  {t.browse.bothGoing}: <span className="font-medium">{eventTitle(e, lang)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <TagSection title={t.profile.gives} ids={c.give} matched={matched} label={tagLabel} />
        <TagSection title={t.profile.learns} ids={c.learn} matched={matched} label={tagLabel} />

        {c.interestsText && (
          <section>
            <h3 className="mb-1 font-semibold">{t.profile.about}</h3>
            <p className="whitespace-pre-line text-sm text-muted">{c.interestsText}</p>
          </section>
        )}

        {full && full.goingEvents.length > 0 && (
          <section>
            <h3 className="mb-1 font-semibold">{t.profile.going}</h3>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {full.goingEvents.map((e) => (
                <li key={e.id}>
                  {eventTitle(e, lang)} · {formatWhen(e.startsAt, lang)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}

function TagSection({ title, ids, matched, label }: { title: string; ids: string[]; matched: Set<string>; label: (id: string) => string }) {
  if (ids.length === 0) return null;
  return (
    <section>
      <h3 className="mb-1.5 font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <TagChip key={id} label={label(id)} tone={matched.has(id) ? "match" : "plain"} />
        ))}
      </div>
    </section>
  );
}
