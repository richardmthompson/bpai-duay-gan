"use client";

import { GENDERS, type Gender } from "@/lib/contract";
import { useApp } from "./AppProvider";
import { cx } from "./ui";

/** Four outlined options in the reader's language; the chosen one is filled. Wraps on narrow screens. */
export function GenderPicker({ value, onChange }: { value: Gender | null; onChange: (g: Gender) => void }) {
  const { t } = useApp();
  const label: Record<Gender, string> = {
    male: t.me.genderMale,
    female: t.me.genderFemale,
    other: t.me.genderOther,
    undisclosed: t.me.genderUndisclosed,
  };
  return (
    <div role="radiogroup" aria-label={t.me.gender} className="flex flex-wrap gap-2">
      {GENDERS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          onClick={() => onChange(g)}
          className={cx(
            "min-h-10 rounded-full border-2 border-line px-4 text-sm shadow-hard-sm transition-colors active:scale-95",
            value === g ? "bg-ink font-medium text-bg" : "bg-surface text-ink",
          )}
        >
          {label[g]}
        </button>
      ))}
    </div>
  );
}
