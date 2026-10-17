# Sequencer

A simple browser-based music sequencer built with vanilla HTML, CSS, and JavaScript. Uses the Web Audio API for sound generation and HTML5 Canvas for the interface.

## Features

- 16-step sequencer grid (8 notes × 16 steps) with 24-row chromatic piano roll (C4 to B5).
- C major pentatonic scale over 2 octaves.
- Adjustable tempo (BPM 60-180).
- **Timbre selection** with 20+ synthesized instruments generated from code:
  - Strings: Violin, Cello
  - Plucked: Guitar, Harpsichord, Harp, Bass
  - Woodwinds: Oboe, Bassoon, Saxophone
  - Brass: Trombone, French Horn
  - Reeds & Voices: Accordion, Harmonica, Choir
  - Mallets: Vibraphone, Celesta, Marimba
  - Keyboards: Piano, Electric Piano
  - Synth: Synth Lead, Synth Saw, Synth Pad
- **ADSR envelope controls** (Attack, Decay, Sustain, Release) with live visualization.
- Master volume control.
- Visual playhead indicating current step.
- Click/drag to toggle steps on/off.
- Play/Stop, Clear, and Random pattern buttons.
- Keyboard shortcuts: Space (play/stop), C (clear), and mapped keys for note input (A-S-D-F-G-H-J-K-L-;-Q-W-E-R).
- Responsive design.
- Material-inspired Google design.

## How to Run

1. Open `index.html` in a web browser (Chrome, Firefox, Safari, Edge).
2. Click anywhere on the page to enable audio (required by browser autoplay policies).
3. Use the Play button to start the sequencer.
4. Click on the grid to activate/deactivate steps.
5. Adjust BPM, timbre, volume, and ADSR envelopes to shape the sound.

## File Structure

- `index.html` - Main HTML structure
- `style.css` - Styling (Material-inspired design)
- `js/timbres.js` - Additive synthesis timbres (arrays of harmonics + TIMBRES table)
- `js/audio.js` - Web Audio API setup, makeAdditiveInstrument(), INSTRUMENTS object, playNote(), master gain, output chain (compressor + limiter), reverb.
- `js/envelope.js` - ADSR envelope parameters and visualization
- `js/piano.js` - Piano keyboard drawing and interaction
- `js/sequencer.js` - Grid state, scheduling, and canvas drawing
- `js/main.js` - UI wiring, event listeners, and initialization
- `README.md` - This file

## How It Works

- **Audio**: Uses `OscillatorNode` and `GainNode` from the Web Audio API. Each note's amplitude is shaped by an ADSR envelope. Additive synthesis timbres are built from harmonics arrays.
- **Sequencer**: A lookahead scheduler (`setInterval` every 25ms) prepares notes to be played ~100ms ahead for stable timing.
- **Visualization**: The grid is drawn on an HTML5 Canvas. The playhead moves with the current step. The ADSR envelope is visualized on a second canvas.
- **Interaction**: Mouse and touch events toggle grid cells. UI controls update audio parameters in real time. Computer keyboard keys play notes and toggle grid cells.

## Add Your Own Timbre

1. Open `js/timbres.js`.
2. Write a harmonics array: `const timbreMy = [1.0, 0.7, 0.5, ...];`
3. Add a TIMBRES entry with a `family` field (e.g., `myTimbre: { family: 'Strings', harmonics: timbreMy, ... }`).
4. The menu will automatically include it—no HTML edit needed.

## Next Steps (Ideas for Extension)

1. **Multiple Tracks**: Add support for multiple independent sequencer tracks (e.g., drums, bass, melody).
2. **Save/Load Patterns**: Allow users to save their patterns to localStorage and load them later.
3. **Swing/Shuffle**: Add a swing parameter to offset every other step for a groove feel.
4. **Effects**: Add simple audio effects like delay or reverb using Web Audio API nodes.
5. **MIDI Input**: Connect to MIDI controllers for note input or parameter control.
6. **Song Mode**: Chain multiple patterns together to create a full song arrangement.