# Sequencer

A browser-based music sequencer built with vanilla HTML, CSS, and JavaScript. It uses the Web Audio API for sound generation and HTML5 Canvas for rendering. Features virtual scrolling for long timelines, a wide pitch range, comprehensive song tools, save/load, undo/redo, and offline MP3 export.

## Features

- **One-screen responsive layout** – Fills the viewport with no page scrollbars (360×560 and up). Header is compact (~44px), transport is a slim toolbar, the piano roll fills remaining space, and Sound/Keyboard controls live in a collapsible bottom dock (or right sidebar at ≥1100px).
- **Piano roll with pinned layers** – Piano and grid are drawn on a pinned sticky layer inside `#gridScroller`, with a scrollable spacer providing navigation. Scrolling never hides the piano or grid lines.
- **Long timeline support** – Virtual scrolling with zoom (12–64px cell width) supporting up to 128 bars (2048 steps). Canvas stays viewport-sized while native scrollbars handle navigation.
- **Wide pitch range** – 60 rows spanning 5 octaves (C2–B6, MIDI 36–95). Octave labels appear on C keys, and piano rows align perfectly with grid rows at all scroll positions.
- **Flexible zoom & scroll** – Zoom via +/- buttons or Ctrl/Cmd + mouse wheel (when over the grid). Scroll vertically with mouse wheel, horizontally with Shift+wheel. Touch: one-finger drag scrolls, tap toggles cells. A Draw/Scroll toggle allows painting without scrolling on touch devices.
- **Follow playhead** – Automatically scrolls to keep the playhead visible while playing (page-flips when it reaches 80% of the visible area).
- **Position readout** – Shows "Bar N – Beat M   t/total" in the transport.
- **Tempo control** – Adjustable BPM from 60 to 180.
- **Rich timbre selection** – 20+ synthesized instruments generated via additive synthesis from code.
- **ADSR envelope controls** – Attack, Decay, Sustain, and Release with live visualization on a crisp HiDPI canvas.
- **Master volume control** – Global output level adjustment.
- **Visual playhead** – Tinted column, needle, and bar/beat indicator show current playback position.
- **Loop region** – Drag the loop bar to define start/end, click to toggle on/off, resize edges, or drag to reposition.
- **Start marker** – Click the ruler to set where playback starts and stops (Stop returns to the start marker).
- **Intuitive cell editing** – Click/drag to toggle steps on/off with smooth, flicker-free painting.
- **Keyboard input** – Computer keys play notes using physical key codes (`e.code`), so AZERTY/QWERTZ layouts work and Shift/CapsLock don't interfere. PageDown/PageUp shift octave (or use Oct −/Oct + buttons).
- **Step recording** – Toggle Rec (off by default) to have piano/computer keys write into the grid (undoable). When off, keys play in preview mode only.
- **Song tools** – Adjust bars (+/- with confirmation if notes would be lost), Duplicate Bar, Clear Bar, Copy Bar, Paste Bar. The overview strip shows whole-song density with viewport and playhead; click/drag to navigate.
- **Save/Open** – Download `.json` song files or open saved files. Autosave to localStorage; reloading restores the last song.
- **Undo/Redo** – Full history with Ctrl+Z, Ctrl+Shift+Z, and Ctrl+Y (max 50 snapshots).
- **Export to audio** – Export the whole song or loop region as MP3 (with WAV fallback). Options include repeat count (1/2/4/8) and quality (128/192/320 kbps). Uses segment-based offline rendering for long songs.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Space | Play / Stop |
| PageDown | Shift keyboard octave down |
| PageUp | Shift keyboard octave up |
| Oct − / Oct + | Shift keyboard octave down/up (Keyboard panel) |
| Ctrl/Cmd + D | Duplicate current bar |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y | Redo |
| Home | Go to start of song |
| End | Go to end of song |
| Ctrl/Cmd + mouse wheel | Zoom grid (when pointer is over grid) |
| A–L, ; | Play white keys (C4–B5) |
| Z–M, ,, ., / | Play black keys (sharps) |
| Rec toggle | Enable step recording (writes to grid, undoable) |

Notes only fire when no modifier (Ctrl/Cmd/Alt) is held. Shortcuts are ignored while focus is inside an input/select/textarea, and key repeat is ignored for note keys.

## How to Run

1. Open `index.html` in a modern web browser (Chrome, Firefox, Safari, or Edge).
2. Click anywhere on the page to enable audio (required by browser autoplay policies).
3. Click the grid to place notes, or press computer keys to play and record.
4. Click **Export** in the transport toolbar to open the export dialog and download your song.

## File Structure

| File | Purpose |
|---|---|
| `index.html` | Main HTML structure and UI layout |
| `style.css` | Styling (Material-inspired design) |
| `js/timbres.js` | Additive synthesis timbres (harmonic arrays + `TIMBRES` table) |
| `js/audio.js` | Web Audio API setup, instruments, playback, master gain, compressor/limiter, reverb |
| `js/envelope.js` | ADSR envelope parameters and visualization |
| `js/piano.js` | Piano keyboard drawing and interaction |
| `js/sequencer.js` | Grid state, scheduling, canvas rendering, virtual scrolling, undo/redo, song tools |
| `js/export.js` | Offline audio rendering and MP3/WAV export (segment-based with overlap-add) |
| `js/main.js` | Application initialization and event wiring |
| `js/vendor/lame.min.js` | lamejs MP3 encoder (LGPL-3.0) |
| `js/vendor/LICENSE-lamejs.txt` | lamejs license |
| `README.md` | Project documentation |

## Song File Format (.json)

```json
{
  "version": 1,
  "bpm": 100,
  "bars": 8,
  "timbre": "piano",
  "adsr": { "attack": 0.01, "decay": 0.8, "sustain": 0.4, "release": 0.9 },
  "volume": 0.8,
  "loop": { "on": true, "start": 0, "end": 15 },
  "notes": [[35, 0], [35, 4], [35, 8], [35, 12]]
}
```

- `notes` is a compact array of `[row, col]` pairs for active cells
- Row 0 = highest note (B6), last row = lowest note (C2)

## How It Works

- **Audio** – Uses `OscillatorNode` and `GainNode` from the Web Audio API. Each note's amplitude is shaped by an ADSR envelope. Additive synthesis timbres are built from harmonic arrays.
- **Sequencer** – A lookahead scheduler (`setInterval` every 25ms) prepares notes to be played ~100ms ahead for stable, jitter-resistant timing.
- **Visualization** – The grid is drawn on an HTML5 Canvas with virtual scrolling (only visible cells are drawn). An offscreen cache stores the static layer for smooth 60 FPS scrolling. The playhead tracks the current step.
- **Export** – Renders in 8-bar segments using `OfflineAudioContext` with overlap-add to preserve reverb and release tails, then encodes with lamejs.
- **Interaction** – Mouse, touch, and keyboard events toggle grid cells and control transport functions.

## Add Your Own Timbre

1. Open `js/timbres.js`
2. Define a harmonics array: `const timbreMy = [1.0, 0.7, 0.5, ...];`
3. Add an entry to `TIMBRES` with a `family` field
4. The dropdown will automatically include it—no HTML changes needed

## Credits

- [lamejs](https://github.com/wingify/lamejs) – MP3 encoder (LGPL-3.0), used for offline MP3 export in `js/vendor/lame.min.js`
