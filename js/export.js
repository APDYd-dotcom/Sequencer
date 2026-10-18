// export.js - Export the sequencer song as MP3 (offline render + lamejs)

const SAMPLE_RATE = 44100;
const LEAD = 0.05;          // seconds of silence before the first note
const REVERB_TAIL = 2.5;    // seconds of tail for reverb decay

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

  // Recompute info text when the dialog is shown
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
  if (state.loopOn) {
    stepsText = `steps ${state.loopStart + 1}-${state.loopEnd + 1}`;
    stepCount = state.loopEnd - state.loopStart + 1;
  } else {
    stepsText = `steps 1-${state.COLS}`;
    stepCount = state.COLS;
  }
  const release = parseFloat(document.getElementById('releaseSlider').value) || 0;
  const duration = LEAD + stepCount * stepTime + REVERB_TAIL + release;
  exportInfo.textContent = `Exports ${stepsText} at ${bpm} BPM, about ${duration.toFixed(1)} s.`;
}

function openExportDialog() {
  if (!window.state || window.state.exporting) return;

  // Pause the sequencer if playing
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

  // RIFF
  dataView.setUint32(0, 0x52494664, false); // "RIFF"
  dataView.setUint32(4, totalSize, false);
  dataView.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt
  dataView.setUint32(12, 0x666d7420, false); // "fmt "
  dataView.setUint32(16, 16, false);         // subchunk1Size
  dataView.setUint16(20, 1, false);          // audioFormat (PCM)
  dataView.setUint16(22, numChannels, false);
  dataView.setUint32(24, sampleRate, false);
  dataView.setUint32(28, byteRate, false);
  dataView.setUint16(32, blockAlign, false);
  dataView.setUint16(34, bytesPerSample * 8, false); // bitsPerSample
  // data
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

    // Convert Float32 to Int16 for lamejs
    const left16 = new Int16Array(samplesPerFrame);
    const right16 = new Int16Array(samplesPerFrame);
    for (let i = 0; i < chunkLen; i++) {
      left16[i] = clampSample(left[offset + i]) * 32767;
      right16[i] = clampSample(right[offset + i]) * 32767;
    }
    // Rest of the frame stays zero (silent padding for the last block)

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

async function doExport() {
  if (!window.state) return;
  const state = window.state;

  if (state.exporting) return;

  // Determine export range
  let startStep, endStep;
  if (state.loopOn) {
    startStep = state.loopStart;
    endStep = state.loopEnd;
  } else {
    startStep = 0;
    endStep = state.COLS - 1;
  }

  // Refuse empty pattern
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

  const stepsPerLoop = endStep - startStep + 1;
  const totalSeconds = LEAD + stepsPerLoop * stepTime * repeat + REVERB_TAIL + release;
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

  // Clear waveCache if it exists
  if (window.waveCache) {
    for (const key of Object.keys(window.waveCache)) {
      delete window.waveCache[key];
    }
  }

  try {
    // Swap to offline context
    const offlineContext = new OfflineAudioContext(2, totalFrames, SAMPLE_RATE);
    if (window.setAudioContext) {
      window.setAudioContext(offlineContext);
    }
    window.audioContext = offlineContext;

    // Reinitialize audio graph on the offline context
    window.initAudio();
    if (window.masterGain) {
      window.masterGain.gain.value = savedVolume;
    }

    // Schedule all notes
    for (let rep = 0; rep < repeat; rep++) {
      for (let i = 0; i < stepsPerLoop; i++) {
        const step = startStep + i;
        const time = LEAD + (rep * stepsPerLoop + i) * stepTime;
        for (let row = 0; row < state.ROWS; row++) {
          if (state.grid[row][step]) {
            const frequency = state.frequencies[row];
            const env = {
              attack: parseFloat(document.getElementById('attackSlider').value),
              decay: parseFloat(document.getElementById('decaySlider').value),
              sustain: parseFloat(document.getElementById('sustainSlider').value),
              release: release,
            };
            window.playNote(frequency, time, stepTime, timbre, env);
          }
        }
      }
    }

    if (exportStatus) {
      exportStatus.textContent = 'Rendering the audio...';
    }
    if (exportProgress) {
      exportProgress.value = 30;
    }

    // Render
    const renderedBuffer = await offlineContext.startRendering();

    if (exportStatus) {
      exportStatus.textContent = 'Encoding MP3...';
    }
    if (exportProgress) {
      exportProgress.value = 60;
    }

    const left = renderedBuffer.getChannelData(0);
    const right = renderedBuffer.getChannelData(1);

    let chunks;
    let mime = 'audio/mpeg';
    let ext = 'mp3';

    if (typeof lamejs !== 'undefined') {
      chunks = await encodeMp3(left, right, SAMPLE_RATE, kbps, (p) => {
        if (exportProgress) {
          exportProgress.value = 60 + Math.round((p / 100) * 40);
        }
      });
    } else {
      // WAV fallback
      const left16 = floatToInt16(left);
      const right16 = floatToInt16(right);
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

    // Clear waveCache again
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
