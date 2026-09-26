"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "./AppProvider";
import { Button, Sheet } from "./ui";

/** Block and report, used on the profile and in the chat header. */
export function SafetyActions({
  userId,
  name,
  matchId,
  onBlocked,
  compact,
}: {
  userId: string;
  name: string;
  matchId?: string;
  onBlocked: () => void;
  compact?: boolean;
}) {
  const { t } = useApp();
  const [sheet, setSheet] = useState<"block" | "report" | null>(null);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function block() {
    setBusy(true);
    try {
      await api.block(userId);
      setSheet(null);
      onBlocked();
    } finally {
      setBusy(false);
    }
  }

  async function report() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await api.report({ userId, reason: reason.trim(), matchId: matchId ?? null });
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={compact ? "flex gap-1" : "flex justify-center gap-4 pt-2"}>
        <button type="button" className="min-h-10 px-2 text-sm text-muted underline-offset-2 hover:underline" onClick={() => setSheet("report")}>
          {t.profile.report}
        </button>
        <button type="button" className="min-h-10 px-2 text-sm text-danger underline-offset-2 hover:underline" onClick={() => setSheet("block")}>
          {t.profile.block}
        </button>
      </div>

      <Sheet open={sheet === "block"} onClose={() => setSheet(null)} title={t.profile.block}>
        <p className="mb-4 text-muted">{t.profile.blockConfirm(name)}</p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setSheet(null)}>
            {t.common.cancel}
          </Button>
          <Button variant="danger" className="flex-1" onClick={block} disabled={busy}>
            {t.profile.block}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === "report"}
        onClose={() => {
          setSheet(null);
          setDone(false);
          setReason("");
        }}
        title={t.profile.reportTitle(name)}
      >
        {done ? (
          <p className="text-muted">{t.profile.reportSent}</p>
        ) : (
          <>
            <textarea
              rows={4}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.profile.reportPlaceholder}
              className="mb-3 w-full rounded-xl border border-line bg-bg p-3 text-base outline-none focus:border-brand"
            />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setSheet(null)}>
                {t.common.cancel}
              </Button>
              <Button className="flex-1" onClick={report} disabled={busy || !reason.trim()}>
                {t.profile.report}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
