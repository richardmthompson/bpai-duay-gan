"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { cx } from "./ui";

export function GoingButton({ eventId, going, onChange }: { eventId: string; going: boolean; onChange: (going: boolean) => void }) {
  const { t } = useApp();
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    onChange(!going); // optimistic
    try {
      await api.setGoing(eventId, !going);
    } catch {
      onChange(going);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={going}
      disabled={busy}
      onClick={toggle}
      className={cx(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border-2 border-line px-4 text-sm font-medium shadow-hard-sm transition active:scale-95",
        going ? "bg-ok text-white" : "bg-surface text-ink",
      )}
    >
      {going ? `✓ ${t.events.going}` : t.events.imGoing}
    </button>
  );
}
