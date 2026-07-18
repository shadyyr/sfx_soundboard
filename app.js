(() => {
  "use strict";

  const SLOTS = 16;
  // shade layout shared with icons/ artwork
  const SHADE_PATTERN = [0, 1, 0, 2, 3, 0, 1, 0, 0, 2, 0, 3, 1, 0, 2, 0];

  const board = document.getElementById("board");
  const statusEl = document.getElementById("status");

  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
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
        key.setAttribute("aria-label", `play ${entry.label || "sound " + (slot + 1)}`);
      } else {
        markEmpty(key, slot);
      }
      keys.push(key);
      board.append(key);
    });
  }

  function markEmpty(key, slot) {
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
          const res = await fetch("sounds/" + entry.file);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          buffers.set(slot, await ctx.decodeAudioData(await res.arrayBuffer()));
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

  board.addEventListener("pointerdown", (e) => {
    const slot = slotOf(e.target);
    if (slot === null) return;
    if (ctx.state === "suspended") {
      // browsers keep the context suspended until a user gesture
      ctx.resume().then(() => trigger(slot));
    } else {
      trigger(slot);
    }
  });

  // keyboard activation (Enter/Space) arrives as a click with detail 0;
  // pointer taps are already handled on pointerdown above
  board.addEventListener("click", (e) => {
    if (e.detail !== 0) return;
    const slot = slotOf(e.target);
    if (slot !== null) trigger(slot);
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
