const CACHE_NAME = "lunas-shell-v1";
const SHELL_ASSETS = [
  "/",
  "/cotizador",
  "/config",
  "/creditos",
  "/cobranzas",
  "/tesoreria",
  "/almacen/productos",
  "/catalogo",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
const NAVIGATION_ALLOWLIST = new Set([
  "/",
  "/cotizador",
  "/config",
  "/creditos",
  "/cobranzas",
  "/tesoreria",
  "/almacen/productos",
  "/catalogo",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    if (!NAVIGATION_ALLOWLIST.has(url.pathname)) return;
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          const copy = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
          return networkRes;
        })
        .catch(async () => (await caches.match(req)) || caches.match("/"))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((networkRes) => {
          if (networkRes.ok && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => undefined);
          }
          return networkRes;
        })
    )
  );
});
