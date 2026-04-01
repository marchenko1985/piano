/**
 * SoundFont-based piano playback module.
 *
 * Plays back pre-recorded MP3 piano samples for realistic sound.
 * Source: midi-js-soundfonts (acoustic_grand_piano, 88 keys, ~2.5 MB).
 *
 * ## Two-phase loading
 *
 * Chrome blocks AudioContext creation before a user gesture, so loading
 * is split into two steps:
 *
 * 1. `fetchSoundfont()` — loads the JS file with base64 MP3 data.
 *    Safe to call on page load (no AudioContext needed).
 *
 * 2. `decodeSamples()` — creates AudioContext and decodes all 88 samples
 *    into AudioBuffers. Called automatically on first `startNote()`.
 *    Must happen inside a user gesture (click/keydown).
 *
 * ## Note name mapping
 *
 * The soundfont uses flat notation (Db, Eb, Gb, Ab, Bb) — not sharps.
 * MIDI numbers are converted via `midiToSoundfontName()`.
 *
 * ## Release / fade-out
 *
 * Piano samples have a natural decay baked in, but `stop()` cuts them
 * abruptly. A GainNode with 500ms exponential ramp provides a smooth
 * release. This is longer than the oscillator module (80ms) because
 * piano samples sound unnatural with a short cutoff.
 */

import type { NoteHandle } from "./audio.ts";

// ── Types ──────────────────────────────────────────────────────────

declare global {
  interface Window {
    MIDI?: {
      Soundfont?: {
        acoustic_grand_piano?: Record<string, string>;
      };
    };
  }
}

// ── State ──────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
const buffers: Map<string, AudioBuffer> = new Map();
let scriptLoaded = false;
let decoded = false;
let decoding: Promise<void> | null = null;

// ── Note name conversion ───────────────────────────────────────────

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function midiToSoundfontName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  return NOTE_NAMES[midi % 12] + octave;
}

// ── Loading ────────────────────────────────────────────────────────

async function ensureContext(): Promise<AudioContext> {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

/**
 * Fetch the soundfont JS file (no AudioContext needed).
 * Safe to call on page load — doesn't require user gesture.
 */
export async function fetchSoundfont(): Promise<void> {
  if (scriptLoaded) return;
  if (window.MIDI?.Soundfont?.acoustic_grand_piano) {
    scriptLoaded = true;
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = import.meta.env.BASE_URL + "acoustic_grand_piano-mp3.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load soundfont"));
    document.head.appendChild(script);
  });

  scriptLoaded = true;
}

/**
 * Decode all samples into AudioBuffers. Requires user gesture (AudioContext).
 * Call fetchSoundfont() first, then call this on first user interaction.
 */
async function decodeSamples(): Promise<void> {
  if (decoded) return;
  if (decoding) return decoding;

  decoding = (async () => {
    const audio = await ensureContext();

    const samples = window.MIDI?.Soundfont?.acoustic_grand_piano;
    if (!samples) throw new Error("Soundfont data not found — call fetchSoundfont() first");

    const entries = Object.entries(samples);
    await Promise.all(
      entries.map(async ([note, dataUri]) => {
        const base64 = dataUri.split(",")[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const audioBuffer = await audio.decodeAudioData(bytes.buffer);
        buffers.set(note, audioBuffer);
      }),
    );

    decoded = true;
  })();

  return decoding;
}

/**
 * Whether the soundfont has been fully loaded and decoded.
 */
export function isReady(): boolean {
  return decoded;
}

/**
 * Whether the script has been fetched (but maybe not yet decoded).
 */
export function isFetched(): boolean {
  return scriptLoaded;
}

// ── Playback ───────────────────────────────────────────────────────

const FADE_OUT = 0.5;

async function ensureReady(): Promise<void> {
  if (!scriptLoaded) await fetchSoundfont();
  if (!decoded) await decodeSamples();
}

/**
 * Start playing a note using the piano soundfont.
 * On first call, decodes samples (requires user gesture).
 */
export async function startNote(midi: number): Promise<NoteHandle> {
  await ensureReady();
  const audio = await ensureContext();

  const name = midiToSoundfontName(midi);
  const buffer = buffers.get(name);
  if (!buffer) return { stop() {} };

  const src = audio.createBufferSource();
  const gain = audio.createGain();
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(audio.destination);
  src.start();

  return {
    stop() {
      gain.gain.setValueAtTime(gain.gain.value, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + FADE_OUT);
      src.stop(audio.currentTime + FADE_OUT);
    },
  };
}

/**
 * Start playing multiple notes simultaneously (chord).
 */
export async function startChord(midiNotes: readonly number[]): Promise<NoteHandle> {
  const handles = await Promise.all(midiNotes.map((note) => startNote(note)));
  return {
    stop() {
      for (const h of handles) h.stop();
    },
  };
}
