// sequencer.js - Handles the sequencer grid, scheduling, and playback
const state = {
  // Grid dimensions
  STEPS_PER_BAR: 16,   // 16th notes per bar (4/4)
  bars: 8,             // number of bars (min 1, max 128)
  COLS: 0,             // computed = bars * STEPS_PER_BAR, set in init
  ROWS: 60,            // C2 to B6 (five octaves, MIDI 36-95)
  ROW_HEIGHT: 20,      // pixels per row (logical, not device pixels)

  // Zoom / scroll state
  zoom: 28,            // cell width in px (range 12-64)
  scrollX: 0,
  scrollY: 0,
  follow: true,        // follow playhead while playing

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
  exporting: false, // set while exporting to lock playback
  bpm: 100,

  // Loop region
  loopOn: true,
  loopStart: 0,
  loopEnd: 127, // inclusive, will be clamped to COLS-1 on init

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

  // Offscreen cache for static layer
  cacheCanvas: null,
  cacheCtx: null,
  cacheDirty: true,

  // Colors for active cells (cycle through Google colors for rows)
  rowColors: ['#1a73e8', '#ea4335', '#fbbc04', '#34a853'],

  // Animation frame ID for playhead
  animationFrameId: null,

  // Pointer drag state
  drag: null,

  // Paint state (fix flicker bug)
  paintValue: null,
};

// Initialize note arrays from MIDI 36 (C2) to 95 (B6)
// We'll store from highest to lowest so row 0 is B6, last row = C2.
function initNotes() {
  state.noteNames = [];
  state.frequencies = [];
  state.isBlackKey = [];

  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const minMidi = 36; // C2
  const maxMidi = 95; // B6

  for (let midi = maxMidi; midi >= minMidi; midi--) {
    const noteIndex = (midi - minMidi) % 12;
    const octave = 2 + Math.floor((midi - minMidi) / 12);
    const name = noteNames[noteIndex] + octave;
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

  // Compute COLS from bars
  state.COLS = state.bars * state.STEPS_PER_BAR;

  // Clamp loopEnd to COLS-1
  state.loopEnd = Math.min(state.loopEnd, state.COLS - 1);
  state.loopStart = Math.min(state.loopStart, state.COLS - 1);

  // Initialize grid to all false
  state.grid = Array.from({ length: state.ROWS }, () =>
    Array.from({ length: state.COLS }, () => false));

  state.canvas = document.getElementById('gridCanvas');
  if (!state.canvas) return;
  state.ctx = state.canvas.getContext('2d');
  resizeCanvas();
  drawGrid();

  // On load, scroll so that C4-B5 (the old range) is visible
  // row 0 = MIDI 95 (B6); C4 = MIDI 60 -> row 35; B5 = MIDI 83 -> row 12
  const c4Row = 35;
  const c4Y = c4Row * state.ROW_HEIGHT;
  const scroller = document.getElementById('gridScroller');
  if (scroller) {
    scroller.scrollTop = Math.max(0, c4Y - scroller.clientHeight / 2);
    state.scrollY = scroller.scrollTop;
  }

  // Set up pointer events
  state.canvas.addEventListener('pointerdown', handlePointerDown);
  state.canvas.addEventListener('pointermove', handlePointerMove);
  state.canvas.addEventListener('pointerup', handlePointerUp);
  state.canvas.addEventListener('pointercancel', handlePointerUp);
  state.canvas.addEventListener('pointerleave', handlePointerUp);

  // Drag state
  state.drag = null;
}

// Resize canvas to fit viewport and handle HiDPI
function resizeCanvas() {
  const scroller = document.getElementById('gridScroller');
  const gridArea = document.querySelector('.grid-area');
  const pianoCanvas = document.getElementById('pianoCanvas');
  const spacer = document.querySelector('.gridSpacer');
  if (!scroller || !gridArea) return;

  // Viewport size (inside the scroller)
  const vw = scroller.clientWidth;
  const vh = scroller.clientHeight;

  // Full song size
  const fullWidth = state.COLS * state.cellWidth;
  const fullHeight = state.HEADER_H + state.ROWS * state.ROW_HEIGHT;

  // Set spacer size (defines scrollable area)
  if (spacer) {
    spacer.style.width = fullWidth + 'px';
    spacer.style.height = fullHeight + 'px';
  }

  // Set grid area size (viewport)
  gridArea.style.left = '72px';
  gridArea.style.top = '0';
  gridArea.style.width = (vw - 72) + 'px';
  gridArea.style.height = vh + 'px';

  // Set canvas size in device pixels (viewport-sized)
  state.canvas.width = (vw - 72) * window.devicePixelRatio;
  state.canvas.height = vh * window.devicePixelRatio;

  // Set CSS size
  state.canvas.style.width = (vw - 72) + 'px';
  state.canvas.style.height = vh + 'px';

  // Set the transform to scale by devicePixelRatio
  state.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

  // Recalculate cell dimensions (in logical pixels) - cellWidth comes from zoom
  state.cellWidth = state.zoom;
  state.cellHeight = state.ROW_HEIGHT; // fixed

  // Set up offscreen cache
  setupCache();

  // Set piano size
  if (pianoCanvas) {
    pianoCanvas.style.width = '72px';
    pianoCanvas.style.height = vh + 'px';
    pianoCanvas.width = 72 * window.devicePixelRatio;
    pianoCanvas.height = vh * window.devicePixelRatio;
    pianoCanvas.getContext('2d').setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    if (window.resizePiano) window.resizePiano();
  }

  drawGrid();

  // Set up scroll listener
  scroller.removeEventListener('scroll', handleScrollerScroll);
  scroller.addEventListener('scroll', handleScrollerScroll);
}

// Set up offscreen cache for static layer
function setupCache() {
  const scroller = document.getElementById('gridScroller');
  if (!scroller) return;
  const vw = scroller.clientWidth - 72;
  const vh = scroller.clientHeight;

  state.cacheCanvas = document.createElement('canvas');
  state.cacheCanvas.width = vw * window.devicePixelRatio;
  state.cacheCanvas.height = vh * window.devicePixelRatio;
  state.cacheCtx = state.cacheCanvas.getContext('2d');
  state.cacheCtx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  state.cacheDirty = true;
}

// Scroll handler for the scroller
function handleScrollerScroll(e) {
  const scroller = e.target;
  state.scrollX = scroller.scrollLeft;
  state.scrollY = scroller.scrollTop;
  drawGrid();
}

// Clamp a column index to 0..COLS-1 so drags still work off-canvas
function colFromX(x) {
  return Math.min(state.COLS - 1, Math.max(0, Math.floor((x + state.scrollX) / state.cellWidth)));
}

// Row from Y with scroll offset
function rowFromY(y) {
  return Math.min(state.ROWS - 1, Math.max(0, Math.floor((y + state.scrollY) / state.cellHeight)));
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
  const scroller = document.getElementById('gridScroller');
  if (!scroller || !state.canvas) return;

  const vw = scroller.clientWidth - 72; // viewport width for grid area
  const vh = scroller.clientHeight;
  const cellWidth = state.cellWidth;
  const cellHeight = state.cellHeight;
  const headerH = state.HEADER_H;

  const scrollX = state.scrollX;
  const scrollY = state.scrollY;

  // Compute visible range
  const firstCol = Math.floor(scrollX / cellWidth);
  const lastCol = Math.min(state.COLS - 1, Math.ceil((scrollX + vw) / cellWidth));
  const firstRow = Math.floor(scrollY / cellHeight);
  const lastRow = Math.min(state.ROWS - 1, Math.ceil((scrollY + vh - headerH) / cellHeight));

  const loopStart = Math.max(0, Math.min(state.COLS - 1, state.loopStart));
  const loopEnd = Math.max(0, Math.min(state.COLS - 1, state.loopEnd));
  const loopOn = state.loopOn;

  // Clear background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, vw, vh);

  // ---- Draw static layer to cache if dirty ----
  if (state.cacheDirty) {
    const cctx = state.cacheCtx;
    const cw = vw;
    const ch = vh;
    cctx.clearRect(0, 0, cw, ch);

    // Loop bar (top strip) - drawn in cache since it scrolls horizontally but stays at top
    cctx.fillStyle = '#e8eaed';
    cctx.fillRect(0, 0, cw, state.LOOP_BAR_H);

    const barRadius = 4;
    const loopLeft = loopStart * cellWidth - scrollX;
    const loopRight = (loopEnd + 1) * cellWidth - scrollX;
    cctx.fillStyle = loopOn ? '#1a73e8' : '#bdc1c6';
    cctx.beginPath();
    cctx.moveTo(loopLeft + barRadius, 0);
    cctx.lineTo(loopRight - barRadius, 0);
    cctx.quadraticCurveTo(loopRight, 0, loopRight, barRadius);
    cctx.lineTo(loopRight, state.LOOP_BAR_H - barRadius);
    cctx.quadraticCurveTo(loopRight, state.LOOP_BAR_H, loopRight - barRadius, state.LOOP_BAR_H);
    cctx.lineTo(loopLeft + barRadius, state.LOOP_BAR_H);
    cctx.quadraticCurveTo(loopLeft, state.LOOP_BAR_H, loopLeft, state.LOOP_BAR_H - barRadius);
    cctx.lineTo(loopLeft, barRadius);
    cctx.quadraticCurveTo(loopLeft, 0, loopLeft + barRadius, 0);
    cctx.fill();

    // White grips at loop edges
    const gripW = 6;
    cctx.fillStyle = '#ffffff';
    cctx.fillRect(loopLeft - gripW / 2, 0, gripW, state.LOOP_BAR_H);
    cctx.fillRect(loopRight - gripW / 2, 0, gripW, state.LOOP_BAR_H);

    // LOOP label
    cctx.fillStyle = loopOn ? '#1a73e8' : '#9aa0a6';
    cctx.font = 'bold 11px Roboto';
    cctx.textAlign = 'left';
    cctx.textBaseline = 'middle';
    cctx.fillText('LOOP', 6, state.LOOP_BAR_H / 2);

    // ---- RULER ----
    const rulerY = state.LOOP_BAR_H;
    cctx.fillStyle = '#e8eaed';
    cctx.fillRect(0, rulerY, cw, state.RULER_H);
    cctx.strokeStyle = '#dadce0';
    cctx.lineWidth = 1;
    cctx.beginPath();
    cctx.moveTo(0, rulerY + state.RULER_H);
    cctx.lineTo(cw, rulerY + state.RULER_H);
    cctx.stroke();

    cctx.textAlign = 'center';
    cctx.textBaseline = 'middle';
    const rulerMid = rulerY + state.RULER_H / 2;

    for (let col = firstCol; col <= lastCol; col++) {
      const cx = col * cellWidth - scrollX + cellWidth / 2;
      const isBarStart = col % state.STEPS_PER_BAR === 0;
      const isBeat = col % 4 === 0;

      // Draw tick marks above the number
      if (isBarStart) {
        cctx.strokeStyle = '#1a73e8';
        cctx.lineWidth = 2;
        cctx.beginPath();
        cctx.moveTo(col * cellWidth - scrollX, rulerY);
        cctx.lineTo(col * cellWidth - scrollX, rulerY + state.RULER_H);
        cctx.stroke();
        // Bar number
        cctx.fillStyle = '#1a73e8';
        cctx.font = 'bold 11px Roboto';
        cctx.fillText(Math.floor(col / state.STEPS_PER_BAR) + 1, cx, rulerMid);
      } else if (isBeat) {
        cctx.strokeStyle = '#b0b0b0';
        cctx.lineWidth = 1;
        cctx.beginPath();
        cctx.moveTo(col * cellWidth - scrollX, rulerY + 4);
        cctx.lineTo(col * cellWidth - scrollX, rulerY + state.RULER_H);
        cctx.stroke();
        // Beat number (small)
        cctx.fillStyle = '#5f6368';
        cctx.font = '10px Roboto';
        cctx.fillText((col % state.STEPS_PER_BAR) / 4 + 1, cx, rulerMid);
      } else if (cellWidth >= 24) {
        cctx.strokeStyle = '#e0e0e0';
        cctx.lineWidth = 1;
        cctx.beginPath();
        cctx.moveTo(col * cellWidth - scrollX, rulerY + 8);
        cctx.lineTo(col * cellWidth - scrollX, rulerY + state.RULER_H);
        cctx.stroke();
      }
    }

    // Start marker: gray triangle flag under the startStep number
    const sx = state.startStep * cellWidth - scrollX + cellWidth / 2;
    if (sx >= 0 && sx <= vw) {
      cctx.fillStyle = '#9aa0a6';
      cctx.beginPath();
      cctx.moveTo(sx, rulerY + state.RULER_H);
      cctx.lineTo(sx - 5, rulerY + state.RULER_H + 9);
      cctx.lineTo(sx + 5, rulerY + state.RULER_H + 9);
      cctx.fill();
    }

    state.cacheDirty = false;
  }

  // Draw cached static layer
  ctx.drawImage(state.cacheCanvas, 0, 0);

  // ---- GRID ROW BACKGROUNDS (visible rows only) ----
  for (let row = firstRow; row <= lastRow; row++) {
    const y = headerH + row * cellHeight - scrollY;
    if (state.isBlackKey[row]) {
      ctx.fillStyle = '#eceff1';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(0, y, vw, cellHeight);
  }

  // ---- HORIZONTAL GRID LINES (visible rows) ----
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  for (let row = firstRow; row <= lastRow + 1; row++) {
    const y = headerH + row * cellHeight - scrollY;
    if (y < 0 || y > vh) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(vw, y);
    ctx.stroke();
  }

  // ---- VERTICAL GRID LINES (visible columns) ----
  for (let col = firstCol; col <= lastCol + 1; col++) {
    const x = col * cellWidth - scrollX;
    if (x < 0 || x > vw) continue;
    const isBarStart = col % state.STEPS_PER_BAR === 0;
    if (isBarStart) {
      ctx.strokeStyle = '#b0b0b0';
      ctx.lineWidth = 2;
    } else if (col % 4 === 0) {
      ctx.strokeStyle = '#b0b0b0';
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.moveTo(x, headerH);
    ctx.lineTo(x, vh);
    ctx.stroke();
  }

  // ---- Alternate bar shading ----
  if (cellWidth >= 16) {
    for (let bar = Math.floor(firstCol / state.STEPS_PER_BAR); bar <= Math.ceil(lastCol / state.STEPS_PER_BAR); bar++) {
      const barStart = bar * state.STEPS_PER_BAR;
      const barEnd = Math.min((bar + 1) * state.STEPS_PER_BAR - 1, state.COLS - 1);
      if (bar % 2 === 1) {
        const bx = barStart * cellWidth - scrollX;
        const bw = (barEnd - barStart + 1) * cellWidth;
        if (bx < vw && bx + bw > 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
          ctx.fillRect(Math.max(0, bx), headerH, Math.min(vw, bx + bw) - Math.max(0, bx), (lastRow - firstRow + 1) * cellHeight);
        }
      }
    }
  }

  // ---- ACTIVE CELLS (visible range only) ----
  for (let row = firstRow; row <= lastRow; row++) {
    const colorIndex = row % state.rowColors.length;
    ctx.fillStyle = state.rowColors[colorIndex];
    const y = headerH + row * cellHeight - scrollY;
    for (let col = firstCol; col <= lastCol; col++) {
      if (state.grid[row][col]) {
        const x = col * cellWidth - scrollX;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
    }
  }

  // ---- LOOP DIM OUTSIDE LOOP + BORDER LINES ----
  if (loopOn && !(loopStart === 0 && loopEnd === state.COLS - 1)) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    const gridY = headerH;
    const gridH = (lastRow - firstRow + 1) * cellHeight;
    const gridStartY = headerH + firstRow * cellHeight - scrollY;

    if (loopStart > 0) {
      const lx = loopStart * cellWidth - scrollX;
      if (lx < vw) {
        ctx.fillRect(0, gridStartY, Math.min(vw, lx), gridH);
      }
    }
    if (loopEnd < state.COLS - 1) {
      const rx = (loopEnd + 1) * cellWidth - scrollX;
      if (rx < vw) {
        ctx.fillRect(Math.max(0, rx), gridStartY, vw - Math.max(0, rx), gridH);
      }
    }
    // 2 px blue vertical lines on loop borders
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 2;
    if (loopStart > 0) {
      const lx = loopStart * cellWidth - scrollX;
      if (lx >= 0 && lx <= vw) {
        ctx.beginPath();
        ctx.moveTo(lx, gridStartY);
        ctx.lineTo(lx, gridStartY + gridH);
        ctx.stroke();
      }
    }
    if (loopEnd < state.COLS - 1) {
      const rx = (loopEnd + 1) * cellWidth - scrollX;
      if (rx >= 0 && rx <= vw) {
        ctx.beginPath();
        ctx.moveTo(rx, gridStartY);
        ctx.lineTo(rx, gridStartY + gridH);
        ctx.stroke();
      }
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
  const px = playheadStep * cellWidth - scrollX;
  if (px >= -cellWidth && px <= vw) {
    ctx.fillStyle = state.isPlaying
      ? 'rgba(26, 115, 232, 0.18)'
      : 'rgba(138, 180, 248, 0.08)';
    ctx.fillRect(Math.max(0, px), 0, Math.min(cellWidth, vw - Math.max(0, px)), vh);
    // 2 px needle at the left edge of the column
    ctx.fillStyle = '#1a73e8';
    ctx.fillRect(px, 0, 2, vh);

    // Playhead chip showing bar.beat
    const bar = Math.floor(playheadStep / state.STEPS_PER_BAR) + 1;
    const beatInBar = (playheadStep % state.STEPS_PER_BAR) / 4 + 1;
    ctx.fillStyle = state.isPlaying ? '#1a73e8' : '#8ab4f8';
    ctx.font = 'bold 11px Roboto';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chipRadius = 7;
    const chipY = state.LOOP_BAR_H + state.RULER_H / 2;
    const chipX = Math.max(chipRadius, Math.min(vw - chipRadius, px + cellWidth / 2));
    ctx.beginPath();
    ctx.arc(chipX, chipY, chipRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = state.isPlaying ? '#ffffff' : '#1a73e8';
    ctx.fillText(bar + '.' + beatInBar, chipX, chipY);
  }

  // Update position readout
  if (typeof window.updatePositionReadout === 'function') {
    window.updatePositionReadout();
  }
}

// Toggle a cell at canvas coordinates (x, y)
function toggleCell(x, y) {
  const col = Math.floor((x + state.scrollX) / state.cellWidth);
  const row = Math.floor((y + state.scrollY) / state.cellHeight);
  if (row >= 0 && row < state.ROWS && col >= 0 && col < state.COLS) {
    state.grid[row][col] = !state.grid[row][col];
    state.cacheDirty = true;
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
  const loopLeft = loopStart * state.cellWidth - state.scrollX;
  const loopRight = (loopEnd + 1) * state.cellWidth - state.scrollX;
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

  // FIX PAINT BUG: decide paint value on pointerdown
  let paintValue = null;
  if (zone === 'grid') {
    const row = rowFromY(pos.y);
    if (row >= 0 && row < state.ROWS && col >= 0 && col < state.COLS) {
      paintValue = !state.grid[row][col];
    }
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
    paintValue,
    lastPaintedCol: -1,
    lastPaintedRow: -1,
  };

  if (zone === 'ruler') {
    // Seek: set start marker AND move playhead to this step
    state.startStep = col;
    state.playStep = col;
    state.cacheDirty = true;
    drawGrid();
  } else if (zone === 'grid' && paintValue !== null) {
    const row = rowFromY(pos.y);
    if (row >= 0 && row < state.ROWS && col >= 0 && col < state.COLS) {
      state.grid[row][col] = paintValue;
      state.cacheDirty = true;
      drawGrid();
    }
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
  const row = rowFromY(pos.y);

  // Auto-scroll when pointer is near left/right edge of viewport
  const scroller = document.getElementById('gridScroller');
  if (scroller) {
    const edge = 40;
    if (pos.x < edge && scroller.scrollLeft > 0) {
      scroller.scrollLeft -= 10;
    } else if (pos.x > scroller.clientWidth - edge && scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth) {
      scroller.scrollLeft += 10;
    }
    // Vertical auto-scroll for grid painting
    if (d.zone === 'grid') {
      if (pos.y < edge && scroller.scrollTop > 0) {
        scroller.scrollTop -= 10;
      } else if (pos.y > scroller.clientHeight - edge && scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight) {
        scroller.scrollTop += 10;
      }
    }
  }

  if (d.zone === 'ruler') {
    // Scrub playhead (works while playing)
    state.startStep = col;
    state.playStep = col;
    state.cacheDirty = true;
    drawGrid();
  } else if (d.zone === 'loopbar') {
    if (d.subZone === 'loopL') {
      let ns = col;
      if (ns > d.loopEnd) ns = d.loopEnd;
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
    state.cacheDirty = true;
    drawGrid();
  } else if (d.zone === 'grid' && d.paintValue !== null) {
    // FIX PAINT BUG: only set cells whose value differs
    if (row >= 0 && row < state.ROWS && col >= 0 && col < state.COLS) {
      if (row !== d.lastPaintedRow || col !== d.lastPaintedCol) {
        if (state.grid[row][col] !== d.paintValue) {
          state.grid[row][col] = d.paintValue;
          state.cacheDirty = true;
        }
        d.lastPaintedRow = row;
        d.lastPaintedCol = col;
        drawGrid();
      }
    }
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
    state.cacheDirty = true;
  }

  state.drag = null;
  drawGrid();
}

// Start the sequencer
function startSequencer() {
  if (state.isPlaying || state.exporting) return;
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
  if (typeof window.updatePositionReadout === 'function') {
    window.updatePositionReadout();
  }
}

// Clear the grid
function clearGrid() {
  state.grid = Array.from({ length: state.ROWS }, () =>
    Array.from({ length: state.COLS }, () => false));
  state.cacheDirty = true;
  drawGrid();
}

// Generate a random pattern (about 10% chance per cell)
function randomPattern() {
  state.grid = Array.from({ length: state.ROWS }, () =>
    Array.from({ length: state.COLS }, () => Math.random() > 0.9));
  state.cacheDirty = true;
  drawGrid();
}

// The scheduler: called periodically to check if we need to play notes
function scheduler() {
  const currentTime = audioContext.currentTime;
  const lookahead = state.scheduleAheadTime; // how far ahead to schedule
  const secondsPerBeat = 60.0 / state.bpm;
  const stepTime = secondsPerBeat / 4; // each step is a 16th note

  // Read ADSR sliders and timbre ONCE per call (not per note)
  const env = {
    attack: parseFloat(document.getElementById('attackSlider').value),
    decay: parseFloat(document.getElementById('decaySlider').value),
    sustain: parseFloat(document.getElementById('sustainSlider').value),
    release: parseFloat(document.getElementById('releaseSlider').value),
  };
  const timbre = document.getElementById('waveformSelect').value;

  // While there are notes that need to be played ahead of time
  while (state.lastNoteTime < currentTime + lookahead) {
    // Play notes for the current step
    for (let row = 0; row < state.ROWS; row++) {
      if (state.grid[row][state.playStep]) {
        const frequency = state.frequencies[row];
        // The note duration is stepTime (the length of a step)
        playNote(
          frequency,
          state.lastNoteTime,
          stepTime,
          timbre,
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

  // Follow playhead: auto-scroll when playhead leaves visible area
  if (state.follow) {
    const scroller = document.getElementById('gridScroller');
    if (scroller) {
      const cellWidth = state.cellWidth;
      const playheadX = state.playStep * cellWidth;
      const vw = scroller.clientWidth - 72;
      const scrollX = scroller.scrollLeft;
      // If playhead is past 80% of width, jump scroll so playhead sits at 20%
      if (playheadX - scrollX > vw * 0.8) {
        const targetScroll = playheadX - vw * 0.2;
        scroller.scrollLeft = Math.max(0, Math.min(targetScroll, scroller.scrollWidth - scroller.clientWidth));
        state.scrollX = scroller.scrollLeft;
      }
    }
  }

  // Update position readout
  updatePositionReadout();

  // Request next frame
  state.animationFrameId = requestAnimationFrame(animatePlayhead);
}

// Update position readout: "Bar 3 - Beat 2   00:07.2 / 02:34"
function updatePositionReadout() {
  const el = document.getElementById('positionReadout');
  if (!el) return;
  const stepTime = 60.0 / (state.bpm * 4);
  const currentTime = state.isPlaying
    ? state.lastNoteTime - audioContext.currentTime + (state.playStep * stepTime)
    : state.playStep * stepTime;
  // Clamp currentTime to 0 if negative
  const displayTime = Math.max(0, currentTime);
  const totalSeconds = state.COLS * stepTime;

  const bar = Math.floor(state.playStep / state.STEPS_PER_BAR) + 1;
  const beatInBar = (state.playStep % state.STEPS_PER_BAR) / 4 + 1;

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms}`;
  };

  el.textContent = `Bar ${bar} - Beat ${beatInBar}   ${formatTime(displayTime)} / ${formatTime(totalSeconds)}`;
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
window.rowFromY = rowFromY;
window.updatePositionReadout = updatePositionReadout;

// Initialize notes on load
initNotes();
