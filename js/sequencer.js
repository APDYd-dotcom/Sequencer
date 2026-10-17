// sequencer.js - Handles the sequencer grid, scheduling, and playback
const state = {
  // Grid dimensions
  ROWS: 24,   // C4 to B5 (chromatic)
  COLS: 16,   // 16 steps
  ROW_HEIGHT: 20, // pixels per row (logical, not device pixels)

  // Header layout
  LOOP_BAR_H: 12,
  RULER_H: 22,
  HEADER_H: 34, // LOOP_BAR_H + RULER_H

  // Grid state: true if cell is active
  grid: [],

  // Note information for each row (from high to low: B5 down to C4)
  noteNames: [],
  frequencies: [],
  isBlackKey: [],

  // Playback / transport state
  isPlaying: false,
  playStep: 0,      // playhead position (step being heard / where playback starts)
  startStep: 0,     // start marker; play starts here, Stop returns here
  bpm: 100,

  // Loop region
  loopOn: true,
  loopStart: 0,
  loopEnd: 15, // inclusive

  // Scheduling
  scheduleAheadTime: 0.1, // seconds
  schedulerInterval: null,
  lastNoteTime: 0,

  // Canvas
  canvas: null,
  ctx: null,
  logicalWidth: 0,
  logicalHeight: 0,
  cellWidth: 0,
  cellHeight: 20,

  // Colors for active cells (cycle through Google colors for rows)
  rowColors: ['#1a73e8', '#ea4335', '#fbbc04', '#34a853'],

  // Animation frame ID for playhead
  animationFrameId: null,

  // Pointer drag state
  drag: null,
};

// Initialize note arrays from MIDI 60 (C4) to 83 (B5)
// We'll store from highest to lowest so row 0 is B5, row 23 is C4.
function initNotes() {
  state.noteNames = [];
  state.frequencies = [];
  state.isBlackKey = [];

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  for (let midi = 83; midi >= 60; midi--) {
    const noteIndex = (midi - 60) % 12;
    const name = noteNames[noteIndex] + (4 + Math.floor((midi - 60) / 12));
    state.noteNames.push(name);

    // Frequency: 440 * 2^((midi-69)/12)
    state.frequencies.push(440 * Math.pow(2, (midi - 69) / 12));

    // Black key if note is C#, D#, F#, G#, A# (i.e., noteIndex in [1,3,6,8,10])
    state.isBlackKey.push([1, 3, 6, 8, 10].includes(noteIndex));
  }
}

// Initialize the sequencer canvas and set up event listeners
function initSequencer() {
  // Initialize note arrays
  initNotes();

  // Initialize grid to all false
  state.grid = Array.from({ length: state.ROWS }, () =>
    Array.from({ length: state.COLS }, () => false));

  state.canvas = document.getElementById('gridCanvas');
  if (!state.canvas) return;
  state.ctx = state.canvas.getContext('2d');
  resizeCanvas();
  drawGrid();

  // Set up pointer events
  state.canvas.addEventListener('pointerdown', handlePointerDown);
  state.canvas.addEventListener('pointermove', handlePointerMove);
  state.canvas.addEventListener('pointerup', handlePointerUp);
  state.canvas.addEventListener('pointercancel', handlePointerUp);
  state.canvas.addEventListener('pointerleave', handlePointerUp);

  // Drag state
  state.drag = null;
}

// Resize canvas to fit container and handle HiDPI
function resizeCanvas() {
  const container = document.querySelector('.grid-area');
  if (!container) return;

  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;

  // Total height = header (loop bar + ruler) + grid rows
  state.logicalHeight = state.HEADER_H + state.ROWS * state.ROW_HEIGHT;
  state.logicalWidth = containerWidth;

  // Set the canvas size in device pixels
  state.canvas.width = state.logicalWidth * window.devicePixelRatio;
  state.canvas.height = state.logicalHeight * window.devicePixelRatio;

  // Set the CSS size
  state.canvas.style.width = state.logicalWidth + 'px';
  state.canvas.style.height = state.logicalHeight + 'px';

  // Set the transform to scale by devicePixelRatio
  state.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

  // Recalculate cell dimensions (in logical pixels)
  state.cellWidth = state.logicalWidth / state.COLS;
  state.cellHeight = state.ROW_HEIGHT; // fixed

  drawGrid();

  // Also resize piano to match height
  if (window.resizePiano) {
    window.resizePiano();
  }
}

// Clamp a column index to 0..15 so drags still work off-canvas
function colFromX(x) {
  return Math.min(state.COLS - 1, Math.max(0, Math.floor(x / state.cellWidth)));
}

// Hit-test a point against canvas zones
function hitTest(x, y) {
  if (y < state.LOOP_BAR_H) return 'loopbar';
  if (y < state.HEADER_H) return 'ruler';
  return 'grid';
}

// Get pointer position relative to canvas
function getPointerPos(e) {
  const rect = state.canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

// Draw the entire grid (loop bar, ruler, grid cells, playhead)
function drawGrid() {
  const ctx = state.ctx;
  const width = state.logicalWidth;
  const height = state.logicalHeight;
  const cellWidth = state.cellWidth;
  const cellHeight = state.cellHeight;
  const headerH = state.HEADER_H;
  const gridH = state.ROWS * cellHeight;

  const loopStart = Math.max(0, Math.min(state.COLS - 1, state.loopStart));
  const loopEnd = Math.max(0, Math.min(state.COLS - 1, state.loopEnd));
  const loopLeft = loopStart * cellWidth;
  const loopRight = (loopEnd + 1) * cellWidth;
  const loopOn = state.loopOn;

  // Clear background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);

  // ---- LOOP BAR (top strip) ----
  ctx.fillStyle = '#e8eaed';
  ctx.fillRect(0, 0, width, state.LOOP_BAR_H);

  // Loop bar (rounded)
  const barRadius = 4;
  ctx.fillStyle = loopOn ? '#1a73e8' : '#bdc1c6';
  ctx.beginPath();
  ctx.moveTo(loopLeft + barRadius, 0);
  ctx.lineTo(loopRight - barRadius, 0);
  ctx.quadraticCurveTo(loopRight, 0, loopRight, barRadius);
  ctx.lineTo(loopRight, state.LOOP_BAR_H - barRadius);
  ctx.quadraticCurveTo(loopRight, state.LOOP_BAR_H, loopRight - barRadius, state.LOOP_BAR_H);
  ctx.lineTo(loopLeft + barRadius, state.LOOP_BAR_H);
  ctx.quadraticCurveTo(loopLeft, state.LOOP_BAR_H, loopLeft, state.LOOP_BAR_H - barRadius);
  ctx.lineTo(loopLeft, barRadius);
  ctx.quadraticCurveTo(loopLeft, 0, loopLeft + barRadius, 0);
  ctx.fill();

  // White grips at loop edges
  const gripW = 6;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(loopLeft - gripW / 2, 0, gripW, state.LOOP_BAR_H);
  ctx.fillRect(loopRight - gripW / 2, 0, gripW, state.LOOP_BAR_H);

  // LOOP label in the piano column area (left edge)
  ctx.fillStyle = loopOn ? '#1a73e8' : '#9aa0a6';
  ctx.font = 'bold 11px Roboto';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LOOP', 6, state.LOOP_BAR_H / 2);

  // ---- RULER ----
  const rulerY = state.LOOP_BAR_H;
  ctx.fillStyle = '#e8eaed';
  ctx.fillRect(0, rulerY, width, state.RULER_H);
  ctx.strokeStyle = '#dadce0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, rulerY + state.RULER_H);
  ctx.lineTo(width, rulerY + state.RULER_H);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rulerMid = rulerY + state.RULER_H / 2;
  const chipRadius = 7;
  for (let col = 0; col < state.COLS; col++) {
    const cx = col * cellWidth + cellWidth / 2;
    const isCurrent = col === state.playStep;
    if (isCurrent) {
      ctx.fillStyle = state.isPlaying ? '#1a73e8' : '#8ab4f8';
      ctx.beginPath();
      ctx.arc(cx, rulerMid, chipRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = state.isPlaying ? '#ffffff' : '#1a73e8';
    } else {
      ctx.fillStyle = '#5f6368';
    }
    ctx.font = '11px Roboto';
    ctx.fillText(String(col + 1), cx, rulerMid);
  }

  // Start marker: gray triangle flag under the startStep number
  const sx = state.startStep * cellWidth + cellWidth / 2;
  ctx.fillStyle = '#9aa0a6';
  ctx.beginPath();
  ctx.moveTo(sx, rulerY + state.RULER_H);
  ctx.lineTo(sx - 5, rulerY + state.RULER_H + 9);
  ctx.lineTo(sx + 5, rulerY + state.RULER_H + 9);
  ctx.fill();

  // ---- GRID ROW BACKGROUNDS ----
  for (let row = 0; row < state.ROWS; row++) {
    const y = headerH + row * cellHeight;
    if (state.isBlackKey[row]) {
      ctx.fillStyle = '#eceff1';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(0, y, width, cellHeight);
  }

  // ---- HORIZONTAL GRID LINES ----
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let row = 0; row <= state.ROWS; row++) {
    const y = headerH + row * cellHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // ---- VERTICAL GRID LINES ----
  for (let col = 0; col <= state.COLS; col++) {
    const x = col * cellWidth;
    if (col % 4 === 0) {
      ctx.strokeStyle = '#b0b0b0';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(x, headerH);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // ---- ACTIVE CELLS ----
  for (let row = 0; row < state.ROWS; row++) {
    const colorIndex = row % state.rowColors.length;
    ctx.fillStyle = state.rowColors[colorIndex];
    for (let col = 0; col < state.COLS; col++) {
      if (state.grid[row][col]) {
        const x = col * cellWidth;
        const y = headerH + row * cellHeight;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
    }
  }

  // ---- LOOP DIM OUTSIDE LOOP + BORDER LINES ----
  if (loopOn && !(loopStart === 0 && loopEnd === state.COLS - 1)) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    if (loopStart > 0) {
      ctx.fillRect(0, headerH, loopLeft, gridH);
    }
    if (loopEnd < state.COLS - 1) {
      ctx.fillRect(loopRight, headerH, width - loopRight, gridH);
    }
    // 2 px blue vertical lines on loop borders
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 2;
    if (loopStart > 0) {
      ctx.beginPath();
      ctx.moveTo(loopLeft, headerH);
      ctx.lineTo(loopLeft, height);
      ctx.stroke();
    }
    if (loopEnd < state.COLS - 1) {
      ctx.beginPath();
      ctx.moveTo(loopRight, headerH);
      ctx.lineTo(loopRight, height);
      ctx.stroke();
    }
  }

  // ---- PLAYHEAD (tinted column + 2 px needle) ----
  let playheadStep = state.playStep;
  if (state.isPlaying) {
    const secondsPerBeat = 60.0 / state.bpm;
    const stepTime = secondsPerBeat / 4;
    const stepsSinceRef = (audioContext.currentTime - state.lastNoteTime) / stepTime;
    const loopLength = loopEnd - loopStart + 1;
    playheadStep =
      loopStart +
      ((state.playStep + stepsSinceRef - loopStart) % loopLength + loopLength) %
        loopLength;
  }
  const px = playheadStep * cellWidth;
  ctx.fillStyle = state.isPlaying
    ? 'rgba(26, 115, 232, 0.18)'
    : 'rgba(138, 180, 248, 0.08)';
  ctx.fillRect(px, 0, cellWidth, height);
  // 2 px needle at the left edge of the column
  ctx.fillStyle = '#1a73e8';
  ctx.fillRect(px, 0, 2, height);
}

// Toggle a cell at canvas coordinates (x, y)
function toggleCell(x, y) {
  const col = Math.floor(x / state.cellWidth);
  const row = Math.floor((y - state.HEADER_H) / state.cellHeight);
  if (row >= 0 && row < state.ROWS && col >= 0 && col < state.COLS) {
    state.grid[row][col] = !state.grid[row][col];
    drawGrid();
  }
}

// Pointer down
function handlePointerDown(e) {
  e.preventDefault();
  const pos = getPointerPos(e);
  const zone = hitTest(pos.x, pos.y);
  const col = colFromX(pos.x);

  const loopStart = Math.max(0, Math.min(state.COLS - 1, state.loopStart));
  const loopEnd = Math.max(0, Math.min(state.COLS - 1, state.loopEnd));
  const loopLeft = loopStart * state.cellWidth;
  const loopRight = (loopEnd + 1) * state.cellWidth;
  const loopWidth = loopRight - loopLeft;
  const edgeThresh = loopWidth < 16 ? loopWidth / 3 : 8;

  let subZone = null;
  if (zone === 'loopbar') {
    const nearLeft = Math.abs(pos.x - loopLeft) <= edgeThresh;
    const nearRight = Math.abs(pos.x - loopRight) <= edgeThresh;
    const inside = pos.x > loopLeft && pos.x < loopRight;
    if (nearLeft) subZone = 'loopL';
    else if (nearRight) subZone = 'loopR';
    else if (inside) subZone = 'loopMove';
    else subZone = 'loopNew';
  }

  state.drag = {
    zone,
    subZone,
    startX: pos.x,
    startY: pos.y,
    col,
    loopStart,
    loopEnd,
    playStep: state.playStep,
    moved: false,
  };

  if (zone === 'ruler') {
    // Seek: set start marker AND move playhead to this step
    state.startStep = col;
    state.playStep = col;
    drawGrid();
  } else if (zone === 'grid') {
    toggleCell(pos.x, pos.y);
  }
  // loopbar zones are resolved on move / up

  try {
    state.canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    // pointer capture not supported
  }
}

// Pointer move
function handlePointerMove(e) {
  if (!state.drag) return;
  e.preventDefault();
  const pos = getPointerPos(e);
  const d = state.drag;
  d.moved = d.moved || Math.abs(pos.x - d.startX) > 2 || Math.abs(pos.y - d.startY) > 2;
  const col = colFromX(pos.x);

  if (d.zone === 'ruler') {
    // Scrub playhead (works while playing)
    state.startStep = col;
    state.playStep = col;
    drawGrid();
  } else if (d.zone === 'loopbar') {
    if (d.subZone === 'loopL') {
      let ns = col;
      if (ns > d.loopEnd) ns = d.loopEnd; // never let start pass end
      state.loopStart = ns;
    } else if (d.subZone === 'loopR') {
      let ne = col;
      if (ne < d.loopStart) ne = d.loopStart;
      state.loopEnd = ne;
    } else if (d.subZone === 'loopMove') {
      const loopLen = d.loopEnd - d.loopStart;
      let ns = d.loopStart + (col - d.col);
      ns = Math.max(0, Math.min(state.COLS - 1 - loopLen, ns));
      state.loopStart = ns;
      state.loopEnd = ns + loopLen;
    } else if (d.subZone === 'loopNew') {
      state.loopStart = Math.min(d.col, col);
      state.loopEnd = Math.max(d.col, col);
    }
    drawGrid();
  } else if (d.zone === 'grid') {
    toggleCell(pos.x, pos.y);
  }
}

// Pointer up / cancel
function handlePointerUp(e) {
  if (!state.drag) return;
  const d = state.drag;
  try {
    state.canvas.releasePointerCapture(e.pointerId);
  } catch (err) {
    // pointer capture not supported
  }

  if (d.zone === 'loopbar' && d.subZone === 'loopNew' && !d.moved) {
    // Click without moving on the loop bar toggles the loop on/off
    state.loopOn = !state.loopOn;
  }

  state.drag = null;
  drawGrid();
}

// Start the sequencer
function startSequencer() {
  if (state.isPlaying) return;
  state.isPlaying = true;
  // Play starts from the start marker
  state.playStep = state.startStep;
  state.lastNoteTime = audioContext.currentTime;
  // Start the scheduler
  state.schedulerInterval = setInterval(scheduler, 25); // check every 25 ms
  // Start animation loop for playhead
  animatePlayhead();
}

// Stop the sequencer (returns to start marker)
function stopSequencer() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  state.playStep = state.startStep;
  clearInterval(state.schedulerInterval);
  state.schedulerInterval = null;
  // Cancel animation frame
  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  drawGrid();
}

// Toggle play/stop
function togglePlay() {
  if (state.isPlaying) {
    stopSequencer();
  } else {
    startSequencer();
  }
}

// Set BPM
function setBpm(bpm) {
  state.bpm = bpm;
}

// Clear the grid
function clearGrid() {
  state.grid = Array.from({ length: state.ROWS }, () =>
    Array.from({ length: state.COLS }, () => false));
  drawGrid();
}

// Generate a random pattern (about 10% chance per cell)
function randomPattern() {
  state.grid = Array.from({ length: state.ROWS }, () =>
    Array.from({ length: state.COLS }, () => Math.random() > 0.9));
  drawGrid();
}

// The scheduler: called periodically to check if we need to play notes
function scheduler() {
  const currentTime = audioContext.currentTime;
  const lookahead = state.scheduleAheadTime; // how far ahead to schedule
  // While there are notes that need to be played ahead of time
  while (state.lastNoteTime < currentTime + lookahead) {
    const secondsPerBeat = 60.0 / state.bpm;
    const stepTime = secondsPerBeat / 4; // each step is a 16th note

    // Play notes for the current step
    for (let row = 0; row < state.ROWS; row++) {
      if (state.grid[row][state.playStep]) {
        const frequency = state.frequencies[row];
        // Envelope parameters from envelope.js
        const env = {
          attack: parseFloat(document.getElementById('attackSlider').value),
          decay: parseFloat(document.getElementById('decaySlider').value),
          sustain: parseFloat(document.getElementById('sustainSlider').value),
          release: parseFloat(document.getElementById('releaseSlider').value),
        };
        // The note duration is stepTime (the length of a step)
        playNote(
          frequency,
          state.lastNoteTime,
          stepTime,
          document.getElementById('waveformSelect').value,
          env
        );

        // Flash the piano key for this note
        const delayMs = (state.lastNoteTime - audioContext.currentTime) * 1000;
        const durationMs = stepTime * 1000;
        flashPianoKey(row, delayMs, durationMs);
      }
    }

    // Advance the step and time (wrap within the loop region)
    state.lastNoteTime += stepTime;
    if (state.playStep >= state.loopEnd) {
      state.playStep = state.loopStart;
    } else {
      state.playStep++;
    }
  }
}

// Animation loop for smooth playhead movement
function animatePlayhead() {
  if (!state.isPlaying) return;

  drawGrid();

  // Request next frame
  state.animationFrameId = requestAnimationFrame(animatePlayhead);
}

// Expose functions for main.js and piano.js
window.initSequencer = initSequencer;
window.resizeCanvas = resizeCanvas;
window.drawGrid = drawGrid;
window.startSequencer = startSequencer;
window.stopSequencer = stopSequencer;
window.togglePlay = togglePlay;
window.setBpm = setBpm;
window.clearGrid = clearGrid;
window.randomPattern = randomPattern;
window.state = state; // for debugging
window.colFromX = colFromX;
window.hitTest = hitTest;

// Initialize notes on load
initNotes();
