"use client";

import type { Lang } from "@/lib/contract";
import { cx } from "./ui";

export function LangToggle({ value, onChange }: { value: Lang; onChange: (l: Lang) => void }) {
  return (
    <div role="radiogroup" className="inline-flex rounded-full border border-line bg-surface p-1 text-sm">
      {(["th", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={value === l}
          onClick={() => onChange(l)}
          className={cx("min-h-9 rounded-full px-4", value === l ? "bg-ink text-bg" : "text-muted")}
        >
          {l === "th" ? "ไทย" : "English"}
        </button>
      ))}
    </div>
  );
}
