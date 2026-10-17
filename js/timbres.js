// timbres.js - Additive synthesis timbres (arrays of harmonics)
// Each array: index 0 = fundamental f, index 1 = 2f, etc., value = loudness 0..1

const timbreViolon = [1.0, 0.7, 0.6, 0.5, 0.4, 0.35];
const timbreVioloncelle = [1.0, 0.85, 0.7, 0.5, 0.45, 0.3, 0.25, 0.15, 0.1];
const timbreGuitare = [1.0, 0.7, 0.5, 0.3, 0.25, 0.15, 0.1, 0.07, 0.05];
const timbreClavecin = [1.0, 0.9, 0.8, 0.7, 0.55, 0.45, 0.35, 0.28, 0.2, 0.15];
const timbreHarpe = [1.0, 0.45, 0.2, 0.1, 0.05];
const timbreBasse = [1.0, 0.5, 0.25, 0.12];

const timbreHautbois = [0.8, 1.0, 0.7, 0.5, 0.35, 0.25, 0.15, 0.1];
const timbreBasson = [1.0, 0.6, 0.3, 0.45, 0.2, 0.25, 0.1, 0.1];
const timbreSaxophone = [1.0, 0.8, 0.6, 0.45, 0.4, 0.25, 0.2, 0.12, 0.08];

const timbreTrombone = [1.0, 0.8, 0.6, 0.45, 0.3, 0.2, 0.12, 0.08];
const timbreCor = [1.0, 0.5, 0.3, 0.2, 0.12, 0.08, 0.05];

const timbreAccordeon = [1.0, 0.5, 0.8, 0.3, 0.6, 0.2, 0.35, 0.1];
const timbreHarmonica = [1.0, 0.6, 0.7, 0.4, 0.35, 0.2, 0.2, 0.1];
const timbreChoeur = [1.0, 0.5, 0.65, 0.3, 0.15, 0.1, 0.2, 0.3, 0.15, 0.05];

const timbreVibraphone = [1.0, 0.05, 0.15, 0.02, 0.05];
const timbreCelesta = [1.0, 0.1, 0.35, 0.05, 0.12];

const timbreSynthLead = [1.0, 0.0, 0.33, 0.0, 0.2, 0.0, 0.14, 0.0, 0.11];
const timbreSynthScie = [1.0, 0.5, 0.33, 0.25, 0.2, 0.17, 0.14, 0.12];
const timbreSynthPad = [1.0, 0.5, 0.33, 0.25, 0.2];

// TIMBRES table: describes how each timbre is played
const TIMBRES = {
  violon: {
    family: 'Strings',
    harmonics: timbreViolon,
    detunes: [-5, 0, 5],
    cutoff: 3000,
    sweep: { start: 4000, end: 2000, tau: 0.3 },
    vibrato: { rate: 5, depth: 0.01 },
    breath: 0,
    hammer: 0,
    preset: { attack: 0.1, decay: 0.3, sustain: 0.7, release: 0.8 },
    level: 0.6,
    reverb: 0.4
  },
  violoncelle: {
    family: 'Strings',
    harmonics: timbreVioloncelle,
    detunes: [-3, 0, 3],
    cutoff: 2500,
    sweep: { start: 3000, end: 1800, tau: 0.4 },
    vibrato: { rate: 4, depth: 0.015 },
    breath: 0,
    hammer: 0,
    preset: { attack: 0.15, decay: 0.4, sustain: 0.6, release: 1.0 },
    level: 0.65,
    reverb: 0.45
  },
  guitare: {
    family: 'Plucked',
    harmonics: timbreGuitare,
    detunes: [0],
    cutoff: 4000,
    sweep: { start: 5000, end: 1500, tau: 0.25 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.3 },
    level: 0.7,
    reverb: 0.2
  },
  clavecin: {
    family: 'Plucked',
    harmonics: timbreClavecin,
    detunes: [0],
    cutoff: 6000,
    sweep: { start: 8000, end: 3000, tau: 0.1 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.01, decay: 0.2, sustain: 0.05, release: 0.15 },
    level: 0.65,
    reverb: 0.15
  },
  harpe: {
    family: 'Plucked',
    harmonics: timbreHarpe,
    detunes: [0],
    cutoff: 3000,
    sweep: { start: 4000, end: 1500, tau: 0.5 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 1.5 },
    level: 0.55,
    reverb: 0.35
  },
  basse: {
    family: 'Plucked',
    harmonics: timbreBasse,
    detunes: [0],
    cutoff: 800,
    sweep: { start: 1200, end: 500, tau: 0.2 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.2 },
    level: 0.7,
    reverb: 0.1
  },
  hautbois: {
    family: 'Woodwinds',
    harmonics: timbreHautbois,
    detunes: [0],
    cutoff: 3500,
    sweep: { start: 4000, end: 2500, tau: 0.2 },
    vibrato: { rate: 5, depth: 0.01 },
    breath: 0.1,
    hammer: 0,
    preset: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.4 },
    level: 0.6,
    reverb: 0.3
  },
  basson: {
    family: 'Woodwinds',
    harmonics: timbreBasson,
    detunes: [0],
    cutoff: 2000,
    sweep: { start: 2500, end: 1500, tau: 0.3 },
    vibrato: 0,
    breath: 0.05,
    hammer: 0,
    preset: { attack: 0.08, decay: 0.3, sustain: 0.7, release: 0.5 },
    level: 0.6,
    reverb: 0.3
  },
  saxophone: {
    family: 'Woodwinds',
    harmonics: timbreSaxophone,
    detunes: [0],
    cutoff: 3000,
    sweep: { start: 3500, end: 2000, tau: 0.25 },
    vibrato: { rate: 5.5, depth: 0.012 },
    breath: 0.15,
    hammer: 0,
    preset: { attack: 0.05, decay: 0.25, sustain: 0.75, release: 0.4 },
    level: 0.65,
    reverb: 0.25
  },
  trombone: {
    family: 'Brass',
    harmonics: timbreTrombone,
    detunes: [0],
    cutoff: 2500,
    sweep: { start: 3000, end: 1800, tau: 0.4 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.08, decay: 0.3, sustain: 0.8, release: 0.5 },
    level: 0.65,
    reverb: 0.35
  },
  cor: {
    family: 'Brass',
    harmonics: timbreCor,
    detunes: [0],
    cutoff: 1500,
    sweep: { start: 2000, end: 1000, tau: 0.5 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.1, decay: 0.4, sustain: 0.7, release: 0.6 },
    level: 0.6,
    reverb: 0.4
  },
  accordeon: {
    family: 'Reeds & Voices',
    harmonics: timbreAccordeon,
    detunes: [-9, 0, 9],
    cutoff: 4000,
    sweep: 0,
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.3 },
    level: 0.65,
    reverb: 0.2
  },
  harmonica: {
    family: 'Reeds & Voices',
    harmonics: timbreHarmonica,
    detunes: [-4, 0, 4],
    cutoff: 3500,
    sweep: 0,
    vibrato: { rate: 6, depth: 0.02 },
    breath: 0.1,
    hammer: 0,
    preset: { attack: 0.02, decay: 0.2, sustain: 0.8, release: 0.3 },
    level: 0.6,
    reverb: 0.2
  },
  choeur: {
    family: 'Reeds & Voices',
    harmonics: timbreChoeur,
    detunes: [-12, -6, 0, 6, 12],
    cutoff: 2500,
    sweep: { start: 3000, end: 2000, tau: 0.6 },
    vibrato: { rate: 4.5, depth: 0.015 },
    breath: 0.05,
    hammer: 0,
    preset: { attack: 0.2, decay: 0.4, sustain: 0.7, release: 1.2 },
    level: 0.6,
    reverb: 0.5
  },
  vibraphone: {
    family: 'Mallets',
    harmonics: timbreVibraphone,
    detunes: [0],
    cutoff: 5000,
    sweep: 0,
    vibrato: 0,
    breath: 0,
    hammer: 0,
    tremolo: { rate: 5, depth: 0.3 },
    preset: { attack: 0.01, decay: 0.4, sustain: 0.2, release: 1.5 },
    level: 0.6,
    reverb: 0.3
  },
  celesta: {
    family: 'Mallets',
    harmonics: timbreCelesta,
    detunes: [0],
    cutoff: 6000,
    sweep: { start: 8000, end: 4000, tau: 0.1 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.8 },
    level: 0.55,
    reverb: 0.2
  },
  synthLead: {
    family: 'Synth',
    harmonics: timbreSynthLead,
    detunes: [0],
    cutoff: 5000,
    sweep: { start: 6000, end: 3000, tau: 0.2 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.4 },
    level: 0.7,
    reverb: 0.2
  },
  synthScie: {
    family: 'Synth',
    harmonics: timbreSynthScie,
    detunes: [0],
    cutoff: 4000,
    sweep: { start: 5000, end: 2000, tau: 0.3 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.5 },
    level: 0.65,
    reverb: 0.2
  },
  synthPad: {
    family: 'Synth',
    harmonics: timbreSynthPad,
    detunes: [-7, 0, 7],
    cutoff: 2000,
    sweep: { start: 2500, end: 1200, tau: 0.8 },
    vibrato: 0,
    breath: 0,
    hammer: 0,
    preset: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1.5 },
    level: 0.5,
    reverb: 0.5
  }
};

// Expose globally
window.TIMBRES = TIMBRES;
