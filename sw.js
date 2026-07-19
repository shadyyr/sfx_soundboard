"use strict";

const CACHE = "annabelle-sfx-v8";
const SHELL = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "manifest.webmanifest",
  "sounds/manifest.json",
  "fonts/ibm-plex-mono-400.woff2",
  "fonts/ibm-plex-mono-600.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      // cache: "reload" bypasses the HTTP cache so a version bump can never
      // precache stale copies of the shell
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      // CacheStorage is shared origin-wide — only touch this app's caches
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.startsWith("annabelle-sfx-") && n !== CACHE)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

function cachePut(event, request, response) {
  const copy = response.clone();
  // waitUntil keeps the worker alive until the write lands
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.put(request, copy))
      .catch(() => {})
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // sounds are user-swapped and test.html is a diagnostics page — both must
  // always be fresh when online, with the runtime cache as offline fallback
  if (url.pathname.includes("/sounds/") || url.pathname.endsWith("/test.html")) {
    // network-first, bypassing the HTTP cache so same-name file replacements
    // are picked up on reload
    const netReq = req.mode === "navigate" ? req : new Request(req, { cache: "no-cache" });
    e.respondWith(
      fetch(netReq)
        .then((res) => {
          if (res.ok) cachePut(e, req, res);
          return res;
        })
        .catch(() =>
          caches
            .open(CACHE)
            .then((cache) => cache.match(req))
            .then((hit) => hit || Response.error())
        )
    );
  } else {
    // app shell: cache-first, updated by bumping CACHE; navigations ignore
    // query strings so shared/tagged links still hit the precached shell
    e.respondWith(
      caches
        .open(CACHE)
        .then((cache) =>
          cache.match(req, { ignoreSearch: req.mode === "navigate" }).then(
            (hit) =>
              hit ||
              fetch(req).then((res) => {
                if (res.ok) cachePut(e, req, res);
                return res;
              })
          )
        )
        .catch(() => {
          if (req.mode !== "navigate") return Response.error();
          return caches
            .open(CACHE)
            .then((cache) => cache.match("./"))
            .then((hit) => hit || Response.error());
        })
    );
  }
});
