/**
 * Web Audio API oscillator synthesis module.
 *
 * Generates sound in real-time using OscillatorNode — no samples needed.
 * Good for: UI feedback, metronome clicks, previews, and low-latency playback.
 * For realistic piano sound, use the SoundFont module instead.
 *
 * ## Web Audio vs SoundFont
 *
 * - **Web Audio (this module):** Generates waveforms mathematically. Tiny footprint,
 *   instant startup, but sounds synthetic. Triangle wave is warmer than sine,
 *   with odd harmonics that approximate a muted string sound.
 *
 * - **SoundFont (`soundfont.ts`):** Plays back pre-recorded piano samples (~2.5 MB).
 *   Sounds realistic but requires fetching + decoding all 88 samples before first use.
 *
 * ## ADSR Envelope
 *
 * Each note uses a simplified ADSR (Attack-Decay-Sustain-Release) envelope on
 * a GainNode to shape the volume over time:
 *
 *   Attack  (5ms)  — volume spikes from 0 → 0.4 (percussive transient)
 *   Decay   (75ms) — settles to sustain level 0.2
 *   Sustain        — holds at 0.2 until stop() is called
 *   Release (80ms) — fades to 0 via exponentialRampToValueAtTime
 *
 * The sharp attack spike is critical for making repeated same-note sequences
 * audible — without it, two consecutive C4s sound like one continuous tone.
 *
 * ## Single note vs sequence playback
 *
 * - **Interactive (mouse/MIDI):** Call `startNote()` on key-down, `handle.stop()`
 *   on key-up. The note sustains as long as held.
 *
 * - **Programmatic sequences:** Call `startNote()`, wait the note duration, then
 *   `handle.stop()`. Add a ~50ms gap between steps so the release envelope
 *   completes before the next attack — especially important for repeated notes.
 *
 * - **Race condition:** `startNote()` is async (AudioContext creation). If stop()
 *   is needed before the promise resolves, track a boolean flag and call
 *   `handle.stop()` inside the .then() callback when the flag is already false.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface NoteHandle {
  stop(): void;
}

// ── Audio context ───────────────────────────────────────────────────

let ctx: AudioContext | null = null;

async function ensureContext(): Promise<AudioContext> {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

// ── Frequency conversion ────────────────────────────────────────────

function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

// ── Playback ────────────────────────────────────────────────────────

const FADE_OUT = 0.08; // release duration in seconds

/**
 * Start playing a note. Returns a handle to stop it.
 * The note sustains indefinitely until stop() is called.
 */
export async function startNote(midi: number): Promise<NoteHandle> {
  const audio = await ensureContext();

  const frequency = midiToFrequency(midi);
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  // Triangle wave: odd harmonics only, warmer than sine, less harsh than square
  osc.type = "triangle";
  osc.frequency.value = frequency;

  // ADSR envelope (attack + decay; sustain until stop; release in stop())
  const now = audio.currentTime;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.4, now + 0.005); // attack: 5ms spike
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.08); // decay: settle to sustain

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start();

  return {
    stop() {
      // Release: ramp to silence over FADE_OUT, then stop oscillator
      gain.gain.setValueAtTime(gain.gain.value, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + FADE_OUT);
      osc.stop(audio.currentTime + FADE_OUT);
    },
  };
}

/**
 * Start playing multiple notes simultaneously (chord).
 * Returns a handle to stop all notes.
 */
export async function startChord(midiNotes: readonly number[]): Promise<NoteHandle> {
  const handles = await Promise.all(midiNotes.map((note) => startNote(note)));
  return {
    stop() {
      for (const h of handles) h.stop();
    },
  };
}
