const CACHE_PREFIX = "mrbd-map-game-lab-";
const workerUrl = new URL(self.location.href);
const buildToken = (workerUrl.searchParams.get("v") || "local-dev").replace(/[^a-zA-Z0-9._-]/g, "-");
const CACHE_NAME = `${CACHE_PREFIX}${buildToken}`;
const APP_BASE = new URL("./", workerUrl);
const appUrl = (relativePath) => new URL(relativePath, APP_BASE).href;
const INDEX_URL = appUrl("index.html");
const APP_SHELL = [
  appUrl("./"),
  INDEX_URL,
  appUrl("styles.css"),
  appUrl("app.js"),
  appUrl("build-info.js"),
  appUrl("manifest.webmanifest"),
  appUrl("modules/logger.js"),
  appUrl("modules/environment.js"),
  appUrl("modules/input.js"),
  appUrl("modules/storage.js"),
  appUrl("modules/lifecycle.js"),
  appUrl("modules/network.js"),
  appUrl("modules/export.js"),
  appUrl("modules/ui.js"),
  appUrl("modules/preferences.js"),
  appUrl("modules/navigation.js"),
  appUrl("modules/input-state.js"),
  appUrl("modules/lifecycle-checkpoint.js"),
  appUrl("modules/runtime-context.js"),
  appUrl("modules/lifecycle-trace.js"),
  appUrl("modules/activation.js"),
  appUrl("modules/runtime-snapshot.js"),
  appUrl("modules/location.js"),
  appUrl("modules/motion.js")
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name))))
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
        if (event.request.mode === "navigate") return caches.match(INDEX_URL);
        return new Response("Offline and not cached", { status: 503, headers: { "Content-Type": "text/plain" } });
      })
  );
});
