// piano.js - Handles the piano keyboard drawing and interaction
let pianoState = {
  canvas: null,
  ctx: null,
  // Logical dimensions (set in resizePiano)
  logicalWidth: 0,
  logicalHeight: 0,
  // Key dimensions in logical pixels
  keyWidth: 0,
  keyHeight: 0,
  // Black key dimensions
  blackKeyWidthRatio: 0.6, // 60% of white key width
  blackKeyHeightRatio: 0.6, // 60% of white key height
  // Lit keys: row -> draw count (overlapping flashes stack)
  lit: new Map(),
  // Interaction state
  pointerDown: false,
  lastRow: -1,
};

// Initialize the piano canvas
function initPiano() {
  pianoState.canvas = document.getElementById('pianoCanvas');
  if (!pianoState.canvas) return;
  pianoState.ctx = pianoState.canvas.getContext('2d');
  resizePiano();
  drawPiano();

  // Pointer events replace the old separate mouse + touch handlers
  pianoState.canvas.addEventListener('pointerdown', handlePianoPointerDown);
  pianoState.canvas.addEventListener('pointermove', handlePianoPointerMove);
  pianoState.canvas.addEventListener('pointerup', handlePianoPointerUp);
  pianoState.canvas.addEventListener('pointercancel', handlePianoPointerUp);
  pianoState.canvas.addEventListener('pointerleave', handlePianoPointerUp);

  pianoState.pointerDown = false;
  pianoState.lastRow = -1;
}

// Resize the piano canvas to match the scroller viewport and handle HiDPI
function resizePiano() {
  if (!pianoState.canvas) {
    const scroller = document.getElementById('gridScroller');
    if (scroller && window.state) {
      pianoState.logicalHeight = scroller.clientHeight;
      pianoState.logicalWidth = 72;
      pianoState.keyHeight = window.state.ROW_HEIGHT;
      pianoState.keyWidth = 72;
    }
    return;
  }

  const scroller = document.getElementById('gridScroller');
  if (!scroller) return;

  // The piano is as tall as the scroller viewport (pinned layer)
  const scrollerHeight = scroller.clientHeight;
  pianoState.logicalHeight = scrollerHeight;
  pianoState.logicalWidth = 72; // fixed width in logical pixels

  pianoState.canvas.width = pianoState.logicalWidth * window.devicePixelRatio;
  pianoState.canvas.height = pianoState.logicalHeight * window.devicePixelRatio;

  pianoState.canvas.style.width = pianoState.logicalWidth + 'px';
  pianoState.canvas.style.height = pianoState.logicalHeight + 'px';

  pianoState.ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

  // Key height matches the grid row height exactly so rows line up
  pianoState.keyHeight = window.state.ROW_HEIGHT;
  pianoState.keyWidth = pianoState.logicalWidth;

  drawPiano();
}

// Row at piano canvas coordinate y, or null for the header / out of range
function pianoRowFromY(y) {
  if (!window.state) return null;
  const headerH = window.state.HEADER_H;
  if (y < headerH) return null;
  const row = Math.floor((y - headerH + window.state.scrollY) / pianoState.keyHeight);
  if (row < 0 || row >= window.state.ROWS) return null;
  return row;
}

function pianoPos(e) {
  const rect = pianoState.canvas.getBoundingClientRect();
  return e.clientY - rect.top;
}

// Draw the piano keyboard (full redraw: lit keys overlay everything)
function drawPiano() {
  if (!window.state || !pianoState.canvas) return;

  const ctx = pianoState.ctx;
  const width = pianoState.logicalWidth;
  const height = pianoState.logicalHeight;
  const keyHeight = pianoState.keyHeight;
  const scrollY = window.state.scrollY || 0;
  const headerH = window.state.HEADER_H;

  // Clear background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, width, height);

  // Blank header cell at the top, matching the ruler
  ctx.fillStyle = '#e8eaed';
  ctx.fillRect(0, 0, width, headerH);
  ctx.strokeStyle = '#dadce0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerH);
  ctx.lineTo(width, headerH);
  ctx.stroke();

  // Visible row range (rows are drawn at y = HEADER_H + row*keyHeight - scrollY)
  const firstRow = Math.max(0, Math.floor((scrollY - headerH) / keyHeight));
  const lastRow = Math.min(
    window.state.ROWS - 1,
    Math.ceil((scrollY + height - headerH) / keyHeight)
  );

  // White keys (underneath the black keys)
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  for (let row = firstRow; row <= lastRow; row++) {
    const y = headerH + row * keyHeight - scrollY;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, y, pianoState.keyWidth, keyHeight);
    ctx.strokeRect(0, y, pianoState.keyWidth, keyHeight);
  }

  // Note names on white keys; C keys bold
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let row = firstRow; row <= lastRow; row++) {
    if (window.state.isBlackKey[row]) continue;
    const y = headerH + row * keyHeight - scrollY;
    const noteName = window.state.noteNames[row];
    const isC = noteName.startsWith('C');
    ctx.fillStyle = isC ? '#202124' : '#5f6368';
    ctx.font = isC ? 'bold 12px Roboto, Arial, sans-serif' : '12px Roboto, Arial, sans-serif';
    ctx.fillText(noteName, pianoState.keyWidth - 4, y + keyHeight * 0.72);
  }

  // Black keys with small white note labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let row = firstRow; row <= lastRow; row++) {
    if (!window.state.isBlackKey[row]) continue;
    const y = headerH + row * keyHeight - scrollY;
    const blackKeyWidth = pianoState.keyWidth * pianoState.blackKeyWidthRatio;
    const blackKeyHeight = keyHeight * pianoState.blackKeyHeightRatio;
    const x = (pianoState.keyWidth - blackKeyWidth) / 2;

    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, blackKeyWidth, blackKeyHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Roboto, Arial, sans-serif';
    ctx.fillText(window.state.noteNames[row], pianoState.keyWidth / 2, y + blackKeyHeight / 2);
  }

  // Lit keys overlay (stacked flashes)
  if (pianoState.lit.size > 0) {
    for (const [row, count] of pianoState.lit.entries()) {
      const y = headerH + row * keyHeight - scrollY;
      if (y + keyHeight < 0 || y > height) continue;
      const highlightColor = window.state.isBlackKey[row]
        ? 'rgba(26, 115, 232, 0.8)'
        : 'rgba(138, 180, 248, 0.8)';
      ctx.fillStyle = highlightColor;
      if (window.state.isBlackKey[row]) {
        const blackKeyWidth = pianoState.keyWidth * pianoState.blackKeyWidthRatio;
        const blackKeyHeight = keyHeight * pianoState.blackKeyHeightRatio;
        const x = (pianoState.keyWidth - blackKeyWidth) / 2;
        ctx.fillRect(x, y, blackKeyWidth, blackKeyHeight);
      } else {
        ctx.fillRect(0, y, pianoState.keyWidth, keyHeight);
      }
    }
  }
}

// Light a piano key for a duration (stacked, nothing is erased)
function flashPianoKey(row, delayMs, durationMs) {
  if (!window.state) return;
  pianoState.lit.set(row, (pianoState.lit.get(row) || 0) + 1);
  drawPiano();
  setTimeout(() => {
    if (!pianoState.canvas) return;
    const n = pianoState.lit.get(row);
    if (!n) return;
    if (n <= 1) pianoState.lit.delete(row);
    else pianoState.lit.set(row, n - 1);
    drawPiano();
  }, delayMs + durationMs);
}

// Play a note on the piano key (preview). When Rec is on, also toggle the
// grid cell at the current step (undoable) and advance the playhead.
function playPianoKey(row) {
  if (!window.state) return;

  resumeAudioContext().then(() => {
    const frequency = window.state.frequencies[row];
    const duration = 0.3;
    const waveform = document.getElementById('waveformSelect').value;
    const env = {
      attack: parseFloat(document.getElementById('attackSlider').value),
      decay: parseFloat(document.getElementById('decaySlider').value),
      sustain: parseFloat(document.getElementById('sustainSlider').value),
      release: parseFloat(document.getElementById('releaseSlider').value),
    };
    playNote(frequency, audioContext.currentTime, duration, waveform, env);
    flashPianoKey(row, 0, duration * 1000);

    if (!window.state.rec) return;

    window.beginEdit();
    window.state.grid[row][window.state.playStep] = !window.state.grid[row][window.state.playStep];
    window.state.cacheDirty = true;
    window.drawGrid();
    window.endEdit();
    window.debouncedAutosave();

    // Step recording: advance to the next step
    if (!window.state.isPlaying) {
      window.state.playStep = (window.state.playStep + 1) % window.state.COLS;
      window.drawGrid();
      scrollPlayheadIntoView();
    }
  });
}

// Scroll the playhead into view in the scroller
function scrollPlayheadIntoView() {
  const scroller = document.getElementById('gridScroller');
  if (!scroller) return;
  const cellWidth = window.state.cellWidth;
  const playheadX = window.state.playStep * cellWidth;
  const vw = scroller.clientWidth - 72;
  const scrollX = scroller.scrollLeft;
  if (playheadX < scrollX || playheadX > scrollX + vw - cellWidth) {
    scroller.scrollLeft = Math.max(0, playheadX - vw / 2);
    window.state.scrollX = scroller.scrollLeft;
    window.drawGrid();
  }
}

// Handle piano pointer down
function handlePianoPointerDown(e) {
  e.preventDefault();
  if (!window.state) return;
  const row = pianoRowFromY(pianoPos(e));
  if (row === null) return;
  pianoState.pointerDown = true;
  pianoState.lastRow = row;
  playPianoKey(row);
  try {
    pianoState.canvas.setPointerCapture(e.pointerId);
  } catch (err) {
    // pointer capture not supported
  }
}

// Handle piano pointer move
function handlePianoPointerMove(e) {
  if (!pianoState.pointerDown || !window.state) return;
  const row = pianoRowFromY(pianoPos(e));
  if (row !== null && row !== pianoState.lastRow) {
    pianoState.lastRow = row;
    playPianoKey(row);
  }
}

// Handle piano pointer up / cancel / leave
function handlePianoPointerUp() {
  pianoState.pointerDown = false;
  pianoState.lastRow = -1;
}

// Expose functions
window.initPiano = initPiano;
window.drawPiano = drawPiano;
window.flashPianoKey = flashPianoKey;
window.resizePiano = resizePiano;
