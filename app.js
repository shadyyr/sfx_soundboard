(() => {
  "use strict";

  const SLOTS = 16;
  // shade layout shared with icons/ artwork
  const SHADE_PATTERN = [0, 1, 0, 2, 3, 0, 1, 0, 0, 2, 0, 3, 1, 0, 2, 0];

  const board = document.getElementById("board");
  const statusEl = document.getElementById("status");

  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();

  // iOS: route Web Audio to the media-playback session so the ring/silent
  // switch doesn't mute it (Safari 16.4+)
  if ("audioSession" in navigator) {
    try {
      navigator.audioSession.type = "playback";
    } catch (err) {
      /* older Safari */
    }
  }
  const buffers = new Map(); // slot -> AudioBuffer
  const playing = new Map(); // slot -> AudioBufferSourceNode
  const keys = [];

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
    setStatus(
      buffers.size === 0
        ? "no sounds yet — see sounds/README.md"
        : `ready · ${buffers.size}/${SLOTS} keys`
    );
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

  // window-level so a mouse released off the board still settles the tap
  window.addEventListener("pointerup", (e) => {
    const slot = pendingTaps.get(e.pointerId);
    if (slot === undefined) return;
    pendingTaps.delete(e.pointerId);
    ctx.resume().then(() => trigger(slot)).catch(() => {});
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
      ctx.resume().then(() => trigger(slot)).catch(() => {});
    }
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
