"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";
import { Button, cx, eventTitle, formatWhen } from "./ui";
import { ApiError, api } from "@/lib/api";

/** Ask to match: pick the event that brings you together, add an optional note, send. */
export function RequestForm({
  userId,
  events,
  onSent,
  onCancel,
}: {
  userId: string;
  events: { id: string; titleEn: string; titleTh: string; startsAt: string }[];
  onSent: () => void;
  onCancel: () => void;
}) {
  const { t, lang } = useApp();
  const [eventId, setEventId] = useState<string | null>(events[0]?.id ?? null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      await api.sendRequest({ toUserId: userId, eventId, note: note.trim() || null });
      onSent();
    } catch (e) {
      // A conflict means this card is stale — a relationship already exists — so name it
      // rather than showing the generic failure. Anything else is a real error.
      const code = e instanceof ApiError ? e.code : "";
      setError(
        code === "already_matched" ? t.requests.accepted
          : code === "already_asked" ? t.profile.requestSent
            : t.common.somethingWrong,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {events.length > 0 && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-medium">{t.profile.reasonEvent}</legend>
          <div className="flex flex-col gap-2">
            {[...events, null].map((e) => (
              <button
                key={e?.id ?? "none"}
                type="button"
                role="radio"
                aria-checked={eventId === (e?.id ?? null)}
                onClick={() => setEventId(e?.id ?? null)}
                className={cx(
                  "rounded-xl border-2 border-line p-3 text-left text-sm shadow-hard-sm",
                  eventId === (e?.id ?? null) ? "bg-brand-soft" : "bg-surface",
                )}
              >
                {e ? (
                  <>
                    <span className="block font-medium">{eventTitle(e, lang)}</span>
                    <span className="text-muted">{formatWhen(e.startsAt, lang)}</span>
                  </>
                ) : (
                  t.profile.noEvent
                )}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <textarea
        rows={3}
        maxLength={280}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t.profile.notePlaceholder}
        className="mb-3 w-full rounded-xl border-2 border-line bg-bg p-3 text-base outline-none focus:border-brand"
      />
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button className="flex-[2]" onClick={send} disabled={busy}>
          {t.profile.send}
        </Button>
      </div>
    </>
  );
}
