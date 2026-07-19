# annabelle.sfx

A mobile-first soundboard webapp styled after a Stream Deck: a 4×4 grid of sixteen
tactile keys, each playing one sound effect on tap. Vanilla HTML/CSS/JS, no build
step, installable as a PWA (add to home screen, works offline).

## Run it

Service workers need HTTP, so serve the folder instead of opening `index.html` directly:

```
python -m http.server 8000
```

Then open <http://localhost:8000>. On a phone on the same network, use your
machine's LAN address. Sounds play fine over plain HTTP; only the service
worker (offline mode, install-as-app) requires HTTPS outside `localhost`.

## Add your sounds

Drop audio files into [sounds/](sounds/) and map them to keys in
[sounds/manifest.json](sounds/manifest.json) — see [sounds/README.md](sounds/README.md).
All 16 keys currently have sounds wired up; swap any entry to change its key.

## How it works

- [index.html](index.html) is a static shell; [app.js](app.js) builds the 4×4 grid
  from the sound manifest and plays clips through the Web Audio API (decoded
  buffers, `pointerdown` triggering, re-tap restarts, different keys overlap).
- [style.css](style.css) — forest-green palette (WCAG AA checked), self-hosted
  IBM Plex Mono, dark chassis by default with a light theme via
  `prefers-color-scheme`.
- [sw.js](sw.js) precaches the app shell (cache-first) and runtime-caches
  everything under `sounds/` with network-first, so manifest edits show up
  immediately while everything keeps working offline.
- [tools/make-icons.ps1](tools/make-icons.ps1) regenerates the PWA icons.
