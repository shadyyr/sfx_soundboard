# annabelle.sfx

A mobile-first soundboard styled after a Stream Deck: a 4×4 grid of sixteen
tactile keys, each playing one sound effect on tap. Vanilla HTML/CSS/JS — no
build step, no dependencies — installable as a PWA that keeps working offline.

```
┌──────────────────────────────────────┐
│ annabelle.sfx        ready · 16/16   │  ← wordmark + live status line
│                                      │
│   ████   ████   ████   ████         │
│   ████   ████   ████   ████         │  16 square keys in shades of
│                                      │  forest green; tap = sound
│   ████   ████   ████   ████         │
│   ████   ████   ████   ████         │  (tile labels exist but are
│                                      │   currently hidden by CSS)
│   ████   ████   ████   ████         │
│   ████   ████   ████   ████         │
│                                      │
│   ████   ████   ████   ████         │
│   ████   ████   ████   ████         │
└──────────────────────────────────────┘
```

## Run it

Service workers need HTTP, so serve the folder instead of opening `index.html`
directly:

```
python -m http.server 8000
```

Then open <http://localhost:8000>. On a phone on the same network, use your
machine's LAN address. Sounds play fine over plain HTTP; only the service
worker (offline mode, install-as-app) requires HTTPS outside `localhost`.

## What's in the repo

```
index.html            app shell — static markup only, no inline logic
style.css             forest-green theme (dark default + light), key states
app.js                board build, Web Audio playback, iOS audio recovery
sw.js                 service worker: precache + runtime caching (CACHE vN)
manifest.webmanifest  PWA install metadata + icons
test.html             on-device diagnostics page (see bottom)
sounds/               the 16 WAVs + manifest.json mapping files → keys
fonts/                self-hosted IBM Plex Mono woff2 (400 / 600)
icons/                PWA icons, including a maskable variant
tools/make-icons.ps1  regenerates the icons
```

## How the app boots

```
index.html ──loads──► app.js
                        │
                        ├─► fetch sounds/manifest.json ──► build the 16 keys
                        │      (16 entries, in board order: left→right,
                        │       top→bottom; empty entries = dimmed keys)
                        │
                        ├─► fetch + decode every WAV ──► AudioBuffers in RAM
                        │      keys stay dimmed ("pending") until their
                        │      buffer is ready; status line counts them up
                        │
                        └─► register sw.js ──► precache the app shell
```

All sixteen sounds are decoded up front, so playback later is instant — a tap
never waits on the network.

## How a tap becomes a sound

```
pointerdown on a key
   │
   ├─ AudioContext running? ──yes──► play its buffer immediately
   │                                  · re-tapping a key restarts its sound
   │                                  · different keys overlap freely
   │
   └─ no (browser has audio locked, or iOS suspended it)
        ├─ tap is armed per-pointer, resume() attempted right away
        │     └─ fulfills? ──► plays before the finger even lifts
        └─ pointerup fallback: resume() raced against 600 ms
              ├─ context revives ──► play
              └─ context is dead ──► rebuild the AudioContext ──► play
```

After every play, a 250 ms watchdog checks that the audio clock actually
advanced; a context that claims to be "running" with a frozen clock (an iOS
speciality) is torn down, rebuilt, and the sound replayed automatically.
Decoded AudioBuffers survive context swaps, so rebuilds are cheap.

## The sound manifest

[sounds/manifest.json](sounds/manifest.json) is the single source of truth —
16 entries, one per key:

```json
{ "file": "airhorn.wav", "label": "airhorn" }
```

Drop audio files into [sounds/](sounds/), edit the manifest, reload. Details
(empty slots, shade overrides, label fallbacks) in
[sounds/README.md](sounds/README.md). Sounds are served network-first, so a
same-name file swap is picked up on the next reload with no cache tricks.

## Offline / PWA caching

`sw.js` routes every request through one of two strategies:

```
request ──► same-origin GET?
   │
   ├─ no ───► untouched, browser default
   │
   └─ yes
       ├─ /sounds/* or test.html ──► NETWORK FIRST (HTTP cache bypassed)
       │                             └─ offline ──► runtime cache fallback
       │       user-edited content must always be fresh when online
       │
       └─ everything else ─────────► CACHE FIRST from the precached shell
               └─ miss ──► network, response cached for next time
               app updates ship by bumping the CACHE constant in sw.js
```

Navigations ignore query strings (a shared `?utm=…` link still hits the
cached shell offline) and fall back to the cached root as a last resort.
The activate step only deletes caches matching this app's `annabelle-sfx-`
prefix, so other apps on the same origin are left alone.

## iOS audio, the hard-won parts

Everything in this section exists because real-device testing proved it
necessary:

- **Unlock**: browsers keep audio suspended until a user gesture, and WebKit
  historically only accepts the *end* of a tap. The app arms the tap at
  finger-down, tries `resume()` immediately (modern iOS grants it there), and
  falls back to finger-up — whichever wins, the first tap plays.
- **Silent switch**: `navigator.audioSession.type = "playback"` routes Web
  Audio like real media, so the ring/silent switch doesn't mute it
  (iOS 16.4+).
- **Session keep-alive**: after a tab sits in the background for a while, iOS
  detaches its audio session while the AudioContext keeps "rendering" —
  silently. No API reports this. The fix: a looping, in-memory silent WAV
  played through a hidden `<audio>` element. Real media playback holds the
  session, so sound survives backgrounding and the first tap on return is
  instant. Trade-off: while the board holds the session, other audio (music
  apps) stays paused, and iOS may show the site in Now Playing.
- **Zombie recovery**: the frozen-clock watchdog and context-rebuild path
  described above, kept as a second line of defense.

## Diagnostics — test.html

Open `/test.html` on any device for a self-running checkup: environment info,
audio session support, service worker + cache state, per-file decode results,
unlock behavior, and an interactive hearing test with a recovery ladder for
the iOS silent-session bug. A verdict banner at the top tracks everything and
ends at **"all good!"** once every check — including recovery after
backgrounding the tab — has passed. It also reports audio latency numbers and
has a keep-alive A/B toggle for chasing tap-to-sound delay.
