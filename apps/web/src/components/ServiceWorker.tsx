"use client";

import { useEffect } from "react";

/** Registers the install-enabling worker. It caches nothing — see public/sw.js. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
