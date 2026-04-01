/**
 * Metronome module using Web Audio API.
 *
 * Uses a lookahead scheduler for rock-solid timing. JavaScript timers
 * (setTimeout/setInterval) are imprecise (~4-16ms jitter), so we
 * schedule clicks ahead of time using AudioContext.currentTime, which
 * runs on the audio hardware clock.
 *
 * ## Scheduling approach
 *
 * A setInterval loop runs every ~25ms. On each tick it looks ahead
 * (SCHEDULE_AHEAD = 100ms) and schedules any beats that fall within
 * that window using osc.start(exactTime). This gives the audio thread
 * enough time to prepare the click while keeping latency low.
 *
 * ## Click sound
 *
 * Short sine oscillator burst (30ms for downbeat, 20ms for other beats).
 * Downbeat is higher pitched (1000Hz) and louder (0.5) than off-beats
 * (800Hz, 0.3) so the "one" is always audible.
 *
 * ## Time signature
 *
 * `beatsPerMeasure` defines the grouping. Beat 0 is the downbeat (accent).
 * Common values: 4 (4/4 time), 3 (3/4 waltz), 6 (6/8 feel).
 */

// ── State ──────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let timerHandle: ReturnType<typeof setInterval> | null = null;
let nextBeatTime = 0;
let currentBeat = 0;
let _bpm = 120;
let _beatsPerMeasure = 4;
let _running = false;
let _onBeat: ((beat: number, downbeat: boolean) => void) | null = null;

// ── Constants ──────────────────────────────────────────────────────

const SCHEDULE_AHEAD = 0.1; // seconds — how far ahead to schedule
const TIMER_INTERVAL = 25; // ms — how often the scheduler runs

// ── Audio context ──────────────────────────────────────────────────

async function ensureContext(): Promise<AudioContext> {
  if (!ctx) {
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

// ── Click synthesis ────────────────────────────────────────────────

function scheduleClick(audio: AudioContext, time: number, isDownbeat: boolean): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();

  // Downbeat: higher pitch, louder. Off-beat: lower, softer.
  osc.frequency.value = isDownbeat ? 1000 : 800;
  osc.type = "sine";

  const duration = isDownbeat ? 0.03 : 0.02;
  const volume = isDownbeat ? 0.5 : 0.3;

  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(time);
  osc.stop(time + duration);
}

// ── Scheduler ──────────────────────────────────────────────────────

function scheduler(): void {
  if (!ctx) return;

  const secondsPerBeat = 60 / _bpm;

  while (nextBeatTime < ctx.currentTime + SCHEDULE_AHEAD) {
    const isDownbeat = currentBeat === 0;
    scheduleClick(ctx, nextBeatTime, isDownbeat);

    // Notify callback (used by debug page for visual feedback)
    if (_onBeat) {
      const beat = currentBeat;
      const delay = Math.max(0, (nextBeatTime - ctx.currentTime) * 1000);
      setTimeout(() => _onBeat!(beat, beat === 0), delay);
    }

    nextBeatTime += secondsPerBeat;
    currentBeat = (currentBeat + 1) % _beatsPerMeasure;
  }
}

// ── Public API ─────────────────────────────────────────────────────

export interface MetronomeOptions {
  bpm?: number;
  beatsPerMeasure?: number;
  onBeat?: (beat: number, downbeat: boolean) => void;
}

/**
 * Start the metronome. If already running, restarts with new options.
 */
export async function start(options: MetronomeOptions = {}): Promise<void> {
  stop();

  if (options.bpm !== undefined) _bpm = options.bpm;
  if (options.beatsPerMeasure !== undefined) _beatsPerMeasure = options.beatsPerMeasure;
  if (options.onBeat !== undefined) _onBeat = options.onBeat;

  const audio = await ensureContext();
  currentBeat = 0;
  nextBeatTime = audio.currentTime + 0.05; // small delay to let scheduler catch up
  _running = true;

  timerHandle = setInterval(scheduler, TIMER_INTERVAL);
}

/**
 * Stop the metronome.
 */
export function stop(): void {
  if (timerHandle !== null) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
  _running = false;
}

/**
 * Whether the metronome is currently running.
 */
export function isRunning(): boolean {
  return _running;
}

/**
 * Update BPM while running (takes effect on next beat).
 */
export function setBpm(bpm: number): void {
  _bpm = bpm;
}

/**
 * Get current BPM.
 */
export function getBpm(): number {
  return _bpm;
}

/**
 * Update beats per measure while running (resets beat counter).
 */
export function setBeatsPerMeasure(beats: number): void {
  _beatsPerMeasure = beats;
  currentBeat = 0;
}
