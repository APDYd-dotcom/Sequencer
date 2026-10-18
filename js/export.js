// export.js - Export the sequencer song as MP3 (offline render + lamejs)

const SAMPLE_RATE = 44100;
const LEAD = 0.05;          // seconds of silence before the first note
const REVERB_TAIL = 3.0;    // seconds of tail for reverb decay (per segment)
const SEGMENT_BARS = 8;     // render in 8-bar segments

let exportDialog = null;
let exportProgress = null;
let exportStatus = null;
let exportInfo = null;

function initExport() {
  exportDialog = document.getElementById('exportDialog');
  exportProgress = document.getElementById('exportProgress');
  exportStatus = document.getElementById('exportStatus');
  exportInfo = document.getElementById('exportInfo');

  const exportBtn = document.getElementById('exportBtn');
  const exportCloseBtn = document.getElementById('exportCloseBtn');
  const exportActionBtn = document.getElementById('exportActionBtn');
  const exportCancelBtn = document.getElementById('exportCancelBtn');

  if (exportBtn) {
    exportBtn.addEventListener('click', openExportDialog);
  }
  if (exportCloseBtn) {
    exportCloseBtn.addEventListener('click', closeExportDialog);
  }
  if (exportCancelBtn) {
    exportCancelBtn.addEventListener('click', closeExportDialog);
  }
  if (exportActionBtn) {
    exportActionBtn.addEventListener('click', doExport);
  }

  if (exportDialog) {
    exportDialog.addEventListener('show', updateExportInfo);
    exportDialog.addEventListener('cancel', (e) => {
      if (window.state && window.state.exporting) {
        e.preventDefault();
      }
    });
  }
}

function updateExportInfo() {
  if (!exportInfo || !window.state) return;
  const state = window.state;
  const bpm = state.bpm;
  const stepTime = 60.0 / (bpm * 4);
  let stepsText, stepCount;
  const exportScope = document.getElementById('exportScope') ? document.getElementById('exportScope').value : 'song';
  if (exportScope === 'loop' && state.loopOn) {
    stepsText = `loop steps ${state.loopStart + 1}-${state.loopEnd + 1}`;
    stepCount = state.loopEnd - state.loopStart + 1;
  } else {
    stepsText = `all ${state.COLS} steps`;
    stepCount = state.COLS;
  }
  const release = parseFloat(document.getElementById('releaseSlider').value) || 0;
  const duration = LEAD + stepCount * stepTime + REVERB_TAIL + release;
  exportInfo.textContent = `Exports ${stepsText} at ${bpm} BPM, about ${duration.toFixed(1)} s.`;
}

function openExportDialog() {
  if (!window.state || window.state.exporting) return;

  if (window.state.isPlaying && typeof window.stopSequencer === 'function') {
    window.stopSequencer();
  }

  updateExportInfo();

  if (exportProgress) {
    exportProgress.value = 0;
    exportProgress.hidden = true;
  }
  if (exportStatus) {
    exportStatus.textContent = '';
  }

  const qualitySelect = document.getElementById('exportQuality');
  if (typeof lamejs === 'undefined') {
    if (qualitySelect) qualitySelect.disabled = true;
    if (exportStatus) {
      exportStatus.textContent = 'MP3 encoder not found, the file will be a WAV.';
    }
  } else {
    if (qualitySelect) qualitySelect.disabled = false;
  }

  exportDialog.showModal();
}

function closeExportDialog() {
  if (exportDialog) exportDialog.close();
}

function hasNotesInRange(startStep, endStep) {
  if (!window.state) return false;
  for (let row = 0; row < window.state.ROWS; row++) {
    for (let col = startStep; col <= endStep; col++) {
      if (window.state.grid[row][col]) return true;
    }
  }
  return false;
}

function clampSample(v) {
  return Math.max(-1, Math.min(1, v));
}

function floatToInt16(samples) {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = clampSample(samples[i]) * 32767;
  }
  return out;
}

function writeWavHeader(dataView, numChannels, sampleRate, bytesPerSample, dataSize) {
  const byteRate = sampleRate * numChannels * bytesPerSample;
  const blockAlign = numChannels * bytesPerSample;
  const totalSize = 36 + dataSize;

  dataView.setUint32(0, 0x52494664, false); // "RIFF"
  dataView.setUint32(4, totalSize, false);
  dataView.setUint32(8, 0x57415645, false); // "WAVE"
  dataView.setUint32(12, 0x666d7420, false); // "fmt "
  dataView.setUint32(16, 16, false);
  dataView.setUint16(20, 1, false);
  dataView.setUint16(22, numChannels, false);
  dataView.setUint32(24, sampleRate, false);
  dataView.setUint32(28, byteRate, false);
  dataView.setUint16(32, blockAlign, false);
  dataView.setUint16(34, bytesPerSample * 8, false);
  dataView.setUint32(36, 0x64617461, false); // "data"
  dataView.setUint32(40, dataSize, false);
}

async function encodeMp3(left, right, sampleRate, kbps, onProgress) {
  const encoder = new lamejs.Mp3Encoder(2, sampleRate, kbps);
  const samplesPerFrame = 1152;
  const chunks = [];
  let totalSamples = left.length;
  let offset = 0;
  let blockCount = 0;

  while (offset < totalSamples) {
    const end = Math.min(offset + samplesPerFrame, totalSamples);
    const chunkLen = end - offset;

    const left16 = new Int16Array(samplesPerFrame);
    const right16 = new Int16Array(samplesPerFrame);
    for (let i = 0; i < chunkLen; i++) {
      left16[i] = clampSample(left[offset + i]) * 32767;
      right16[i] = clampSample(right[offset + i]) * 32767;
    }

    const encoded = encoder.encodeBuffer(left16, right16);
    if (encoded.length > 0) chunks.push(encoded);

    offset = end;
    blockCount++;

    if (onProgress && blockCount % 100 === 0) {
      const progress = Math.min(99, Math.round((offset / totalSamples) * 99));
      onProgress(progress);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(flushed);

  if (onProgress) onProgress(100);
  return chunks;
}

// Render a single segment using an OfflineAudioContext
async function renderSegment(segmentStartStep, segmentEndStep, repeat, stepTime, timbre, env, lead, segmentSeconds, sampleRate) {
  const segmentFrames = Math.ceil(segmentSeconds * sampleRate);
  const offlineContext = new OfflineAudioContext(2, segmentFrames, sampleRate);

  // Save and swap globals
  const savedAudioContext = window.getAudioContext ? window.getAudioContext() : window.audioContext;
  const savedMasterGain = window.masterGain;
  const savedMasterBus = window.masterBus;
  const savedCompressor = window.compressor;
  const savedLimiter = window.limiter;
  const savedConvolver = window.convolver;
  const savedVolume = savedMasterGain ? savedMasterGain.gain.value : 0.8;

  if (window.waveCache) {
    for (const key of Object.keys(window.waveCache)) {
      delete window.waveCache[key];
    }
  }

  try {
    window.setAudioContext(offlineContext);
    window.audioContext = offlineContext;
    window.initAudio();
    if (window.masterGain) {
      window.masterGain.gain.value = savedVolume;
    }

    const loopStart = segmentStartStep;
    const loopEnd = segmentEndStep;
    const stepsPerSegment = segmentEndStep - segmentStartStep + 1;

    // Schedule notes for this segment
    for (let rep = 0; rep < repeat; rep++) {
      for (let i = 0; i < stepsPerSegment; i++) {
        const step = segmentStartStep + i;
        const time = lead + (rep * stepsPerSegment + i) * stepTime;
        for (let row = 0; row < window.state.ROWS; row++) {
          if (window.state.grid[row][step]) {
            const frequency = window.state.frequencies[row];
            window.playNote(frequency, time, stepTime, timbre, env);
          }
        }
      }
    }

    const renderedBuffer = await offlineContext.startRendering();
    return { left: renderedBuffer.getChannelData(0), right: renderedBuffer.getChannelData(1) };
  } finally {
    // Restore globals
    if (window.setAudioContext) {
      window.setAudioContext(savedAudioContext);
    }
    window.audioContext = savedAudioContext;
    window.masterGain = savedMasterGain;
    window.masterBus = savedMasterBus;
    window.compressor = savedCompressor;
    window.limiter = savedLimiter;
    window.convolver = savedConvolver;

    if (window.waveCache) {
      for (const key of Object.keys(window.waveCache)) {
        delete window.waveCache[key];
      }
    }
  }
}

async function doExport() {
  if (!window.state) return;
  const state = window.state;

  if (state.exporting) return;

  const exportScope = document.getElementById('exportScope') ? document.getElementById('exportScope').value : 'song';

  let startStep, endStep;
  if (exportScope === 'loop' && state.loopOn) {
    startStep = state.loopStart;
    endStep = state.loopEnd;
  } else {
    startStep = 0;
    endStep = state.COLS - 1;
  }

  if (!hasNotesInRange(startStep, endStep)) {
    if (exportStatus) {
      exportStatus.textContent = 'Nothing to export: add some notes first.';
    }
    return;
  }

  const bpm = state.bpm;
  const stepTime = 60.0 / (bpm * 4);
  const repeat = parseInt(document.getElementById('exportRepeat').value) || 2;
  const kbps = parseInt(document.getElementById('exportQuality').value) || 192;
  const release = parseFloat(document.getElementById('releaseSlider').value) || 0;
  const timbre = document.getElementById('waveformSelect').value;

  const stepsPerRange = endStep - startStep + 1;
  const totalSeconds = LEAD + stepsPerRange * stepTime * repeat + REVERB_TAIL + release;
  const totalFrames = Math.ceil(totalSeconds * SAMPLE_RATE);

  // Lock app
  state.exporting = true;
  if (exportProgress) {
    exportProgress.hidden = false;
    exportProgress.value = 0;
  }
  if (exportStatus) {
    exportStatus.textContent = 'Rendering the audio...';
  }

  const exportActionBtn = document.getElementById('exportActionBtn');
  const exportCloseBtn = document.getElementById('exportCloseBtn');
  if (exportActionBtn) exportActionBtn.disabled = true;
  if (exportCloseBtn) exportCloseBtn.disabled = true;

  // Save globals
  const savedAudioContext = window.getAudioContext ? window.getAudioContext() : window.audioContext;
  const savedMasterGain = window.masterGain;
  const savedMasterBus = window.masterBus;
  const savedCompressor = window.compressor;
  const savedLimiter = window.limiter;
  const savedConvolver = window.convolver;
  const savedVolume = savedMasterGain ? savedMasterGain.gain.value : 0.8;

  if (window.waveCache) {
    for (const key of Object.keys(window.waveCache)) {
      delete window.waveCache[key];
    }
  }

  try {
    // Render in segments of SEGMENT_BARS
    const stepsPerSegment = SEGMENT_BARS * state.STEPS_PER_BAR;
    const segmentSeconds = stepsPerSegment * stepTime + REVERB_TAIL;
    let renderedOffset = 0;
    const finalLeft = new Float32Array(totalFrames);
    const finalRight = new Float32Array(totalFrames);

    let segmentStart = startStep;
    let segmentRenderCount = 0;

    while (segmentStart <= endStep) {
      const segmentEnd = Math.min(segmentStart + stepsPerSegment - 1, endStep);
      const segmentRender = await renderSegment(
        segmentStart, segmentEnd, repeat, stepTime, timbre, env,
        LEAD, segmentSeconds, SAMPLE_RATE
      );

      // Overlap-add into final buffer
      const startOffset = Math.round((segmentStart - startStep) * stepTime * SAMPLE_RATE);
      const copyLen = Math.min(segmentRender.left.length, totalFrames - startOffset);
      for (let i = 0; i < copyLen; i++) {
        finalLeft[startOffset + i] += segmentRender.left[i];
        finalRight[startOffset + i] += segmentRender.right[i];
      }

      segmentRenderCount++;
      segmentStart = segmentEnd + 1;

      // Update progress (rendering: 0-60%)
      const renderProgress = Math.round((segmentStart - startStep) / (endStep - startStep + 1) * 60);
      if (exportProgress) {
        exportProgress.value = renderProgress;
      }
      if (exportStatus) {
        exportStatus.textContent = `Rendering segment ${segmentRenderCount}...`;
      }

      // Yield to UI
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    if (exportStatus) {
      exportStatus.textContent = 'Encoding MP3...';
    }
    if (exportProgress) {
      exportProgress.value = 60;
    }

    // Encode
    let chunks;
    let mime = 'audio/mpeg';
    let ext = 'mp3';

    if (typeof lamejs !== 'undefined') {
      chunks = await encodeMp3(finalLeft, finalRight, SAMPLE_RATE, kbps, (p) => {
        if (exportProgress) {
          exportProgress.value = 60 + Math.round((p / 100) * 40);
        }
      });
    } else {
      const left16 = floatToInt16(finalLeft);
      const right16 = floatToInt16(finalRight);
      const interleaved = new Int16Array(left16.length * 2);
      for (let i = 0; i < left16.length; i++) {
        interleaved[i * 2] = left16[i];
        interleaved[i * 2 + 1] = right16[i];
      }
      const header = new ArrayBuffer(44);
      const dv = new DataView(header);
      writeWavHeader(dv, 2, SAMPLE_RATE, 2, interleaved.byteLength);
      chunks = [header, interleaved];
      mime = 'audio/wav';
      ext = 'wav';
    }

    if (exportProgress) {
      exportProgress.value = 100;
    }

    const blob = new Blob(chunks, { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sequencer-${bpm}bpm.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 10000);

    if (exportStatus) {
      const sizeKB = Math.round(blob.size / 1024);
      exportStatus.textContent = `Done! ${sizeKB} KB saved as .${ext}`;
    }
  } catch (err) {
    console.error('Export failed:', err);
    if (exportStatus) {
      exportStatus.textContent = 'Export failed: ' + err.message;
    }
  } finally {
    state.exporting = false;
    if (exportProgress) {
      exportProgress.hidden = true;
    }
    if (exportActionBtn) exportActionBtn.disabled = false;
    if (exportCloseBtn) exportCloseBtn.disabled = false;

    // Restore globals
    if (window.setAudioContext) {
      window.setAudioContext(savedAudioContext);
    }
    window.audioContext = savedAudioContext;
    window.masterGain = savedMasterGain;
    window.masterBus = savedMasterBus;
    window.compressor = savedCompressor;
    window.limiter = savedLimiter;
    window.convolver = savedConvolver;

    if (window.waveCache) {
      for (const key of Object.keys(window.waveCache)) {
        delete window.waveCache[key];
      }
    }
  }
}

// Expose
window.initExport = initExport;
window.openExportDialog = openExportDialog;
window.closeExportDialog = closeExportDialog;
