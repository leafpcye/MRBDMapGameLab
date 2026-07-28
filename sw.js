const CACHE_NAME = "mrbd-map-game-lab-v0.1.0";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/build-info.js",
  "/manifest.webmanifest",
  "/modules/logger.js",
  "/modules/environment.js",
  "/modules/input.js",
  "/modules/storage.js",
  "/modules/lifecycle.js",
  "/modules/network.js",
  "/modules/export.js",
  "/modules/ui.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith("mrbd-map-game-lab-") && name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("/index.html");
        return new Response("Offline and not cached", { status: 503, headers: { "Content-Type": "text/plain" } });
      })
  );
});
