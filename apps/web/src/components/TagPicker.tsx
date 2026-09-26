"use client";

import { useApp } from "./AppProvider";
import { TagChip } from "./ui";

/** Shows both labels so a Thai and an English speaker read the same list. */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { tags, lang } = useApp();
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2">
      {[...tags]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((tag) => {
          const primary = lang === "th" ? tag.labelTh : tag.labelEn;
          const secondary = lang === "th" ? tag.labelEn : tag.labelTh;
          return (
            <TagChip
              key={tag.id}
              selected={value.includes(tag.id)}
              onClick={() => toggle(tag.id)}
              label={`${primary} · ${secondary}`}
            />
          );
        })}
    </div>
  );
}
