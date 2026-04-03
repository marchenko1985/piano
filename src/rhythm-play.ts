import "./style.css";
import "./components/piano-keyboard.ts";
import abcjs from "abcjs";
import { MIDIManager } from "./midi.ts";
import { Session } from "./session.ts";
import * as metronome from "./metronome.ts";
import { buildChordNotes, midiToNoteName } from "./chords.ts";

// ── Types ────────────────────────────────────────────────────────────

/** A chord degree: 1=root, 3=third, 5=fifth, 7=seventh, 8=octave */
type Degree = 1 | 3 | 5 | 7 | 8;

interface PlayEvent {
  type: "note" | "rest";
  degrees: Degree[]; // chord tones to play (empty for rests)
  beats: number;
}

interface PlayPattern {
  name: string;
  category: string;
  events: PlayEvent[];
}

interface ScheduledNote {
  expectedTime: number;
  expectedMidi: number[]; // MIDI notes to match
  patternIndex: number; // index into pattern events (for ABC coloring)
  matched: boolean;
}

interface Stats {
  perfect: number;
  good: number;
  ok: number;
  misses: number;
  wrongNote: number;
}

// ── Constants ────────────────────────────────────────────────────────

const COUNT_IN_BEATS = 4;
const PERFECT_WINDOW = 60;
const GOOD_WINDOW = 140;
const EARLY_TOLERANCE = 180;
const LATE_TOLERANCE = 350;
const KEY_RELEASE_MS = 50;

// ── Helpers ──────────────────────────────────────────────────────────

function ev(degrees: Degree[], beats: number): PlayEvent {
  return { type: "note", degrees, beats };
}

function rest(beats: number): PlayEvent {
  return { type: "rest", degrees: [], beats };
}

// ── Patterns ─────────────────────────────────────────────────────────
// All patterns fill one 4/4 measure (4 beats total)

const PATTERNS: PlayPattern[] = [
  // ── Block Chords ──
  {
    name: "Whole chord",
    category: "Block Chords",
    events: [ev([1, 3, 5], 4)],
  },
  {
    name: "Half chords",
    category: "Block Chords",
    events: [ev([1, 3, 5], 2), ev([1, 3, 5], 2)],
  },
  {
    name: "Quarter chords",
    category: "Block Chords",
    events: [ev([1, 3, 5], 1), ev([1, 3, 5], 1), ev([1, 3, 5], 1), ev([1, 3, 5], 1)],
  },
  {
    name: "Chord + rest",
    category: "Block Chords",
    events: [ev([1, 3, 5], 1), rest(1), ev([1, 3, 5], 1), rest(1)],
  },

  // ── Broken Chords ──
  {
    name: "Arpeggio up",
    category: "Broken Chords",
    events: [ev([1], 1), ev([3], 1), ev([5], 1), ev([8], 1)],
  },
  {
    name: "Arpeggio down",
    category: "Broken Chords",
    events: [ev([8], 1), ev([5], 1), ev([3], 1), ev([1], 1)],
  },
  {
    name: "Arpeggio up-down",
    category: "Broken Chords",
    events: [
      ev([1], 0.5),
      ev([3], 0.5),
      ev([5], 0.5),
      ev([8], 0.5),
      ev([5], 0.5),
      ev([3], 0.5),
      ev([5], 0.5),
      ev([8], 0.5),
    ],
  },
  {
    name: "Arpeggio up + chord",
    category: "Broken Chords",
    events: [ev([1], 1), ev([3], 1), ev([5], 1), ev([1, 3, 5], 1)],
  },

  // ── Alberti Bass ──
  {
    name: "Alberti bass",
    category: "Alberti Bass",
    events: [ev([1], 1), ev([5], 1), ev([3], 1), ev([5], 1)],
  },
  {
    name: "Alberti bass (8ths)",
    category: "Alberti Bass",
    events: [
      ev([1], 0.5),
      ev([5], 0.5),
      ev([3], 0.5),
      ev([5], 0.5),
      ev([1], 0.5),
      ev([5], 0.5),
      ev([3], 0.5),
      ev([5], 0.5),
    ],
  },
  {
    name: "Reverse Alberti",
    category: "Alberti Bass",
    events: [ev([5], 1), ev([1], 1), ev([3], 1), ev([1], 1)],
  },

  // ── Walking Bass ──
  {
    name: "Walking bass",
    category: "Walking Bass",
    events: [ev([1], 1), ev([3], 1), ev([5], 1), ev([3], 1)],
  },
  {
    name: "Root-fifth walk",
    category: "Walking Bass",
    events: [ev([1], 1), ev([5], 1), ev([1], 1), ev([5], 1)],
  },
  {
    name: "Bass + octave",
    category: "Walking Bass",
    events: [ev([1], 1), ev([5], 1), ev([8], 1), ev([5], 1)],
  },

  // ── Mixed Patterns ──
  {
    name: "Root + chord stab",
    category: "Mixed",
    events: [ev([1], 1), ev([3, 5], 1), ev([1], 1), ev([3, 5], 1)],
  },
  {
    name: "Bass-chord-chord",
    category: "Mixed",
    events: [ev([1], 2), ev([3, 5], 1), ev([3, 5], 1)],
  },
  {
    name: "Oom-pah",
    category: "Mixed",
    events: [ev([1], 1), ev([3, 5], 1), ev([1], 1), ev([3, 5], 1)],
  },
  {
    name: "Stride (wide)",
    category: "Mixed",
    events: [ev([1], 1), ev([3, 5, 8], 1), ev([1], 1), ev([3, 5, 8], 1)],
  },
];

// ── Chord options ───────────────────────────────────────────────────

// Chord options: { value, label } — value is what buildChordNotes parses,
// label is what the user sees. "C7" is ambiguous (octave 7 vs dominant 7th)
// so dominant 7ths use explicit octave "C47" in value.
const CHORD_OPTIONS: { value: string; label: string }[] = [
  // Triads
  { value: "C", label: "C" },
  { value: "Dm", label: "Dm" },
  { value: "Em", label: "Em" },
  { value: "F", label: "F" },
  { value: "G", label: "G" },
  { value: "Am", label: "Am" },
  { value: "C#", label: "C#" },
  { value: "D", label: "D" },
  { value: "Eb", label: "Eb" },
  { value: "E", label: "E" },
  { value: "Fm", label: "Fm" },
  { value: "F#", label: "F#" },
  { value: "Gm", label: "Gm" },
  { value: "G#", label: "G#" },
  { value: "A", label: "A" },
  { value: "Bb", label: "Bb" },
  { value: "Bm", label: "Bm" },
  { value: "B", label: "B" },
  { value: "Cm", label: "Cm" },
  { value: "D#m", label: "D#m" },
  { value: "F#m", label: "F#m" },
  { value: "G#m", label: "G#m" },
  // Dominant 7ths (explicit octave to avoid "C7" = C-in-octave-7 ambiguity)
  { value: "C47", label: "C7" },
  { value: "D47", label: "D7" },
  { value: "E47", label: "E7" },
  { value: "F47", label: "F7" },
  { value: "G47", label: "G7" },
  { value: "A47", label: "A7" },
  { value: "B47", label: "B7" },
  // Major 7ths & minor 7ths (no ambiguity — suffix starts with letter)
  { value: "Cmaj7", label: "Cmaj7" },
  { value: "Dmaj7", label: "Dmaj7" },
  { value: "Fmaj7", label: "Fmaj7" },
  { value: "Gmaj7", label: "Gmaj7" },
  { value: "Cm7", label: "Cm7" },
  { value: "Dm7", label: "Dm7" },
  { value: "Em7", label: "Em7" },
  { value: "Am7", label: "Am7" },
];

// ── Degree → MIDI resolution ────────────────────────────────────────

function resolveDegreesToMidi(degrees: Degree[], chordNotes: number[]): number[] {
  const root = chordNotes[0];
  return degrees.map((d) => {
    switch (d) {
      case 1:
        return root;
      case 3:
        return chordNotes[1];
      case 5:
        return chordNotes[2];
      case 7:
        return chordNotes.length >= 4 ? chordNotes[3] : chordNotes[2]; // fallback to 5th
      case 8:
        return root + 12;
    }
  });
}

// ── MIDI → ABC notation ─────────────────────────────────────────────

function midiToAbc(midi: number): string {
  const noteNames = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const pitch = midi % 12;
  const name = noteNames[pitch];

  // ABC: C-B = octave 4, c-b = octave 5, C,-B, = octave 3
  if (octave === 4) return name;
  if (octave === 5) return name.replace(/^(\^?)([A-G])/, (_m, acc, n) => acc + n.toLowerCase());
  if (octave === 6)
    return name.replace(/^(\^?)([A-G])/, (_m, acc, n) => acc + n.toLowerCase()) + "'";
  if (octave === 3) return name + ",";
  if (octave === 2) return name + ",,";
  return name; // fallback
}

function beatsToAbcDuration(beats: number): string {
  if (beats === 4) return "4";
  if (beats === 3) return "3";
  if (beats === 2) return "2";
  if (beats === 1.5) return "3/2";
  if (beats === 1) return "";
  if (beats === 0.75) return "3/4";
  if (beats === 0.5) return "/2";
  if (beats === 0.25) return "/4";
  return "";
}

function patternToAbc(events: PlayEvent[], chordNotes: number[]): string {
  const parts = events.map((event) => {
    const dur = beatsToAbcDuration(event.beats);
    if (event.type === "rest") return "z" + dur;
    const midis = resolveDegreesToMidi(event.degrees, chordNotes);
    if (midis.length === 1) return midiToAbc(midis[0]) + dur;
    // Chord: [CEG]
    return "[" + midis.map(midiToAbc).join("") + "]" + dur;
  });

  return ["X:1", "M:4/4", "L:1/4", "K:C clef=treble", "|:" + parts.join(" ") + ":|"].join("\n");
}

// ── DOM ──────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";
app.style.justifyContent = "center";

// Build pattern select options grouped by category
const categories = [...new Set(PATTERNS.map((p) => p.category))];
const patternOptionsHtml = categories
  .map(
    (cat) =>
      `<optgroup label="${cat}">${PATTERNS.map((p, i) => (p.category === cat ? `<option value="${i}">${p.name}</option>` : "")).join("")}</optgroup>`,
  )
  .join("\n");

app.innerHTML = `
  <h1>Rhythm Play</h1>

  <div class="row-sm center" style="flex-wrap: wrap">
    <span class="text-muted">MIDI:</span>
    <span id="midi-status" class="text-muted">initializing...</span>

    <select id="chord-select" class="select" style="width: auto; margin-left: var(--space-md)">
      ${CHORD_OPTIONS.map((c, i) => `<option value="${c.value}"${i === 0 ? " selected" : ""}>${c.label}</option>`).join("\n      ")}
    </select>

    <select id="pattern-select" class="select" style="width: auto">
      ${patternOptionsHtml}
    </select>

    <select id="bpm-select" class="select" style="width: auto">
      <option value="50">50 BPM</option>
      <option value="60">60 BPM</option>
      <option value="70" selected>70 BPM</option>
      <option value="80">80 BPM</option>
      <option value="90">90 BPM</option>
      <option value="100">100 BPM</option>
      <option value="120">120 BPM</option>
      <option value="140">140 BPM</option>
    </select>

    <select id="duration-select" class="select" style="width: auto">
      <option value="60000">1 min</option>
      <option value="120000">2 min</option>
      <option value="180000" selected>3 min</option>
      <option value="300000">5 min</option>
      <option value="600000">10 min</option>
    </select>
  </div>

  <div class="row-sm center">
    <button class="btn btn-secondary btn-sm" id="preview-btn">▶ Preview</button>
    <button class="btn btn-primary" id="start-btn">Start</button>
  </div>

  <div class="stack-sm" style="align-items: center">
    <div id="count-display" style="font-size: var(--text-2xl); font-weight: 700; min-height: 1.4em; color: var(--accent)">&nbsp;</div>

    <div id="beat-dots" style="display: flex; gap: var(--space-sm); justify-content: center; min-height: 20px"></div>

    <div id="sheet" style="min-height: 80px; display: flex; align-items: center; justify-content: center">&nbsp;</div>

    <div id="sweep-container" style="position: relative; width: 500px; max-width: 100%; height: 72px; margin: 0 auto; overflow: hidden">
      <div id="sweep-target" style="
        position: absolute; left: 50%; top: 2px; height: 52px; width: 2px;
        background: var(--accent); z-index: 3;
        transform: translateX(-50%);
      "></div>
      <div id="sweep-track" style="position: absolute; top: 0; left: 0; height: 100%; z-index: 1;"></div>
    </div>

    <div id="feedback" style="font-size: var(--text-lg); font-weight: 600; min-height: 1.6em; transition: color 0.1s">&nbsp;</div>

    <piano-keyboard id="keyboard" start="48" end="84"
      style="height: 120px; width: 600px; max-width: 100%; margin: 0 auto"></piano-keyboard>
  </div>

  <progress id="progress" max="100" value="0"></progress>

  <dialog id="results" class="dialog stack-sm" style="text-align: left">
    <h2 style="text-align: center">Practice Complete</h2>
    <table style="margin: 0 auto">
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Time</th><td id="stat-time">0:00</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">BPM</th><td id="stat-bpm">70</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Perfect</th><td id="stat-perfect">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Good</th><td id="stat-good">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">OK</th><td id="stat-ok">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Missed</th><td id="stat-misses">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Wrong Note</th><td id="stat-wrong">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Accuracy</th><td id="stat-accuracy">100%</td></tr>
    </table>
    <div style="text-align: center">
      <button class="btn btn-primary" id="close-btn">Close</button>
    </div>
  </dialog>
`;

// ── Element refs ─────────────────────────────────────────────────────

const countDisplayEl = document.getElementById("count-display")!;
const beatDotsEl = document.getElementById("beat-dots")!;
const sheetEl = document.getElementById("sheet")!;
const sweepTrack = document.getElementById("sweep-track")!;
const feedbackEl = document.getElementById("feedback")!;
const midiStatusEl = document.getElementById("midi-status")!;
const progressEl = document.getElementById("progress") as HTMLProgressElement;
const resultsDialog = document.getElementById("results") as HTMLDialogElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const previewBtn = document.getElementById("preview-btn") as HTMLButtonElement;
const keyboardEl = document.getElementById("keyboard")!;
const chordSelect = document.getElementById("chord-select") as HTMLSelectElement;
const patternSelect = document.getElementById("pattern-select") as HTMLSelectElement;
const bpmSelect = document.getElementById("bpm-select") as HTMLSelectElement;
const durationSelect = document.getElementById("duration-select") as HTMLSelectElement;

// ── Game state ───────────────────────────────────────────────────────

let gameRunning = false;
let previewing = false;
let session: Session | null = null;
let rafId = 0;

let currentChord = "C";
let currentChordNotes: number[] = [];
let currentPatternIndex = 0;
let currentPattern: PlayPattern = PATTERNS[0];
let currentBpm = 70;

// Timing state
let phase: "idle" | "countdown" | "playing" = "idle";
let countdownBeats = 0;
let countdownStartTime = 0;
let patternStartTime = 0;
let msPerBeat = 60000 / 70;
let totalPatternBeats = 4;
let currentLoop = 0;

// Scheduled notes
let scheduledNotes: ScheduledNote[] = [];
let nextUnmatchedIndex = 0;

// Currently held MIDI notes
const heldNotes = new Set<number>();

// Pre-computed note events (for timing)
let noteEventIndices: number[] = []; // indices of note events in pattern

// SVG reference
let sheetSvg: SVGElement | null = null;
let lastHighlightedAbcIndex = -1;
const eventResultColors = new Map<number, string>();

const stats: Stats = { perfect: 0, good: 0, ok: 0, misses: 0, wrongNote: 0 };

// ── Piano roll ──────────────────────────────────────────────────────

const PX_PER_BEAT = 80;
const SWEEP_WIDTH = 500;
const ROLL_HEIGHT = 56;
const HALF = ROLL_HEIGHT / 2;
const LEAD_IN_BEATS = COUNT_IN_BEATS;

let totalTrackBeats = 0;

// Active user-input rectangle
// Multiple active input rects — one per held MIDI note
const activeInputRects = new Map<number, { el: HTMLDivElement; startBeat: number }>();

function beatCountLabel(beatPos: number): string {
  const beat = Math.floor(beatPos % totalPatternBeats) + 1;
  const frac = Math.round((beatPos - Math.floor(beatPos)) * 4) / 4;
  if (frac === 0) return String(beat);
  if (frac === 0.5) return "&";
  if (frac === 0.25) return "e";
  if (frac === 0.75) return "a";
  return "";
}

function buildFullTrack(events: PlayEvent[], durationMs: number): void {
  sweepTrack.innerHTML = "";
  activeInputRects.clear();

  const totalLoops = Math.ceil(durationMs / (totalPatternBeats * msPerBeat)) + 2;
  totalTrackBeats = LEAD_IN_BEATS + totalLoops * totalPatternBeats;
  const totalWidth = totalTrackBeats * PX_PER_BEAT;
  const patternStart = LEAD_IN_BEATS * PX_PER_BEAT;
  sweepTrack.style.width = `${totalWidth}px`;

  // Mid-line divider
  const mid = document.createElement("div");
  mid.style.cssText = `
    position: absolute; left: 0; top: ${HALF}px;
    width: ${totalWidth}px; height: 1px;
    background: var(--border);
  `;
  sweepTrack.appendChild(mid);

  // Beat grid lines
  for (let b = 0; b <= totalTrackBeats; b++) {
    const patternBeat = b - LEAD_IN_BEATS;
    const isDown = patternBeat >= 0 && patternBeat % totalPatternBeats === 0;
    const gl = document.createElement("div");
    gl.style.cssText = `
      position: absolute; left: ${b * PX_PER_BEAT}px;
      top: 2px; height: ${ROLL_HEIGHT - 4}px; width: ${isDown ? 2 : 1}px;
      background: var(--fg-muted); opacity: ${isDown ? 0.35 : 0.15};
      transform: translateX(-50%);
    `;
    sweepTrack.appendChild(gl);
  }

  // Expected-pattern rectangles + labels
  const releaseGapPx = (KEY_RELEASE_MS / msPerBeat) * PX_PER_BEAT;
  for (let loop = 0; loop < totalLoops; loop++) {
    const loopOffset = patternStart + loop * totalPatternBeats * PX_PER_BEAT;
    let beatPos = 0;
    for (const event of events) {
      const x = loopOffset + beatPos * PX_PER_BEAT;
      if (event.type === "note") {
        const w = event.beats * PX_PER_BEAT;
        const gap = 2;
        const rect = document.createElement("div");
        rect.style.cssText = `
          position: absolute; left: ${x + gap}px; top: ${HALF + 2}px;
          width: ${Math.max(4, w - gap * 2 - releaseGapPx)}px; height: ${HALF - 4}px;
          border-radius: var(--radius-sm);
          background: var(--fg-muted); opacity: 0.2;
        `;
        sweepTrack.appendChild(rect);
      }

      const label = beatCountLabel(beatPos);
      if (label) {
        const el = document.createElement("div");
        el.textContent = label;
        el.style.cssText = `
          position: absolute; left: ${x}px; top: ${ROLL_HEIGHT + 2}px;
          transform: translateX(-50%);
          font-size: 11px; font-weight: 600;
          color: var(--fg-muted); opacity: 0.6;
          white-space: nowrap;
        `;
        sweepTrack.appendChild(el);
      }
      beatPos += event.beats;
    }
  }
}

function buildPreviewTrack(events: PlayEvent[]): void {
  buildFullTrack(events, totalPatternBeats * msPerBeat * 2);
}

function updateSweepPosition(absBeat: number): void {
  const currentPx = absBeat * PX_PER_BEAT;
  sweepTrack.style.transform = `translateX(${SWEEP_WIDTH / 2 - currentPx}px)`;
}

function getAbsBeatPos(): number {
  if (countdownStartTime === 0) return 0;
  return (performance.now() - countdownStartTime) / msPerBeat;
}

function startInputRect(midi: number): void {
  if (phase !== "playing") return;
  // End any existing rect for this same note (re-press)
  endInputRect(midi);

  const startBeat = getAbsBeatPos();
  const x = startBeat * PX_PER_BEAT;
  const rect = document.createElement("div");
  rect.className = "input-rect";
  rect.style.cssText = `
    position: absolute; left: ${x}px; top: 2px;
    width: 4px; height: ${HALF - 4}px;
    border-radius: var(--radius-sm);
    background: var(--fg-muted); opacity: 0.45;
  `;
  sweepTrack.appendChild(rect);
  activeInputRects.set(midi, { el: rect, startBeat });
}

/** Grow all active input rects (called each frame). */
function growAllInputRects(): void {
  const currentBeat = getAbsBeatPos();
  for (const { el, startBeat } of activeInputRects.values()) {
    const durationBeats = currentBeat - startBeat;
    if (durationBeats >= 0) {
      el.style.width = `${Math.max(4, durationBeats * PX_PER_BEAT)}px`;
    }
  }
}

function endInputRect(midi: number): void {
  const entry = activeInputRects.get(midi);
  if (entry) {
    // Final grow before removing
    const durationBeats = getAbsBeatPos() - entry.startBeat;
    if (durationBeats >= 0) {
      entry.el.style.width = `${Math.max(4, durationBeats * PX_PER_BEAT)}px`;
    }
    activeInputRects.delete(midi);
  }
}

// ── Beat dots ────────────────────────────────────────────────────────

function buildBeatDots(): void {
  beatDotsEl.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement("div");
    dot.className = "beat-dot";
    dot.style.cssText = `
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--fg-muted); opacity: 0.3;
      transition: transform 0.08s, opacity 0.08s;
    `;
    dot.dataset.beat = String(i);
    beatDotsEl.appendChild(dot);
  }
}

function updateBeatDots(beat: number): void {
  const dots = beatDotsEl.querySelectorAll<HTMLDivElement>(".beat-dot");
  for (const dot of dots) {
    const b = Number(dot.dataset.beat);
    if (b === beat) {
      dot.style.opacity = "1";
      dot.style.transform = "scale(1.5)";
      dot.style.background = b === 0 ? "var(--accent)" : "var(--fg)";
    } else {
      dot.style.opacity = "0.3";
      dot.style.transform = "scale(1)";
      dot.style.background = "var(--fg-muted)";
    }
  }
}

// ── Pattern & sheet rendering ────────────────────────────────────────

function resolveChord(): void {
  currentChordNotes = buildChordNotes(currentChord) ?? [60, 64, 67];
}

function renderPattern(): void {
  resolveChord();
  const abc = patternToAbc(currentPattern.events, currentChordNotes);
  sheetEl.innerHTML = "";

  abcjs.renderAbc(sheetEl, abc, {
    staffwidth: 280,
    scale: 1.3,
    add_classes: true,
    paddingtop: 0,
    paddingbottom: 0,
    paddingleft: 0,
    paddingright: 0,
  });

  sheetSvg = sheetEl.querySelector("svg");

  // Build note event indices (which pattern indices are notes, for scheduling)
  noteEventIndices = [];
  let beatPos = 0;
  totalPatternBeats = 0;
  currentPattern.events.forEach((event, i) => {
    if (event.type === "note") {
      noteEventIndices.push(i);
    }
    beatPos += event.beats;
  });
  totalPatternBeats = beatPos;

  buildPreviewTrack(currentPattern.events);
  updateKeyboardHighlight();
}

function updateKeyboardHighlight(): void {
  // Show all notes used in the pattern in gray (reference, not action)
  resolveChord();
  const allMidis = new Set<number>();
  for (const event of currentPattern.events) {
    if (event.type === "note") {
      const midis = resolveDegreesToMidi(event.degrees, currentChordNotes);
      for (const m of midis) allMidis.add(m);
    }
  }
  keyboardEl.setAttribute("gray", [...allMidis].join(","));
  keyboardEl.setAttribute("yellow", "");
  keyboardEl.setAttribute("green", "");
  keyboardEl.setAttribute("orange", "");
}

function updateExpectedHighlight(expectedMidi: number[]): void {
  // Highlight currently expected notes in yellow (action), others stay gray (reference)
  resolveChord();
  const allMidis = new Set<number>();
  for (const event of currentPattern.events) {
    if (event.type === "note") {
      const midis = resolveDegreesToMidi(event.degrees, currentChordNotes);
      for (const m of midis) allMidis.add(m);
    }
  }
  const expectedSet = new Set(expectedMidi);
  const grayNotes = [...allMidis].filter((m) => !expectedSet.has(m));
  keyboardEl.setAttribute("gray", grayNotes.join(","));
  keyboardEl.setAttribute("yellow", expectedMidi.join(","));
}

// ── SVG coloring ────────────────────────────────────────────────────

function colorAbcElement(index: number, color: string): void {
  if (!sheetSvg) return;
  const els = sheetSvg.querySelectorAll(`.abcjs-note.abcjs-n${index}, .abcjs-rest.abcjs-n${index}`);
  for (const el of els) {
    (el as SVGElement).setAttribute("fill", color);
    (el as SVGElement).setAttribute("stroke", color);
  }
}

function resetAllColors(): void {
  if (!sheetSvg) return;
  const els = sheetSvg.querySelectorAll(".abcjs-note, .abcjs-rest");
  for (const el of els) {
    (el as SVGElement).removeAttribute("fill");
    (el as SVGElement).removeAttribute("stroke");
  }
  lastHighlightedAbcIndex = -1;
}

function highlightCurrentEvent(abcIndex: number): void {
  if (abcIndex === lastHighlightedAbcIndex) return;

  if (lastHighlightedAbcIndex >= 0 && !eventResultColors.has(lastHighlightedAbcIndex)) {
    colorAbcElement(lastHighlightedAbcIndex, "#000");
  }

  if (!eventResultColors.has(abcIndex)) {
    colorAbcElement(abcIndex, "oklch(0.55 0.2 260)");
  }

  lastHighlightedAbcIndex = abcIndex;
}

// ── Timing engine ────────────────────────────────────────────────────

function scheduleAllNotes(durationMs: number): void {
  scheduledNotes = [];
  resolveChord();

  const totalLoops = Math.ceil(durationMs / (totalPatternBeats * msPerBeat)) + 2;
  for (let loop = 0; loop < totalLoops; loop++) {
    const loopStart = patternStartTime + loop * totalPatternBeats * msPerBeat;
    let beatPos = 0;
    for (let i = 0; i < currentPattern.events.length; i++) {
      const event = currentPattern.events[i];
      if (event.type === "note") {
        const expectedMidi = resolveDegreesToMidi(event.degrees, currentChordNotes);
        scheduledNotes.push({
          expectedTime: loopStart + beatPos * msPerBeat,
          expectedMidi,
          patternIndex: i,
          matched: false,
        });
      }
      beatPos += event.beats;
    }
  }
  nextUnmatchedIndex = 0;
}

function advancePastMissed(now: number): void {
  while (
    nextUnmatchedIndex < scheduledNotes.length &&
    now > scheduledNotes[nextUnmatchedIndex].expectedTime + LATE_TOLERANCE
  ) {
    const note = scheduledNotes[nextUnmatchedIndex];
    note.matched = true;
    stats.misses++;
    eventResultColors.set(note.patternIndex, "#ef4444");
    colorAbcElement(note.patternIndex, "#ef4444");
    nextUnmatchedIndex++;
  }
}

// ── Feedback ────────────────────────────────────────────────────────

let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

function showFeedback(text: string, color: string): void {
  feedbackEl.textContent = text;
  feedbackEl.style.color = color;
  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => {
    feedbackEl.innerHTML = "&nbsp;";
  }, 600);
}

// ── Input handling ──────────────────────────────────────────────────

function handleNoteOn(midi: number, tapTime: number): void {
  if (!gameRunning || phase !== "playing") return;
  session?.activity();
  heldNotes.add(midi);

  // Show pressed key on keyboard
  keyboardEl.setAttribute("orange", [...heldNotes].join(","));

  advancePastMissed(tapTime);

  // Always draw a rect for any key press (shows what the user actually played)
  startInputRect(midi);

  if (nextUnmatchedIndex >= scheduledNotes.length) {
    stats.wrongNote++;
    showFeedback("Extra!", "#ef4444");
    return;
  }

  const note = scheduledNotes[nextUnmatchedIndex];
  const offset = tapTime - note.expectedTime;

  // Check pitch first — wrong pitch is always wrong regardless of timing
  const expectedSet = new Set(note.expectedMidi);
  const isChord = expectedSet.size > 1;

  if (isChord) {
    const allHeld = note.expectedMidi.every((m) => heldNotes.has(m));
    if (!allHeld) {
      if (!expectedSet.has(midi)) {
        stats.wrongNote++;
        showFeedback("Wrong note!", "#ef4444");
      }
      return;
    }
  } else {
    if (!expectedSet.has(midi)) {
      stats.wrongNote++;
      const expected = note.expectedMidi.map((m) => midiToNoteName(m)).join("+");
      showFeedback(`Wrong! (${expected})`, "#ef4444");
      return;
    }
  }

  // Pitch correct — now check timing
  if (offset < -EARLY_TOLERANCE) {
    stats.ok++;
    showFeedback("Too early!", "#fb923c");
    return;
  }

  if (offset > LATE_TOLERANCE) {
    stats.ok++;
    showFeedback("Too late!", "#fb923c");
    return;
  }

  // Pitch correct + timing within tolerance — match!
  note.matched = true;
  const absOffset = Math.abs(offset);
  let text: string;
  let color: string;

  if (absOffset <= PERFECT_WINDOW) {
    text = "Perfect!";
    color = "limegreen";
    stats.perfect++;
  } else if (absOffset <= GOOD_WINDOW) {
    text = "Good!";
    color = "#f59e0b";
    stats.good++;
  } else {
    text = offset > 0 ? "Late" : "Early";
    color = "#fb923c";
    stats.ok++;
  }

  showFeedback(text, color);
  eventResultColors.set(note.patternIndex, color);
  colorAbcElement(note.patternIndex, color);
  nextUnmatchedIndex++;

  // Update keyboard to show next expected notes
  if (nextUnmatchedIndex < scheduledNotes.length) {
    const nextNote = scheduledNotes[nextUnmatchedIndex];
    if (nextNote.expectedTime - tapTime < EARLY_TOLERANCE + 200) {
      updateExpectedHighlight(nextNote.expectedMidi);
    }
  }
}

function handleNoteOff(midi: number): void {
  heldNotes.delete(midi);
  keyboardEl.setAttribute("orange", [...heldNotes].join(","));
  endInputRect(midi);
}

// ── Game loop ───────────────────────────────────────────────────────

function gameLoop(): void {
  if (!gameRunning) return;
  rafId = requestAnimationFrame(gameLoop);

  const now = performance.now();
  const absBeat = (now - countdownStartTime) / msPerBeat;
  updateSweepPosition(absBeat);

  if (phase !== "playing") return;

  const elapsed = now - patternStartTime;

  // Track loop for notation reset
  const totalLoopMs = totalPatternBeats * msPerBeat;
  const loopIndex = Math.floor(elapsed / totalLoopMs);
  if (loopIndex > currentLoop) {
    currentLoop = loopIndex;
    eventResultColors.clear();
    resetAllColors();
  }

  growAllInputRects();

  // Current event highlighting
  const posInLoop = elapsed - currentLoop * totalLoopMs;
  const beatPos = posInLoop / msPerBeat;

  let currentAbcIndex = 0;
  let cumBeats = 0;
  for (let i = 0; i < currentPattern.events.length; i++) {
    if (cumBeats <= beatPos) currentAbcIndex = i;
    cumBeats += currentPattern.events[i].beats;
  }
  highlightCurrentEvent(currentAbcIndex);

  // Update expected note highlighting on keyboard (show ~half a beat before)
  if (nextUnmatchedIndex < scheduledNotes.length) {
    const nextNote = scheduledNotes[nextUnmatchedIndex];
    if (now >= nextNote.expectedTime - msPerBeat / 2) {
      updateExpectedHighlight(nextNote.expectedMidi);
    }
  }

  advancePastMissed(now);
}

// ── Session ─────────────────────────────────────────────────────────

function createSession(): Session {
  return new Session({
    totalDuration: Number(durationSelect.value),
    inactivityTimeout: 30_000,
    progressElement: progressEl,
    onEnd: endSession,
  });
}

function endSession(): void {
  if (!gameRunning) return;
  gameRunning = false;
  phase = "idle";

  metronome.stop();
  cancelAnimationFrame(rafId);
  heldNotes.clear();
  keyboardEl.setAttribute("orange", "");

  updateStatsDisplay();
  updateStartButton();
  resultsDialog.showModal();
  updateKeyboardHighlight();
}

function updateStatsDisplay(): void {
  const elapsed = session?.elapsed ?? 0;
  const secs = Math.floor(elapsed / 1000);
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;

  document.getElementById("stat-time")!.textContent = `${mins}:${String(remSecs).padStart(2, "0")}`;
  document.getElementById("stat-bpm")!.textContent = String(currentBpm);
  document.getElementById("stat-perfect")!.textContent = String(stats.perfect);
  document.getElementById("stat-good")!.textContent = String(stats.good);
  document.getElementById("stat-ok")!.textContent = String(stats.ok);
  document.getElementById("stat-misses")!.textContent = String(stats.misses);
  document.getElementById("stat-wrong")!.textContent = String(stats.wrongNote);

  const total = stats.perfect + stats.good + stats.ok + stats.misses;
  const hits = stats.perfect + stats.good + stats.ok;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 100;
  document.getElementById("stat-accuracy")!.textContent = `${accuracy}%`;
}

// ── Start / Stop ────────────────────────────────────────────────────

function updateStartButton(): void {
  const busy = gameRunning || previewing;
  startBtn.textContent = gameRunning ? "Stop" : "Start";
  startBtn.disabled = previewing;
  chordSelect.disabled = busy;
  patternSelect.disabled = busy;
  bpmSelect.disabled = busy;
  durationSelect.disabled = busy;
  previewBtn.disabled = busy;
}

function startGame(): void {
  stats.perfect = 0;
  stats.good = 0;
  stats.ok = 0;
  stats.misses = 0;
  stats.wrongNote = 0;

  currentChord = chordSelect.value;
  currentBpm = Number(bpmSelect.value);
  msPerBeat = 60000 / currentBpm;
  currentPatternIndex = Number(patternSelect.value);
  currentPattern = PATTERNS[currentPatternIndex];

  renderPattern();
  buildFullTrack(currentPattern.events, Number(durationSelect.value));

  gameRunning = true;
  phase = "countdown";
  countdownBeats = 0;
  countdownStartTime = performance.now();
  currentLoop = 0;
  lastHighlightedAbcIndex = -1;
  eventResultColors.clear();
  heldNotes.clear();

  session?.destroy();
  session = createSession();
  session.start();

  updateStartButton();
  buildBeatDots();

  void metronome.start({
    bpm: currentBpm,
    beatsPerMeasure: 4,
    onBeat: (beat) => {
      if (!gameRunning) return;
      updateBeatDots(beat);

      if (phase === "countdown") {
        countdownBeats++;
        countDisplayEl.textContent = String(countdownBeats);

        if (countdownBeats >= COUNT_IN_BEATS) {
          phase = "playing";
          patternStartTime = countdownStartTime + LEAD_IN_BEATS * msPerBeat;
          countDisplayEl.innerHTML = "&nbsp;";
          scheduleAllNotes(Number(durationSelect.value));
        }
      }
    },
  });

  rafId = requestAnimationFrame(gameLoop);
}

function stopGame(): void {
  endSession();
}

startBtn.addEventListener("click", () => {
  if (gameRunning) stopGame();
  else startGame();
});

// ── MIDI input ──────────────────────────────────────────────────────

function onMIDIMessage(event: MIDIMessageEvent): void {
  const [status, note, velocity] = event.data!;
  const command = status >> 4;
  if (command === 9 && velocity > 0) {
    handleNoteOn(note, performance.now());
  } else if (command === 8 || (command === 9 && velocity === 0)) {
    handleNoteOff(note);
  }
}

// ── Preview ─────────────────────────────────────────────────────────

let previewRafId = 0;
let previewStartTime = 0;
let previewLoops = 0;

function startPreview(): void {
  if (gameRunning || previewing) return;

  previewing = true;
  currentBpm = Number(bpmSelect.value);
  msPerBeat = 60000 / currentBpm;
  previewLoops = 0;
  previewStartTime = 0;

  currentChord = chordSelect.value;
  currentPatternIndex = Number(patternSelect.value);
  currentPattern = PATTERNS[currentPatternIndex];
  renderPattern();
  updateStartButton();
  previewBtn.textContent = "■ Stop";
  buildBeatDots();

  let countdownBeatsPreview = 0;
  let previewPhase: "countdown" | "playing" = "countdown";
  const previewCountdownStart = performance.now();

  void metronome.start({
    bpm: currentBpm,
    beatsPerMeasure: 4,
    onBeat: (beat) => {
      if (!previewing) return;
      updateBeatDots(beat);

      if (previewPhase === "countdown") {
        countdownBeatsPreview++;
        countDisplayEl.textContent = String(countdownBeatsPreview);

        if (countdownBeatsPreview >= COUNT_IN_BEATS) {
          previewPhase = "playing";
          previewStartTime = previewCountdownStart + LEAD_IN_BEATS * msPerBeat;
          countDisplayEl.innerHTML = "&nbsp;";
        }
      }
    },
  });

  function previewLoop(): void {
    if (!previewing) return;
    previewRafId = requestAnimationFrame(previewLoop);

    const now = performance.now();
    const absBeat = (now - previewCountdownStart) / msPerBeat;
    updateSweepPosition(absBeat);

    if (previewPhase !== "playing") return;

    const elapsed = now - previewStartTime;
    if (elapsed < 0) return;

    const totalLoopMs = totalPatternBeats * msPerBeat;
    const loopIndex = Math.floor(elapsed / totalLoopMs);

    if (loopIndex >= 2) {
      stopPreview();
      return;
    }

    if (loopIndex > previewLoops) {
      previewLoops = loopIndex;
      resetAllColors();
    }

    const posInLoop = elapsed - loopIndex * totalLoopMs;
    const beatPos = posInLoop / msPerBeat;
    let currentAbcIndex = 0;
    let cumBeats = 0;
    for (let i = 0; i < currentPattern.events.length; i++) {
      if (cumBeats <= beatPos) currentAbcIndex = i;
      cumBeats += currentPattern.events[i].beats;
    }
    highlightCurrentEvent(currentAbcIndex);
  }

  previewRafId = requestAnimationFrame(previewLoop);
}

function stopPreview(): void {
  previewing = false;
  metronome.stop();
  cancelAnimationFrame(previewRafId);
  countDisplayEl.innerHTML = "&nbsp;";
  previewBtn.textContent = "▶ Preview";
  resetAllColors();
  updateSweepPosition(0);
  updateStartButton();
  updateKeyboardHighlight();
}

previewBtn.addEventListener("click", () => {
  if (previewing) stopPreview();
  else startPreview();
});

// ── Settings persistence ────────────────────────────────────────────

const savedChord = localStorage.getItem("rhythm-play-chord");
if (savedChord && chordSelect.querySelector(`option[value="${CSS.escape(savedChord)}"]`)) {
  chordSelect.value = savedChord;
  currentChord = savedChord;
}

const savedPattern = localStorage.getItem("rhythm-play-pattern");
if (savedPattern && Number(savedPattern) < PATTERNS.length) {
  patternSelect.value = savedPattern;
  currentPatternIndex = Number(savedPattern);
  currentPattern = PATTERNS[currentPatternIndex];
}

const savedBpm = localStorage.getItem("rhythm-play-bpm");
if (savedBpm && bpmSelect.querySelector(`option[value="${savedBpm}"]`)) {
  bpmSelect.value = savedBpm;
  currentBpm = Number(savedBpm);
}

chordSelect.addEventListener("change", () => {
  currentChord = chordSelect.value;
  localStorage.setItem("rhythm-play-chord", currentChord);
  if (!gameRunning && !previewing) renderPattern();
});

patternSelect.addEventListener("change", () => {
  currentPatternIndex = Number(patternSelect.value);
  currentPattern = PATTERNS[currentPatternIndex];
  localStorage.setItem("rhythm-play-pattern", patternSelect.value);
  if (!gameRunning && !previewing) renderPattern();
});

bpmSelect.addEventListener("change", () => {
  currentBpm = Number(bpmSelect.value);
  localStorage.setItem("rhythm-play-bpm", bpmSelect.value);
});

// ── Dialog close ────────────────────────────────────────────────────

document.getElementById("close-btn")!.addEventListener("click", () => {
  resultsDialog.close();
});

// ── Init ────────────────────────────────────────────────────────────

const midiManager = new MIDIManager({
  onMessage: onMIDIMessage,
  onConnectionChange: (connected, deviceName) => {
    midiStatusEl.textContent = connected ? deviceName : "not connected";
    if (!connected) session?.pause();
  },
});

void midiManager.initialize();

buildBeatDots();
renderPattern();
