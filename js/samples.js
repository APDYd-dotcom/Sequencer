// samples.js - Loads piano samples into AudioBuffers
let pianoSamples = {}; // keyed by MIDI note number

// List of sampled MIDI notes (A0, C1, D#1, F#1, A1, ... C8)
const sampledMidiNotes = [
  21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108
];

// Map MIDI number to file name (e.g., A0v5.mp3)
function midiToSampleName(midi) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  const name = noteNames[midi % 12];
  // Replace # with %23 for URL? Actually the file uses # in name, but we'll use the note name with # (browser will handle)
  return name + octave + 'v5.mp3';
}

// Load all samples
async function loadSamples() {
  const statusEl = document.getElementById('samplesStatus');
  const total = sampledMidiNotes.length;
  let loaded = 0;
  let failed = false;
  
  if (statusEl) {
    statusEl.textContent = `Loading piano 0/${total}...`;
  }
  
  // Load in parallel with concurrency limit (optional)
  const promises = sampledMidiNotes.map(async (midi) => {
    const noteName = midiToSampleName(midi);
    const url = `samples/piano/${noteName}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      pianoSamples[midi] = audioBuffer;
      loaded++;
      if (statusEl) {
        statusEl.textContent = `Loading piano ${loaded}/${total}...`;
      }
    } catch (err) {
      console.warn(`Failed to load ${noteName}:`, err);
      failed = true;
    }
  });
  
  await Promise.all(promises);
  
  if (failed) {
    if (statusEl) {
      statusEl.textContent = 'Samples unavailable, using synthesized piano';
    }
    // Clear samples so we fall back
    pianoSamples = {};
  } else {
    if (statusEl) {
      statusEl.textContent = 'Grand Piano (Samples) ready';
    }
  }
}

// Find nearest sampled MIDI note for a given MIDI number
function findNearestSample(midi) {
  let nearest = sampledMidiNotes[0];
  let minDiff = Math.abs(midi - nearest);
  for (const s of sampledMidiNotes) {
    const diff = Math.abs(midi - s);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = s;
    }
  }
  return nearest;
}

// Expose globals
window.pianoSamples = pianoSamples;
window.loadSamples = loadSamples;
window.findNearestSample = findNearestSample;
window.sampledMidiNotes = sampledMidiNotes;
window.midiToSampleName = midiToSampleName;
