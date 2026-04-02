import "./style.css";
import abcjs from "abcjs";
import { MIDIManager } from "./midi.ts";
import { Session } from "./session.ts";
import * as metronome from "./metronome.ts";

// ── Types ────────────────────────────────────────────────────────────

interface RhythmEvent {
  type: "note" | "rest";
  beats: number;
}

interface Level {
  name: string;
  patterns: RhythmEvent[][];
}

interface ScheduledNote {
  expectedTime: number;
  abcIndex: number;
  matched: boolean;
}

interface Stats {
  perfect: number;
  good: number;
  ok: number;
  misses: number;
  extras: number;
}

// ── Constants ────────────────────────────────────────────────────────

const COUNT_IN_BEATS = 4;
const PERFECT_WINDOW = 60; // ms
const GOOD_WINDOW = 140;
const EARLY_TOLERANCE = 180; // how early you can tap before the beat
const LATE_TOLERANCE = 350; // how late you can tap after the beat (generous — people react to beats)
const KEY_RELEASE_MS = 50; // visual gap at end of expected rects for key release time

// ── Helpers ──────────────────────────────────────────────────────────

function n(beats: number): RhythmEvent {
  return { type: "note", beats };
}

function r(beats: number): RhythmEvent {
  return { type: "rest", beats };
}

// ── Patterns ─────────────────────────────────────────────────────────
// All patterns fill one 4/4 measure (4 beats total)

const LEVELS: Level[] = [
  {
    name: "Whole & Half",
    patterns: [
      [n(4)],
      [n(2), n(2)],
      [n(2), n(1), n(1)],
      [n(1), n(1), n(2)],
      [n(2), r(2)],
      [n(2), r(1), n(1)],
      [n(1), r(1), n(2)],
      [n(3), n(1)],
      [n(1), n(3)],
      [r(2), n(2)],
    ],
  },
  {
    name: "Quarter Notes",
    patterns: [
      [n(1), n(1), n(1), n(1)],
      [n(1), n(2), n(1)],
      [n(1), r(1), n(1), r(1)],
      [n(1), n(1), r(1), n(1)],
      [r(1), n(1), n(1), n(1)],
      [n(1), r(1), n(1), n(1)],
      [n(1), n(1), n(1), r(1)],
      [n(2), n(1), n(1)],
      [n(1), n(1), n(2)],
      [r(1), n(1), r(1), n(1)],
      [n(1), r(2), n(1)],
      [r(1), n(1), n(2)],
    ],
  },
  {
    name: "Eighth Notes",
    patterns: [
      [n(0.5), n(0.5), n(0.5), n(0.5), n(1), n(1)],
      [n(1), n(0.5), n(0.5), n(1), n(0.5), n(0.5)],
      [n(0.5), n(0.5), n(1), n(0.5), n(0.5), n(1)],
      [n(0.5), n(0.5), n(0.5), n(0.5), n(0.5), n(0.5), n(0.5), n(0.5)],
      [n(1), n(1), n(0.5), n(0.5), n(0.5), n(0.5)],
      [n(0.5), n(0.5), n(0.5), n(0.5), n(2)],
      [n(2), n(0.5), n(0.5), n(0.5), n(0.5)],
      [n(0.5), n(0.5), n(1), n(1), n(1)],
      [n(1), n(1), n(1), n(0.5), n(0.5)],
      [n(0.5), n(1), n(0.5), n(1), n(1)],
      [n(0.5), n(0.5), r(1), n(0.5), n(0.5), n(1)],
      [n(1), n(0.5), n(0.5), n(0.5), n(0.5), n(1)],
    ],
  },
  {
    name: "Dotted Patterns",
    patterns: [
      [n(1.5), n(0.5), n(1.5), n(0.5)],
      [n(1.5), n(0.5), n(1), n(1)],
      [n(3), n(1)],
      [n(0.5), n(1.5), n(0.5), n(1.5)],
      [n(1), n(1), n(1.5), n(0.5)],
      [n(1.5), n(0.5), n(0.5), n(1.5)],
      [n(0.5), n(1.5), n(1), n(1)],
      [n(1), n(1.5), n(0.5), n(1)],
      [n(1.5), n(1.5), n(0.5), n(0.5)],
      [n(0.5), n(0.5), n(1.5), n(0.5), n(1)],
    ],
  },
  {
    name: "Syncopation",
    patterns: [
      [r(0.5), n(0.5), r(0.5), n(0.5), r(0.5), n(0.5), r(0.5), n(0.5)],
      [n(0.5), n(1), n(0.5), n(0.5), n(1), n(0.5)],
      [n(1), n(0.5), r(0.5), n(1), n(1)],
      [r(0.5), n(1), n(0.5), n(1), n(1)],
      [n(0.5), n(1), n(1), n(1), n(0.5)],
      [r(0.5), n(0.5), n(1), r(0.5), n(0.5), n(1)],
      [n(0.5), r(0.5), n(0.5), n(0.5), n(1), n(1)],
      [n(1), r(0.5), n(1.5), n(1)],
      [r(0.5), n(1.5), r(0.5), n(1.5)],
      [n(0.5), n(0.5), r(0.5), n(1), n(0.5), n(1)],
    ],
  },
  {
    name: "Sixteenth Notes",
    patterns: [
      [n(0.25), n(0.25), n(0.25), n(0.25), n(1), n(1), n(1)],
      [n(1), n(0.25), n(0.25), n(0.25), n(0.25), n(2)],
      [n(0.5), n(0.25), n(0.25), n(0.5), n(0.25), n(0.25), n(1), n(1)],
      [n(1), n(1), n(0.25), n(0.25), n(0.25), n(0.25), n(1)],
      [n(0.25), n(0.25), n(0.25), n(0.25), n(0.25), n(0.25), n(0.25), n(0.25), n(2)],
      [n(2), n(0.25), n(0.25), n(0.25), n(0.25), n(1)],
      [n(0.25), n(0.25), n(0.5), n(1), n(0.25), n(0.25), n(0.5), n(1)],
      [n(1), n(0.25), n(0.25), n(0.5), n(1), n(1)],
      [n(0.5), n(0.5), n(0.25), n(0.25), n(0.25), n(0.25), n(0.5), n(0.5), n(1)],
      [n(0.25), n(0.75), n(0.25), n(0.75), n(1), n(1)],
    ],
  },
];

// ── ABC generation ───────────────────────────────────────────────────

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

function eventToAbc(event: RhythmEvent): string {
  const pitch = event.type === "note" ? "B" : "z";
  return pitch + beatsToAbcDuration(event.beats);
}

function patternToAbc(events: RhythmEvent[]): string {
  return [
    "X:1",
    "M:4/4",
    "L:1/4",
    "K:C clef=treble",
    "|:" + events.map(eventToAbc).join(" ") + ":|",
  ].join("\n");
}

// ── DOM ──────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";
app.style.justifyContent = "center";

app.innerHTML = `
  <h1>Rhythm Tap</h1>

  <div class="row-sm center" style="flex-wrap: wrap">
    <span class="text-muted">MIDI:</span>
    <span id="midi-status" class="text-muted">initializing...</span>

    <select id="level-select" class="select" style="width: auto; margin-left: var(--space-md)">
      ${LEVELS.map((l, i) => `<option value="${i}"${i === 1 ? " selected" : ""}>${l.name}</option>`).join("\n      ")}
    </select>

    <select id="bpm-select" class="select" style="width: auto">
      <option value="60">60 BPM</option>
      <option value="70">70 BPM</option>
      <option value="80" selected>80 BPM</option>
      <option value="90">90 BPM</option>
      <option value="100">100 BPM</option>
      <option value="120">120 BPM</option>
      <option value="140">140 BPM</option>
      <option value="160">160 BPM</option>
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
    <button class="btn btn-ghost btn-sm" id="prev-pattern-btn" title="Previous pattern">◀</button>
    <span id="pattern-label" class="text-muted" style="min-width: 80px; text-align: center">1 / 3</span>
    <button class="btn btn-ghost btn-sm" id="next-pattern-btn" title="Next pattern">▶</button>
    <button class="btn btn-secondary btn-sm" id="preview-btn">▶ Preview</button>
    <button class="btn btn-primary" id="start-btn">Start</button>
  </div>

  <div class="stack-sm" style="align-items: center; min-height: 220px">
    <div id="count-display" style="font-size: var(--text-2xl); font-weight: 700; min-height: 1.6em; color: var(--accent)">&nbsp;</div>

    <div id="beat-dots" style="display: flex; gap: var(--space-sm); justify-content: center; min-height: 24px"></div>

    <div id="sheet" style="min-height: 100px; display: flex; align-items: center; justify-content: center">&nbsp;</div>

    <div id="sweep-container" style="position: relative; width: 500px; max-width: 100%; height: 72px; margin: 0 auto; overflow: hidden">
      <div id="sweep-target" style="
        position: absolute; left: 50%; top: 2px; height: 52px; width: 2px;
        background: var(--accent); z-index: 3;
        transform: translateX(-50%);
      "></div>
      <div id="sweep-track" style="position: absolute; top: 0; left: 0; height: 100%; z-index: 1;"></div>
    </div>

    <div id="feedback" style="font-size: var(--text-lg); font-weight: 600; min-height: 1.6em; transition: color 0.1s">&nbsp;</div>
  </div>

  <div class="text-muted" style="font-size: var(--text-sm); text-align: center">
    spacebar · any MIDI key · click anywhere
  </div>

  <progress id="progress" max="100" value="0"></progress>

  <dialog id="results" class="dialog stack-sm" style="text-align: left">
    <h2 style="text-align: center">Practice Complete</h2>
    <table style="margin: 0 auto">
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Time</th><td id="stat-time">0:00</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">BPM</th><td id="stat-bpm">80</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Perfect</th><td id="stat-perfect">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Good</th><td id="stat-good">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">OK</th><td id="stat-ok">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Missed</th><td id="stat-misses">0</td></tr>
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
const prevPatternBtn = document.getElementById("prev-pattern-btn") as HTMLButtonElement;
const nextPatternBtn = document.getElementById("next-pattern-btn") as HTMLButtonElement;
const previewBtn = document.getElementById("preview-btn") as HTMLButtonElement;
const patternLabel = document.getElementById("pattern-label")!;
const levelSelect = document.getElementById("level-select") as HTMLSelectElement;
const bpmSelect = document.getElementById("bpm-select") as HTMLSelectElement;
const durationSelect = document.getElementById("duration-select") as HTMLSelectElement;

// ── Game state ───────────────────────────────────────────────────────

let gameRunning = false;
let previewing = false;
let session: Session | null = null;
let rafId = 0;

let currentLevel = 1;
let currentBpm = 80;
let currentPatternIndex = 0;
let currentPattern: RhythmEvent[] = [];

// Timing state
let phase: "idle" | "countdown" | "playing" = "idle";
let countdownBeats = 0;
let countdownStartTime = 0; // when countdown animation begins
let patternStartTime = 0; // performance.now() when pattern starts
let msPerBeat = 750; // 60000 / bpm
let totalPatternBeats = 4;
let currentLoop = 0;

// Scheduled notes for the current loop
let scheduledNotes: ScheduledNote[] = [];
let nextUnmatchedIndex = 0;

// Playhead tracking
let lastHighlightedAbcIndex = -1;

// Pre-computed event beat positions
let eventBeatPositions: { beatPos: number; abcIndex: number; type: "note" | "rest" }[] = [];
let noteOnlyEvents: { beatPos: number; abcIndex: number }[] = [];

// SVG reference
let sheetSvg: SVGElement | null = null;

const stats: Stats = { perfect: 0, good: 0, ok: 0, misses: 0, extras: 0 };

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

// ── Piano roll (full-length scrolling timeline) ─────────────────────
//
// Layout (height = ROLL_HEIGHT):
//   Top half:  user input rectangles (drawn in real-time, persist)
//   Mid line:  thin divider
//   Bottom half: expected pattern rectangles (light gray, static)
//
// The ENTIRE session is pre-built as one long track — no copies, no
// looping. The track scrolls left so the playhead stays fixed at center.

const PX_PER_BEAT = 80;
const SWEEP_WIDTH = 500;
const ROLL_HEIGHT = 56;
const HALF = ROLL_HEIGHT / 2;
const LEAD_IN_BEATS = COUNT_IN_BEATS; // empty beats before pattern starts

// Total beats in the full session track
let totalTrackBeats = 0;

function beatCountLabel(beatPos: number): string {
  const beat = Math.floor(beatPos % totalPatternBeats) + 1;
  const frac = Math.round((beatPos - Math.floor(beatPos)) * 4) / 4;
  if (frac === 0) return String(beat);
  if (frac === 0.5) return "&";
  if (frac === 0.25) return "e";
  if (frac === 0.75) return "a";
  return "";
}

// Active user-input rectangle (grows while key is held)
let inputRectEl: HTMLDivElement | null = null;
let inputStartAbsBeat = 0;

/**
 * Build the full-length track for the entire session duration.
 * Repeats the pattern enough times to fill the session + margin.
 */
function buildFullTrack(events: RhythmEvent[], durationMs: number): void {
  sweepTrack.innerHTML = "";
  inputRectEl = null;

  const totalLoops = Math.ceil(durationMs / (totalPatternBeats * msPerBeat)) + 2;
  totalTrackBeats = LEAD_IN_BEATS + totalLoops * totalPatternBeats;
  const totalWidth = totalTrackBeats * PX_PER_BEAT;
  const patternStart = LEAD_IN_BEATS * PX_PER_BEAT; // where patterns begin
  sweepTrack.style.width = `${totalWidth}px`;

  // Mid-line divider (full length)
  const mid = document.createElement("div");
  mid.style.cssText = `
    position: absolute; left: 0; top: ${HALF}px;
    width: ${totalWidth}px; height: 1px;
    background: var(--border);
  `;
  sweepTrack.appendChild(mid);

  // Beat grid lines (full length, aligned to pattern beats)
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

  // Expected-pattern rectangles + count labels (after lead-in)
  for (let loop = 0; loop < totalLoops; loop++) {
    const loopOffset = patternStart + loop * totalPatternBeats * PX_PER_BEAT;
    let beatPos = 0;
    for (const event of events) {
      const x = loopOffset + beatPos * PX_PER_BEAT;
      if (event.type === "note") {
        const w = event.beats * PX_PER_BEAT;
        const releaseGapPx = (KEY_RELEASE_MS / msPerBeat) * PX_PER_BEAT;
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

/** For preview (no session), build a short 2-loop track. */
function buildPreviewTrack(events: RhythmEvent[]): void {
  buildFullTrack(events, totalPatternBeats * msPerBeat * 2);
}

/** Position the track so that `absBeat` aligns with the center playhead. */
function updateSweepPosition(absBeat: number): void {
  const currentPx = absBeat * PX_PER_BEAT;
  const translateX = SWEEP_WIDTH / 2 - currentPx;
  sweepTrack.style.transform = `translateX(${translateX}px)`;
}

/** Get current absolute beat position in track space (includes lead-in). */
function getAbsBeatPos(): number {
  if (countdownStartTime === 0) return 0;
  return (performance.now() - countdownStartTime) / msPerBeat;
}

/** Start drawing a user-input rectangle at the current absolute beat. */
function startInputRect(): void {
  if (phase !== "playing") return;
  endInputRect();
  inputStartAbsBeat = getAbsBeatPos();

  const x = inputStartAbsBeat * PX_PER_BEAT;
  const rect = document.createElement("div");
  rect.className = "input-rect";
  rect.style.cssText = `
    position: absolute; left: ${x}px; top: 2px;
    width: 4px; height: ${HALF - 4}px;
    border-radius: var(--radius-sm);
    background: var(--fg-muted); opacity: 0.45;
  `;
  sweepTrack.appendChild(rect);
  inputRectEl = rect;
}

/** Update the width of the active input rectangle. */
function growInputRect(): void {
  if (!inputRectEl) return;
  const currentAbsBeat = getAbsBeatPos();
  const durationBeats = currentAbsBeat - inputStartAbsBeat;
  if (durationBeats < 0) return;
  inputRectEl.style.width = `${Math.max(4, durationBeats * PX_PER_BEAT)}px`;
}

/** Finalize the input rectangle (key released). */
function endInputRect(): void {
  if (inputRectEl) {
    growInputRect();
    inputRectEl = null;
  }
}

// ── Pattern rendering ────────────────────────────────────────────────

function renderPattern(events: RhythmEvent[]): void {
  const abc = patternToAbc(events);
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

  // Build event positions and abc index mapping
  eventBeatPositions = [];
  noteOnlyEvents = [];
  let beatPos = 0;
  events.forEach((event, i) => {
    eventBeatPositions.push({ beatPos, abcIndex: i, type: event.type });
    if (event.type === "note") {
      noteOnlyEvents.push({ beatPos, abcIndex: i });
    }
    beatPos += event.beats;
  });
  totalPatternBeats = beatPos;

  buildPreviewTrack(events);
}

function updatePatternLabel(): void {
  const level = LEVELS[currentLevel];
  patternLabel.textContent = `${currentPatternIndex + 1} / ${level.patterns.length}`;
}

function renderPreview(): void {
  const level = LEVELS[currentLevel];
  if (currentPatternIndex >= level.patterns.length) currentPatternIndex = 0;
  const pattern = level.patterns[currentPatternIndex];
  renderPattern(pattern);
  // Start at beat 0: lead-in gap on right, then pattern starts
  updateSweepPosition(0);
  updatePatternLabel();
}

// ── SVG note coloring ────────────────────────────────────────────────

function colorAbcElement(index: number, color: string, type: "note" | "rest"): void {
  if (!sheetSvg) return;
  const cls = type === "note" ? "abcjs-note" : "abcjs-rest";
  const els = sheetSvg.querySelectorAll(`.${cls}.abcjs-n${index}`);
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

// Track which events have result colors (so playhead doesn't override them)
const eventResultColors = new Map<number, string>();

function highlightCurrentEvent(abcIndex: number): void {
  if (abcIndex === lastHighlightedAbcIndex) return;

  // Reset previous highlight (unless it has a result color)
  if (lastHighlightedAbcIndex >= 0 && !eventResultColors.has(lastHighlightedAbcIndex)) {
    const prevEvent = eventBeatPositions[lastHighlightedAbcIndex];
    if (prevEvent) {
      colorAbcElement(lastHighlightedAbcIndex, "#000", prevEvent.type);
    }
  }

  // Highlight current note (skip rests)
  const event = eventBeatPositions[abcIndex];
  if (event && event.type === "note" && !eventResultColors.has(abcIndex)) {
    colorAbcElement(abcIndex, "oklch(0.55 0.2 260)", "note"); // accent-ish blue
  }

  lastHighlightedAbcIndex = abcIndex;
}

// ── Timing engine ────────────────────────────────────────────────────

/** Schedule ALL notes for the entire session upfront. */
function scheduleAllNotes(durationMs: number): void {
  scheduledNotes = [];
  const totalLoops = Math.ceil(durationMs / (totalPatternBeats * msPerBeat)) + 2;
  for (let loop = 0; loop < totalLoops; loop++) {
    const loopStart = patternStartTime + loop * totalPatternBeats * msPerBeat;
    for (const event of noteOnlyEvents) {
      scheduledNotes.push({
        expectedTime: loopStart + event.beatPos * msPerBeat,
        abcIndex: event.abcIndex,
        matched: false,
      });
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
    note.matched = true; // mark so we don't re-count
    stats.misses++;
    eventResultColors.set(note.abcIndex, "#ef4444");
    colorAbcElement(note.abcIndex, "#ef4444", "note");
    nextUnmatchedIndex++;
  }
}

// ── Feedback display ─────────────────────────────────────────────────

let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

function showFeedback(text: string, color: string): void {
  feedbackEl.textContent = text;
  feedbackEl.style.color = color;
  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  feedbackTimeout = setTimeout(() => {
    feedbackEl.innerHTML = "&nbsp;";
  }, 600);
}

// ── Tap handling ─────────────────────────────────────────────────────

function handleTap(tapTime: number): void {
  if (!gameRunning || phase !== "playing") return;
  session?.activity();

  advancePastMissed(tapTime);

  // Always draw the input rectangle so the user sees their tap visually
  startInputRect();

  if (nextUnmatchedIndex >= scheduledNotes.length) {
    stats.extras++;
    showFeedback("Extra!", "#ef4444");
    return;
  }

  const note = scheduledNotes[nextUnmatchedIndex];
  const offset = tapTime - note.expectedTime;

  // Too early for this note
  if (offset < -EARLY_TOLERANCE) {
    stats.extras++;
    showFeedback("Too early!", "#ef4444");
    return;
  }

  // Too late — shouldn't normally happen since advancePastMissed runs first,
  // but guard against it
  if (offset > LATE_TOLERANCE) {
    stats.extras++;
    showFeedback("Too late!", "#ef4444");
    return;
  }

  // Within tolerance — it's a match
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
    // Still within tolerance but not great
    text = offset > 0 ? "Late" : "Early";
    color = "#fb923c";
    stats.ok++;
  }

  showFeedback(text, color);
  eventResultColors.set(note.abcIndex, color);
  colorAbcElement(note.abcIndex, color, "note");

  nextUnmatchedIndex++;
}

// ── Game loop (rAF) ──────────────────────────────────────────────────

function gameLoop(): void {
  if (!gameRunning) return;
  rafId = requestAnimationFrame(gameLoop);

  const now = performance.now();

  // Single continuous sweep: always use countdownStartTime as reference
  // so there's no jump at the countdown→playing transition
  const absBeat = (now - countdownStartTime) / msPerBeat;
  updateSweepPosition(absBeat);

  if (phase !== "playing") return;

  const elapsed = now - patternStartTime;

  // Track which loop we're in (for notation highlighting)
  const totalLoopMs = totalPatternBeats * msPerBeat;
  const loopIndex = Math.floor(elapsed / totalLoopMs);
  if (loopIndex > currentLoop) {
    currentLoop = loopIndex;
    eventResultColors.clear();
    resetAllColors();
  }

  // Grow active input rectangle in real-time
  growInputRect();

  // Current position within loop (for notation highlighting)
  const posInLoop = elapsed - currentLoop * totalLoopMs;
  const beatPos = posInLoop / msPerBeat;

  // Find which event the playhead is on
  let currentAbcIndex = 0;
  for (let i = eventBeatPositions.length - 1; i >= 0; i--) {
    if (eventBeatPositions[i].beatPos <= beatPos) {
      currentAbcIndex = eventBeatPositions[i].abcIndex;
      break;
    }
  }
  highlightCurrentEvent(currentAbcIndex);

  // Advance past missed notes
  advancePastMissed(now);
}

// ── Session & stats ──────────────────────────────────────────────────

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

  updateStatsDisplay();
  updateStartButton();
  resultsDialog.showModal();
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

  const total = stats.perfect + stats.good + stats.ok + stats.misses;
  const hits = stats.perfect + stats.good + stats.ok;
  const accuracy = total > 0 ? Math.round((hits / total) * 100) : 100;
  document.getElementById("stat-accuracy")!.textContent = `${accuracy}%`;
}

// ── Start / Stop ─────────────────────────────────────────────────────

function updateStartButton(): void {
  const busy = gameRunning || previewing;
  startBtn.textContent = gameRunning ? "Stop" : "Start";
  startBtn.disabled = previewing;
  levelSelect.disabled = busy;
  bpmSelect.disabled = busy;
  durationSelect.disabled = busy;
  prevPatternBtn.disabled = busy;
  nextPatternBtn.disabled = busy;
  previewBtn.disabled = busy;
}

function startGame(): void {
  stats.perfect = 0;
  stats.good = 0;
  stats.ok = 0;
  stats.misses = 0;
  stats.extras = 0;

  currentLevel = Number(levelSelect.value);
  currentBpm = Number(bpmSelect.value);
  msPerBeat = 60000 / currentBpm;

  // Use the currently selected pattern from the level
  const level = LEVELS[currentLevel];
  currentPattern = level.patterns[currentPatternIndex];
  renderPattern(currentPattern);
  // Rebuild track for full session duration
  buildFullTrack(currentPattern, Number(durationSelect.value));

  gameRunning = true;
  phase = "countdown";
  countdownBeats = 0;
  countdownStartTime = performance.now();
  currentLoop = 0;
  lastHighlightedAbcIndex = -1;
  eventResultColors.clear();

  session?.destroy();
  session = createSession();
  session.start();

  updateStartButton();
  buildBeatDots();

  // Start metronome with count-in
  void metronome.start({
    bpm: currentBpm,
    beatsPerMeasure: 4,
    onBeat: (beat, _downbeat) => {
      if (!gameRunning) return;

      updateBeatDots(beat);

      if (phase === "countdown") {
        countdownBeats++;
        countDisplayEl.textContent = String(countdownBeats);

        if (countdownBeats >= COUNT_IN_BEATS) {
          // Count-in complete — pattern starts at LEAD_IN_BEATS from countdownStartTime
          phase = "playing";
          patternStartTime = countdownStartTime + LEAD_IN_BEATS * msPerBeat;
          countDisplayEl.innerHTML = "&nbsp;";
          scheduleAllNotes(Number(durationSelect.value));
        }
      }
    },
  });

  // Start game loop
  rafId = requestAnimationFrame(gameLoop);
}

function stopGame(): void {
  endSession();
}

startBtn.addEventListener("click", () => {
  if (gameRunning) stopGame();
  else startGame();
});

// ── Input handlers ───────────────────────────────────────────────────

// MIDI: note-on → tap, note-off → release
function onMIDIMessage(event: MIDIMessageEvent): void {
  const [status, , velocity] = event.data!;
  const command = status >> 4;
  if (command === 9 && velocity > 0) {
    handleTap(performance.now());
  } else if (command === 8 || (command === 9 && velocity === 0)) {
    endInputRect();
  }
}

// Keyboard: spacebar press/release
let spaceDown = false;
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.repeat && !spaceDown) {
    e.preventDefault();
    spaceDown = true;
    handleTap(performance.now());
  }
});
document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spaceDown = false;
    endInputRect();
  }
});

// Mouse/touch: press → tap, release → end input
document.addEventListener("mousedown", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest("button, select, dialog, a")) return;
  handleTap(performance.now());
});
document.addEventListener("mouseup", () => {
  endInputRect();
});
document.addEventListener(
  "touchstart",
  (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, select, dialog, a")) return;
    handleTap(performance.now());
  },
  { passive: true },
);
document.addEventListener("touchend", () => {
  endInputRect();
});

// ── Pattern navigation ──────────────────────────────────────────

prevPatternBtn.addEventListener("click", () => {
  if (gameRunning || previewing) return;
  const level = LEVELS[currentLevel];
  currentPatternIndex = (currentPatternIndex - 1 + level.patterns.length) % level.patterns.length;
  renderPreview();
});

nextPatternBtn.addEventListener("click", () => {
  if (gameRunning || previewing) return;
  const level = LEVELS[currentLevel];
  currentPatternIndex = (currentPatternIndex + 1) % level.patterns.length;
  renderPreview();
});

// ── Preview playback ────────────────────────────────────────────

let previewRafId = 0;
let previewStartTime = 0;
let previewLoops = 0;

function startPreview(): void {
  if (gameRunning || previewing) return;

  previewing = true;
  currentBpm = Number(bpmSelect.value);
  msPerBeat = 60000 / currentBpm;
  previewLoops = 0;

  const level = LEVELS[currentLevel];
  currentPattern = level.patterns[currentPatternIndex];
  renderPattern(currentPattern);
  updateStartButton();
  previewBtn.textContent = "■ Stop";
  buildBeatDots();

  let countdownBeatsPreview = 0;
  let previewPhase: "countdown" | "playing" = "countdown";
  let previewCountdownStart = performance.now();

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

    // Single continuous sweep from previewCountdownStart
    const now = performance.now();
    const absBeat = (now - previewCountdownStart) / msPerBeat;
    updateSweepPosition(absBeat);

    // Still in countdown — just animate sweep, nothing else
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

    // Highlight current event in notation
    const posInLoop = elapsed - loopIndex * totalLoopMs;
    const beatPos = posInLoop / msPerBeat;
    let currentAbcIndex = 0;
    for (let i = eventBeatPositions.length - 1; i >= 0; i--) {
      if (eventBeatPositions[i].beatPos <= beatPos) {
        currentAbcIndex = eventBeatPositions[i].abcIndex;
        break;
      }
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
}

previewBtn.addEventListener("click", () => {
  if (previewing) stopPreview();
  else startPreview();
});

// ── Settings persistence ─────────────────────────────────────────────

const savedLevel = localStorage.getItem("rhythm-tap-level");
if (savedLevel && levelSelect.querySelector(`option[value="${savedLevel}"]`)) {
  levelSelect.value = savedLevel;
  currentLevel = Number(savedLevel);
}

const savedBpm = localStorage.getItem("rhythm-tap-bpm");
if (savedBpm && bpmSelect.querySelector(`option[value="${savedBpm}"]`)) {
  bpmSelect.value = savedBpm;
  currentBpm = Number(savedBpm);
}

levelSelect.addEventListener("change", () => {
  currentLevel = Number(levelSelect.value);
  currentPatternIndex = 0;
  localStorage.setItem("rhythm-tap-level", levelSelect.value);
  if (!gameRunning && !previewing) renderPreview();
});

bpmSelect.addEventListener("change", () => {
  currentBpm = Number(bpmSelect.value);
  localStorage.setItem("rhythm-tap-bpm", bpmSelect.value);
});

// ── Restart ──────────────────────────────────────────────────────────

document.getElementById("close-btn")!.addEventListener("click", () => {
  resultsDialog.close();
});

// ── Init ─────────────────────────────────────────────────────────────

const midiManager = new MIDIManager({
  onMessage: onMIDIMessage,
  onConnectionChange: (connected, deviceName) => {
    midiStatusEl.textContent = connected ? deviceName : "not connected";
    if (!connected) session?.pause();
  },
});

void midiManager.initialize();

buildBeatDots();
renderPreview();
