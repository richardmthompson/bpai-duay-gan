"use client";

import Link from "next/link";
import { useApp } from "./AppProvider";

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      {toasts.map((x) => {
        const body = <span className="block px-4 py-3 text-sm font-medium">{x.text}</span>;
        return (
          <div key={x.id} role="status" className="pointer-events-auto w-full max-w-md rounded-xl border-2 border-line bg-ink text-bg shadow-hard-sm">
            {x.href ? (
              <Link href={x.href} onClick={() => dismissToast(x.id)}>
                {body}
              </Link>
            ) : (
              body
            )}
          </div>
        );
      })}
    </div>
  );
}
