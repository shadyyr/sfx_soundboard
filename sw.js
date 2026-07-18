"use strict";

const CACHE = "annabelle-sfx-v1";
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
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function cachePut(request, response) {
  const copy = response.clone();
  caches.open(CACHE).then((cache) => cache.put(request, copy));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.includes("/sounds/")) {
    // network-first: the user edits these files, so changes must show up on reload
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) cachePut(req, res);
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error()))
    );
  } else {
    // app shell: cache-first, updated by bumping CACHE
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) cachePut(req, res);
            return res;
          })
      )
    );
  }
});
