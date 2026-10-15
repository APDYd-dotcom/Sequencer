# Sequencer

A simple browser-based music sequencer built with vanilla HTML, CSS, and JavaScript. Uses the Web Audio API for sound generation and HTML5 Canvas for the interface.

## Features

- 16-step sequencer grid (8 notes × 16 steps)
- C major pentatonic scale over 2 octaves
- Adjustable tempo (BPM 60-180)
- Waveform selection (sine, square, sawtooth, triangle)
- ADSR envelope controls (Attack, Decay, Sustain, Release)
- Master volume control
- Visual playhead indicating current step
- Click/drag to toggle steps on/off
- Play/Stop, Clear, and Random pattern buttons
- Keyboard shortcuts: Space (play/stop), C (clear)
- Responsive design
- Material-inspired Google design

## How to Run

1. Open `index.html` in a web browser (Chrome, Firefox, Safari, Edge).
2. Click anywhere on the page to enable audio (required by browser autoplay policies).
3. Use the Play button to start the sequencer.
4. Click on the grid to activate/deactivate steps.
5. Adjust BPM, waveform, volume, and ADSR envelopes to shape the sound.

## File Structure

- `index.html` - Main HTML structure
- `style.css` - Styling (Material-inspired design)
- `js/audio.js` - Web Audio API setup and note playback
- `js/envelope.js` - ADSR envelope parameters and visualization
- `js/sequencer.js` - Grid state, scheduling, and canvas drawing
- `js/main.js` - UI wiring, event listeners, and initialization

## How It Works

- **Audio**: Uses `OscillatorNode` and `GainNode` from the Web Audio API. Each note's amplitude is shaped by an ADSR envelope.
- **Sequencer**: A lookahead scheduler (`setInterval` every 25ms) prepares notes to be played ~100ms ahead for stable timing.
- **Visualization**: The grid is drawn on an HTML5 Canvas. The playhead moves with the current step. The ADSR envelope is visualized on a second canvas.
- **Interaction**: Mouse and touch events toggle grid cells. UI controls update audio parameters in real time.

## Next Steps (Ideas for Extension)

1. **Multiple Tracks**: Add support for multiple independent sequencer tracks (e.g., drums, bass, melody).
2. **Save/Load Patterns**: Allow users to save their patterns to localStorage and load them later.
3. **Swing/Shuffle**: Add a swing parameter to offset every other step for a groove feel.
4. **Effects**: Add simple audio effects like delay or reverb using Web Audio API nodes.
5. **MIDI Input**: Connect to MIDI controllers for note input or parameter control.
6. **Song Mode**: Chain multiple patterns together to create a full song arrangement.

## Credits

Built as a university multimedia programming course assignment. Inspired by classic step sequencers and modern web-based music tools.