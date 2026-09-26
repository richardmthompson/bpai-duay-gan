"use client";

import { useId, useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { TagChip, cx } from "./ui";
import { groupTags } from "@/lib/tagGroups";

/**
 * Tags under the taxonomy headings, each heading opening and closing. Each chip shows the reader's
 * interface language only. Groups holding a selected tag start open; the rest start closed.
 */
export function TagPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { tags, lang, t } = useApp();
  const baseId = useId();
  const groups = useMemo(() => groupTags(tags), [tags]);
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(groups.filter((g) => g.tags.some((tag) => value.includes(tag.id))).map((g) => g.id)),
  );
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const toggleGroup = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const isOpen = open.has(group.id);
        const selected = group.tags.filter((tag) => value.includes(tag.id)).length;
        const panelId = `${baseId}-${group.id}`;
        return (
          <div key={group.id}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleGroup(group.id)}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-left font-medium"
            >
              <span className="flex-1">{t.tagPicker.groups[group.id]}</span>
              {selected > 0 && (
                <span
                  aria-label={t.tagPicker.selected(selected)}
                  className="grid min-w-6 place-items-center rounded-full border-2 border-line bg-brand px-1.5 text-xs font-bold text-brand-ink"
                >
                  {selected}
                </span>
              )}
              <span aria-hidden className={cx("text-muted transition-transform", isOpen && "rotate-180")}>
                ▾
              </span>
            </button>
            <div id={panelId} hidden={!isOpen} className="flex flex-wrap gap-2 px-1 pb-2 pt-3">
              {group.tags.map((tag) => (
                <TagChip
                  key={tag.id}
                  selected={value.includes(tag.id)}
                  onClick={() => toggle(tag.id)}
                  label={lang === "th" ? tag.labelTh : tag.labelEn}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
