const CACHE = "ventana-seca-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./estilos.css",
  "./app.js",
  "./ui.js",
  "./manifest.json",
  "./data/cola.json",
];

function asCachedResponse(res) {
  // Never hand a redirected Response to respondWith (SW rejects it).
  if (!res || !res.redirected) return res;
  return res.blob().then(
    (body) =>
      new Response(body, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // Navigations: network-first, never return redirected response; offline → index.html
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => asCachedResponse(res))
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("./index.html", copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  if (!sameOrigin) return;

  // Assets + cola: stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const networked = fetch(req)
        .then((res) => asCachedResponse(res))
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networked;
    })
  );
});
