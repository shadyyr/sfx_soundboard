# Adding your own sounds

1. Drop your audio files into this folder. Anything the browser can decode works:
   `.mp3`, `.ogg`, `.wav`, `.m4a` — short clips (a few seconds) feel best on a soundboard.
2. Edit `manifest.json`. The 16 entries map to the 16 keys, left-to-right, top-to-bottom:

   ```json
   { "file": "airhorn.mp3", "label": "airhorn" }
   ```

   - `file` — filename inside this folder. Leave it `""` to keep the key empty
     (empty keys render dimmed and do nothing when tapped).
   - `label` — text shown on the key. If omitted, the slot number is shown.
   - `shade` *(optional)* — `0`–`3` to pick the key's green shade
     (0 forest, 1 jade, 2 sage, 3 pine). Without it, keys follow the default pattern.

3. Reload the page. The status line in the header shows how many keys loaded.
