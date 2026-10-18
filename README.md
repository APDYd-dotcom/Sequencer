# Sequencer

A browser-based music sequencer built with vanilla HTML, CSS, and JavaScript. Uses the Web Audio API for sound generation and HTML5 Canvas for the interface. Features virtual scrolling for long timelines, wide pitch range, song tools, save/load, undo/redo, and MP3 export.

## Features

- **Long timeline**: Virtual scrolling with zoom (12-64px cell width), up to 128 bars (2048 steps). Canvas stays viewport-sized; native scrollbars handle navigation.
- **Wide pitch range**: 60 rows (5 octaves, C2-B6, MIDI 36-95). Octave labels on C keys.
- **Zoom & scroll**: Zoom buttons (+/-) and Ctrl/Cmd + mouse wheel. Scroll with mouse wheel (vertical) or Shift+wheel (horizontal). Touch: one-finger drag scrolls, tap toggles cell.
- **Follow playhead**: Auto-scrolls to keep the playhead visible while playing (page flip at 80%).
- **Position readout**: "Bar N - Beat M   t/total" in the transport.
- **Adjustable tempo** (BPM 60-180).
- **Timbre selection** with 20+ synthesized instruments generated from code.
- **ADSR envelope controls** (Attack, Decay, Sustain, Release) with live visualization.
- **Master volume control**.
- **Visual playhead** indicating current step (tinted column + needle + bar.beat chip).
- **Loop region**: Drag the loop bar to set start/end; click to toggle on/off; resize edges; drag to move.
- **Start marker**: Click the ruler to set where playback starts and stops.
- **Click/drag to toggle steps** on/off (paint bug fixed: no flicker while dragging).
- **Keyboard input**: Computer keys play notes and toggle cells. Z/X shift keyboard octave.
- **Song tools**: Bars control (+/-), Duplicate Bar, Clear Bar, Copy Bar, Paste Bar. Overview strip shows whole-song density with viewport and playhead.
- **Save/Open**: Download .json song files, open saved files. Autosave to localStorage.
- **Undo/Redo**: Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y (max 50 snapshots).
- **Export**: Download the song as MP3 (or WAV fallback) rendered offline with segment-based rendering for long songs. Choose whole song or loop region, repeat count (1/2/4/8), and quality (128/192/320 kbps).
- **Responsive design** with Material-inspired Google design.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Space | Play / Stop |
| C | Clear grid |
| Z | Shift keyboard octave down |
| X | Shift keyboard octave up |
| Ctrl/Cmd + D | Duplicate current bar |
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y | Redo |
| Home | Go to start of song |
| End | Go to end of song |
| A-S-D-F-G-H-J-K-L-;-Q-W-E-R | Play white keys (C4-B5) |
| Z-X-C-V-B-N-M-,-. / | Play black keys (sharps) |

## How to Run

1. Open `index.html` in a web browser (Chrome, Firefox, Safari, Edge).
2. Click anywhere on the page to enable audio (required by browser autoplay policies).
3. Click on the grid to place notes, or press computer keys to play and record.
4. Click **Export** in the transport toolbar to open the export dialog and download your song.

## File Structure

- `index.html` - Main HTML structure
- `style.css` - Styling (Material-inspired design)
- `js/timbres.js` - Additive synthesis timbres (arrays of harmonics + TIMBRES table)
- `js/audio.js` - Web Audio API setup, makeAdditiveInstrument(), INSTRUMENTS object, playNote(), master gain, output chain (compressor + limiter), reverb.
- `js/envelope.js` - ADSR envelope parameters and visualization
- `js/piano.js` - Piano keyboard drawing and interaction
- `js/sequencer.js` - Grid state, scheduling, canvas drawing, virtual scrolling, undo/redo, song tools
- `js/export.js` - Offline audio rendering and MP3/WAV export (segment-based)
- `js/vendor/lame.min.js` - lamejs MP3 encoder (LGPL-3.0)
- `js/vendor/LICENSE-lamejs.txt` - lamejs license
- `README.md` - This file

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
  "notes": [[35, 0], [35, 4], [35, 8], [35, 12], ...]
}
```

- `notes` is a compact list of `[row, col]` pairs for active cells.
- Row 0 = highest note (B6), last row = lowest note (C2).

## How It Works

- **Audio**: Uses `OscillatorNode` and `GainNode` from the Web Audio API. Each note's amplitude is shaped by an ADSR envelope. Additive synthesis timbres are built from harmonics arrays.
- **Sequencer**: A lookahead scheduler (`setInterval` every 25ms) prepares notes to be played ~100ms ahead for stable timing.
- **Visualization**: The grid is drawn on an HTML5 Canvas with virtual scrolling (only visible cells drawn). An offscreen cache stores the static layer for smooth 60 fps scrolling. The playhead moves with the current step.
- **Export**: Renders in 8-bar segments using OfflineAudioContext with overlap-add for seamless reverb/release tails, then encodes with lamejs.
- **Interaction**: Mouse, touch, and keyboard events toggle grid cells and control transport.

## Add Your Own Timbre

1. Open `js/timbres.js`.
2. Write a harmonics array: `const timbreMy = [1.0, 0.7, 0.5, ...];`
3. Add a TIMBRES entry with a `family` field.
4. The menu will automatically include it—no HTML edit needed.

## Credits

- [lamejs](https://github.com/wingify/lamejs) - MP3 encoder (LGPL-3.0), used for offline MP3 export in `js/vendor/lame.min.js`.
