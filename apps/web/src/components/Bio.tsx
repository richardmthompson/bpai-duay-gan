"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";

/**
 * A person's own words, shown in the reader's language when we have that copy, with a tap to see
 * the original. The same gesture as a translated chat message, because it is the same promise:
 * you read in your language, and nothing is taken from the person who wrote it.
 */
export function Bio({ original, translated, heading }: { original: string; translated: string | null; heading: string }) {
  const { t } = useApp();
  const [flipped, setFlipped] = useState(false);
  const canFlip = Boolean(translated);
  const lead = canFlip && !flipped ? translated! : original;

  return (
    <section>
      <h3 className="mb-1 font-semibold">{heading}</h3>
      <button
        type="button"
        disabled={!canFlip}
        onClick={() => setFlipped((f) => !f)}
        className="block w-full text-left"
      >
        <p className="whitespace-pre-line text-sm text-muted">{lead}</p>
      </button>
      {canFlip && (
        <p className="mt-0.5 text-[11px] text-muted">
          {flipped ? t.chat.showTranslation : t.chat.showOriginal}
        </p>
      )}
    </section>
  );
}
