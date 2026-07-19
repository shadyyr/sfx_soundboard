(() => {
  "use strict";

  const SLOTS = 16;
  // shade layout shared with icons/ artwork
  const SHADE_PATTERN = [0, 1, 0, 2, 3, 0, 1, 0, 0, 2, 0, 3, 1, 0, 2, 0];

  const board = document.getElementById("board");
  const statusEl = document.getElementById("status");

  const AC = window.AudioContext || window.webkitAudioContext;

  function createContext() {
    const c = new AC();
    // iOS: route Web Audio to the media-playback session so the ring/silent
    // switch doesn't mute it (Safari 16.4+)
    if ("audioSession" in navigator) {
      try {
        navigator.audioSession.type = "playback";
      } catch (err) {
        /* older Safari */
      }
    }
    c.addEventListener("statechange", onStateChange);
    return c;
  }

  let ctx = createContext();

  // iOS tears down the audio pipeline of long-backgrounded tabs; the old
  // context may even claim "running" while rendering nothing. Decoded
  // AudioBuffers are context-independent, so swapping in a fresh context
  // inside a later tap fully recovers.
  let lastRebuild = 0;
  function rebuildContext() {
    const now = Date.now();
    if (now - lastRebuild < 1000) return false; // don't thrash
    lastRebuild = now;
    ctx.removeEventListener("statechange", onStateChange);
    try {
      ctx.close().catch(() => {});
    } catch (err) {
      /* already closed */
    }
    playing.forEach((src, slot) => keys[slot].classList.remove("playing"));
    playing.clear();
    ctx = createContext();
    if (ctx.state !== "running") ctx.resume().catch(() => {});
    onStateChange();
    return true;
  }

  function onStateChange() {
    if (!readyStatus) return; // still loading — keep the loading text
    setStatus(ctx.state === "running" ? readyStatus : "sound paused — tap any key");
  }

  const buffers = new Map(); // slot -> AudioBuffer
  const playing = new Map(); // slot -> AudioBufferSourceNode
  const keys = [];
  let readyStatus = "";

  function setStatus(text) {
    statusEl.textContent = text;
  }

  async function init() {
    let entries;
    try {
      const res = await fetch("sounds/manifest.json", { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      entries = (await res.json()).sounds.slice(0, SLOTS);
    } catch (err) {
      console.error("annabelle.sfx: could not load sounds/manifest.json", err);
      setStatus("could not load sounds/manifest.json");
      return;
    }
    // a hand-edited manifest may contain null or non-object entries
    entries = entries.map((entry) =>
      entry && typeof entry === "object" ? entry : { file: "", label: "" }
    );
    while (entries.length < SLOTS) entries.push({ file: "", label: "" });
    buildBoard(entries);
    await loadSounds(entries);
  }

  function buildBoard(entries) {
    entries.forEach((entry, slot) => {
      const key = document.createElement("button");
      key.type = "button";
      const shade = Number.isInteger(entry.shade) ? entry.shade % 4 : SHADE_PATTERN[slot];
      key.className = `key shade-${shade}`;
      key.dataset.slot = slot;

      const label = document.createElement("span");
      label.className = "label";
      label.textContent = entry.label || String(slot + 1).padStart(2, "0");
      key.append(label);

      if (entry.file) {
        key.classList.add("pending"); // dimmed until its buffer has decoded
        key.setAttribute("aria-label", `play ${entry.label || "sound " + (slot + 1)}`);
      } else {
        markEmpty(key, slot);
      }
      keys.push(key);
      board.append(key);
    });
  }

  function markEmpty(key, slot) {
    key.classList.remove("pending");
    key.classList.add("empty");
    key.disabled = true;
    key.setAttribute("aria-label", `empty slot ${slot + 1}`);
  }

  async function loadSounds(entries) {
    setStatus("loading sounds");
    await Promise.all(
      entries.map(async (entry, slot) => {
        if (!entry.file) return;
        try {
          // encodeURIComponent: filenames may contain #, ?, % etc.
          // cache: "no-cache" revalidates so same-name file swaps are heard
          const res = await fetch("sounds/" + encodeURIComponent(entry.file), {
            cache: "no-cache",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          buffers.set(slot, await ctx.decodeAudioData(await res.arrayBuffer()));
          keys[slot].classList.remove("pending");
        } catch (err) {
          console.warn(`annabelle.sfx: could not load "${entry.file}"`, err);
          markEmpty(keys[slot], slot);
        }
      })
    );
    readyStatus =
      buffers.size === 0
        ? "no sounds yet — see sounds/README.md"
        : `ready · ${buffers.size}/${SLOTS} keys`;
    setStatus(readyStatus);
  }

  function trigger(slot) {
    const buffer = buffers.get(slot);
    if (!buffer) return;

    const prev = playing.get(slot); // re-tapping a key restarts its sound
    if (prev) {
      try {
        prev.stop();
      } catch (err) {
        /* already stopped */
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.onended = () => {
      if (playing.get(slot) === src) {
        playing.delete(slot);
        keys[slot].classList.remove("playing");
      }
    };
    playing.set(slot, src);
    keys[slot].classList.add("playing");
    src.start();

    // zombie check: a context revived after backgrounding can report
    // "running" with a frozen clock and no output — rebuild and replay
    const myCtx = ctx;
    const t0 = myCtx.currentTime;
    setTimeout(() => {
      if (myCtx === ctx && ctx.state === "running" && ctx.currentTime === t0) {
        if (rebuildContext()) trigger(slot);
      }
    }, 250);
  }

  function slotOf(target) {
    const key = target.closest("button.key");
    return key && !key.disabled ? Number(key.dataset.slot) : null;
  }

  // taps made while the context is still locked, keyed by pointer so
  // multi-touch works and a cancelled gesture can't ghost-play later
  const pendingTaps = new Map();

  board.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return; // ignore right/middle mouse buttons
    const slot = slotOf(e.target);
    if (slot === null) return;
    if (ctx.state === "running") {
      trigger(slot);
    } else {
      // WebKit only grants the audio unlock on touchend/click-type gestures,
      // so the first tap resumes and plays on pointerup instead
      pendingTaps.set(e.pointerId, slot);
    }
  });

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // resume the context; if it won't revive promptly (iOS after a long
  // background), swap in a fresh context and play on that instead
  async function unlockAndPlay(slot) {
    const myCtx = ctx;
    const resumed = await Promise.race([
      myCtx.resume().then(() => true, () => false),
      wait(600).then(() => false),
    ]);
    if (myCtx === ctx && (!resumed || ctx.state !== "running")) rebuildContext();
    trigger(slot);
  }

  // window-level so a mouse released off the board still settles the tap
  window.addEventListener("pointerup", (e) => {
    const slot = pendingTaps.get(e.pointerId);
    if (slot === undefined) return;
    pendingTaps.delete(e.pointerId);
    unlockAndPlay(slot);
  });

  window.addEventListener("pointercancel", (e) => {
    pendingTaps.delete(e.pointerId);
  });

  // keyboard activation (Enter/Space) arrives as a click with detail 0;
  // pointer taps are already handled above
  board.addEventListener("click", (e) => {
    if (e.detail !== 0) return;
    const slot = slotOf(e.target);
    if (slot === null) return;
    if (ctx.state === "running") {
      trigger(slot);
    } else {
      unlockAndPlay(slot);
    }
  });

  // proactively revive the context when the tab returns to the foreground
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && ctx.state !== "running") {
      ctx.resume().catch(() => {});
    }
  });
  window.addEventListener("pageshow", (e) => {
    if (e.persisted && ctx.state !== "running") ctx.resume().catch(() => {});
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("annabelle.sfx: service worker registration failed", err);
      });
    });
  }

  init();
})();
