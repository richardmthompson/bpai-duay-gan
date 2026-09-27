"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Candidate, PublicProfile } from "@/lib/contract";
import { api } from "@/lib/api";
import { Bio } from "./Bio";
import { RequestForm } from "./RequestForm";
import { useApp } from "./AppProvider";
import { cx, CommunityBadge, eventTitle, formatWhen, mediaUrl, Sheet, TagChip } from "./ui";

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
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [askFor, setAskFor] = useState<Candidate | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const card = useRef<HTMLElement | null>(null);
  const meet = useRef<HTMLDivElement | null>(null);
  const skip = useRef<HTMLDivElement | null>(null);
  const scrim = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ x: 0, y: 0, dx: 0, dy: 0, down: false, locked: false });
  // The link a gesture started on. The card captures the pointer, so the browser's click lands on
  // the card, not the link: a still tap on an event tag navigates from here instead.
  const pressedLink = useRef<string | null>(null);
  const asked = useRef(new Set<string>());
  // A right swipe opens the request sheet and leaves the deck parked on the swiped card, veiled:
  // the next profile may not show behind the sheet, so the deck only moves on when the sheet closes.
  const parked = useRef(false);

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
    // The next profile may never show while this one is displaced, so the veil is all or nothing;
    // only the stamps fade in with distance.
    veil(dx !== 0 ? 1 : 0);
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

  // Bring the next card to the top: nothing left to hide, and it starts undragged and unlocked.
  const advance = useCallback(() => {
    drag.current = { x: 0, y: 0, dx: 0, dy: 0, down: false, locked: false };
    setIndex((n) => n + 1);
    veil(0);
  }, []);

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
      veil(1);
      if (dir === "right") {
        // the veil stays up and the deck stays locked until the sheet closes (closeSheet)
        parked.current = true;
        setAskFor(person);
      } else window.setTimeout(advance, 170);
    },
    [items, index, advance],
  );

  // Sent or cancelled, the swiped profile is done with: move on by exactly one, and only now.
  const closeSheet = () => {
    setAskFor(null);
    if (!parked.current) return;
    parked.current = false;
    advance();
  };

  // A gesture only counts as a swipe when it went sideways -- vertically the profile scrolls.
  const release = (canceled: boolean) => {
    const d = drag.current;
    if (!d.down) return;
    d.down = false;
    const horizontal = Math.abs(d.dx) > Math.abs(d.dy);
    if (horizontal && Math.abs(d.dx) > SWIPE_PX) commit(d.dx > 0 ? "right" : "left");
    else if (!canceled && Math.abs(d.dx) < 8 && Math.abs(d.dy) < 8) {
      // a still tap does nothing, unless it landed on an event tag; the profile is already on the card
      springBack();
      if (pressedLink.current) router.push(pressedLink.current);
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
    // Fills the rest of Browse's column (see the browse page): the card runs down behind the floating
    // buttons and stops just above the bottom nav.
    <div className="flex min-h-0 flex-1 flex-col px-4 pt-3">
      {firstZero >= 0 && index >= firstZero && (
        <p className="mb-2 text-center text-xs font-medium text-muted">— {t.browse.noOverlapDivider} —</p>
      )}

      <div className="relative min-h-0 flex-1 select-none">
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
                      pressedLink.current = (e.target as Element).closest("a[data-tap-link]")?.getAttribute("href") ?? null;
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
              // Only the top card is outlined: the cards behind carry no border or shadow, so no edge of
              // another profile ever shows around it or through the veil.
              className={cx(
                "absolute inset-0 flex flex-col overflow-hidden rounded-3xl bg-surface",
                top ? "z-10 border-2 border-line shadow-hard" : "z-0",
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

        {/* Veils the next profile for as long as the current card is on its way out, and while the
            request sheet is open. Opaque at full strength: the outlined theme reads through any tint. */}
        <div
          ref={scrim}
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-0 z-[5] rounded-3xl bg-bg"
        />

        {/* Floating over the lower part of the card, and above the bottom nav (fixed, z-20), so neither
            hides them. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+1.25rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-center gap-8">
          <button
            type="button"
            aria-label={t.browse.skip}
            onClick={() => commit("left")}
            className="pointer-events-auto grid h-14 w-14 place-items-center rounded-full border-2 border-line bg-surface/95 text-2xl text-muted shadow-hard backdrop-blur active:scale-95"
          >
            ✕
          </button>
          <button
            type="button"
            aria-label={t.browse.meet}
            onClick={() => commit("right")}
            className="pointer-events-auto grid h-16 w-16 place-items-center rounded-full border-2 border-line bg-brand text-brand-ink shadow-hard active:scale-95"
          >
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 10v12" />
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
          </button>
        </div>
      </div>

      <Sheet
        open={askFor !== null}
        onClose={closeSheet}
        title={askFor ? t.profile.requestTitle(askFor.displayName) : ""}
      >
        {askFor && (
          <RequestForm
            userId={askFor.userId}
            events={[
              ...askFor.sharedEvents,
              ...(profiles[askFor.userId]?.goingEvents ?? []).filter((e) => !askFor.sharedEvents.some((s) => s.id === e.id)),
            ]}
            onCancel={closeSheet}
            onSent={() => {
              setSentTo((s) => [...s, askFor.userId]);
              closeSheet();
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
          <img src={mediaUrl(c.avatarUrl)} alt="" className="h-full w-full object-cover" draggable={false} />
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

      {/* The rest of the card scrolls, so the floating buttons never hide anything for good: the card
          runs down behind them, and the bottom padding lets the last line scroll clear above them. */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pb-28 pt-2" style={{ touchAction: "pan-y" }}>
        {c.sharedEvents.length > 0 && (
          <section>
            <MatchLabel>{t.browse.bothGoing}</MatchLabel>
            <ul className="flex flex-col gap-2">
              {c.sharedEvents.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/events/${e.id}`}
                    data-tap-link
                    draggable={false}
                    // Pointer taps navigate from the card's release handler (see pressedLink); a
                    // keyboard Enter (detail 0) still follows the link, and never reaches the deck's
                    // Enter-to-meet shortcut.
                    onClick={(ev) => ev.detail > 0 && ev.preventDefault()}
                    onKeyDown={(ev) => ev.stopPropagation()}
                    className="flex items-center gap-2.5 rounded-xl border-2 border-line bg-event px-3 py-2 text-event-ink"
                  >
                    <span aria-hidden>📅</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-snug">{eventTitle(e, lang)}</span>
                      <span className="block text-xs text-event-ink/80">{formatWhen(e.startsAt, lang)}</span>
                    </span>
                    <span aria-hidden className="text-lg leading-none">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <MatchChips label={t.browse.canTeachYou} ids={c.matchedTags.filter((m) => m.side === "theyGive").map((m) => m.tagId)} tagLabel={tagLabel} />
        <MatchChips label={t.browse.wantsToLearn} ids={c.matchedTags.filter((m) => m.side === "youGive").map((m) => m.tagId)} tagLabel={tagLabel} />

        <TagSection title={t.profile.gives} ids={c.give} matched={matched} label={tagLabel} />
        <TagSection title={t.profile.learns} ids={c.learn} matched={matched} label={tagLabel} />

        {c.interestsText && (
          <Bio heading={t.profile.about} original={c.interestsText} translated={c.interestsTextTranslated ?? null} />
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

function MatchLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</h3>;
}

function MatchChips({ label, ids, tagLabel }: { label: string; ids: string[]; tagLabel: (id: string) => string }) {
  if (ids.length === 0) return null;
  return (
    <section>
      <MatchLabel>{label}</MatchLabel>
      <div className="flex flex-wrap gap-1.5">
        {ids.map((id) => (
          <TagChip key={id} tone="match" label={tagLabel(id)} />
        ))}
      </div>
    </section>
  );
}
