/*
 * A deliberately thin service worker. It exists so the app can be installed to a home screen,
 * and it caches nothing.
 *
 * Every screen here is live data behind a bearer token, so a cached response is a wrong
 * response — the same reason the api and the /v1 calls are `no-store`. A worker that kept
 * responses would resurrect the previous account's people and notifications after a sign-out,
 * which is exactly the bug this app just fixed. So the fetch handler passes straight through;
 * its presence is what makes Chrome offer the install prompt.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Navigations answer from the network, always. Other requests fall through to the browser.
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request));
});
