import "./style.css";
import "./components/piano-keyboard.ts";
import { SONG_STRUCTURES, buildChordNotes, midiToNoteName } from "./chords.ts";
import type { SongStructure } from "./chords.ts";
import { MIDIManager } from "./midi.ts";
import { Session } from "./session.ts";
import { renderSheet } from "./sheet.ts";

// ── Types ────────────────────────────────────────────────────────────

type Hand = "left" | "right";

interface Interval {
  lower: number; // MIDI note
  upper: number; // MIDI note
  name: string; // e.g. "Major 3rd"
}

interface Stats {
  intervalsPlayed: number;
  correctNotes: number;
  incorrectNotes: number;
}

// ── Constants ────────────────────────────────────────────────────────

const HELP_THRESHOLD = 5;
const CORRECT_DELAY = 400;

const LEFT_BASE = 48; // C3
const RIGHT_BASE = 60; // C4

// Semitone distance → interval name
const INTERVAL_NAMES: Record<number, string> = {
  1: "Minor 2nd",
  2: "Major 2nd",
  3: "Minor 3rd",
  4: "Major 3rd",
  5: "Perfect 4th",
  6: "Tritone",
  7: "Perfect 5th",
  8: "Minor 6th",
  9: "Major 6th",
  10: "Minor 7th",
  11: "Major 7th",
  12: "Octave",
};

function intervalName(semitones: number): string {
  return INTERVAL_NAMES[semitones] ?? `${semitones} semitones`;
}

// ── DOM ──────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";
app.style.justifyContent = "center";

app.innerHTML = `
  <h1>Intervals</h1>

  <div class="row-sm center" style="flex-wrap: wrap">
    <span class="text-muted">MIDI:</span>
    <span id="midi-status" class="text-muted">initializing...</span>

    <select id="hand-select" class="select" style="width: auto; margin-left: var(--space-md)">
      <option value="right">Right hand</option>
      <option value="left">Left hand</option>
    </select>

    <select id="duration-select" class="select" style="width: auto">
      <option value="60000">1 min</option>
      <option value="120000">2 min</option>
      <option value="180000" selected>3 min</option>
      <option value="300000">5 min</option>
      <option value="600000">10 min</option>
    </select>

    <label><input type="checkbox" id="highlight-cb" checked /> Highlight</label>
    <label><input type="checkbox" id="labels-cb" /> Labels</label>

    <button class="btn btn-primary" id="start-btn">Start</button>
  </div>

  <div class="stack-sm" style="align-items: center; min-height: 160px">
    <div id="section-label" class="text-accent" style="font-size: var(--text-sm); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; min-height: 1.4em">&nbsp;</div>
    <div id="sheet" style="min-height: 100px; display: flex; align-items: center; justify-content: center">&nbsp;</div>
    <div id="interval-label" class="text-muted" style="font-style: italic; min-height: 1.4em">&nbsp;</div>
  </div>

  <piano-keyboard id="piano" start="36" end="84" style="height: 150px"></piano-keyboard>

  <div id="pressed" class="text-muted" style="text-align: center; min-height: 1.4em">&nbsp;</div>

  <progress id="progress" max="100" value="0"></progress>

  <dialog id="results" class="dialog stack-sm" style="text-align: left">
    <h2 style="text-align: center">Practice Complete</h2>
    <table style="margin: 0 auto">
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Time</th><td id="stat-time">0:00</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Intervals</th><td id="stat-intervals">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Mistakes</th><td id="stat-mistakes">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Accuracy</th><td id="stat-accuracy">100%</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Speed</th><td id="stat-speed">0.0 ipm</td></tr>
    </table>
    <div style="text-align: center">
      <button class="btn btn-primary" id="close-btn">Close</button>
    </div>
  </dialog>
`;

// ── Element refs ─────────────────────────────────────────────────────

const piano = document.getElementById("piano")!;
const sectionLabelEl = document.getElementById("section-label")!;
const sheetEl = document.getElementById("sheet")!;
const intervalLabelEl = document.getElementById("interval-label")!;
const pressedEl = document.getElementById("pressed")!;
const midiStatusEl = document.getElementById("midi-status")!;
const highlightCb = document.getElementById("highlight-cb") as HTMLInputElement;
const labelsCb = document.getElementById("labels-cb") as HTMLInputElement;
const progressEl = document.getElementById("progress") as HTMLProgressElement;
const resultsDialog = document.getElementById("results") as HTMLDialogElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const handSelect = document.getElementById("hand-select") as HTMLSelectElement;
const durationSelect = document.getElementById("duration-select") as HTMLSelectElement;

// ── Game state ───────────────────────────────────────────────────────

let gameRunning = false;
let session: Session | null = null;
let statsInterval: ReturnType<typeof setInterval> | null = null;

let handMode: Hand = "right";
let currentInterval: Interval | null = null;

const pressedNotes = new Set<number>();
let hasWon = false;
let incorrectPressCount = 0;
let tempHighlight = false;

const stats: Stats = { intervalsPlayed: 0, correctNotes: 0, incorrectNotes: 0 };

// ── Song pattern interval sequence ──────────────────────────────────

let intervalSequence: Interval[] = [];
let sequenceIndex = 0;
let sectionLabels: string[] = [];

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Extract intervals from a chord's notes, placed in the target octave.
 * From a triad [root, 3rd, 5th] we get three intervals:
 *   root→3rd, root→5th, 3rd→5th
 * We pick one at random for variety.
 */
function chordToInterval(chordName: string, base: number): Interval | null {
  const notes = buildChordNotes(chordName);
  if (!notes || notes.length < 2) return null;

  // Rebase chord notes into the target octave
  const rootPc = notes[0] % 12;
  const rootMidi = base + rootPc;
  const rebased = notes.map((n) => rootMidi + (n - notes[0]));

  // Build all possible pairs from chord tones
  const pairs: [number, number][] = [];
  for (let i = 0; i < rebased.length; i++) {
    for (let j = i + 1; j < rebased.length; j++) {
      pairs.push([rebased[i], rebased[j]]);
    }
  }

  const [lower, upper] = pickRandom(pairs);
  const semitones = upper - lower;

  return {
    lower,
    upper,
    name: intervalName(semitones),
  };
}

/**
 * Build a loopable interval sequence from a song structure.
 * Verse × 2 → Chorus × 1, each chord contributes one interval.
 */
function buildSequence(
  song: SongStructure,
  hand: Hand,
): { intervals: Interval[]; labels: string[] } {
  const base = hand === "left" ? LEFT_BASE : RIGHT_BASE;
  const intervals: Interval[] = [];
  const labels: string[] = [];

  const sections: [string, readonly string[]][] = [
    ["Verse", song.verse],
    ["Verse", song.verse],
    ["Chorus", song.chorus],
  ];

  for (const [label, chords] of sections) {
    for (const chord of chords) {
      const interval = chordToInterval(chord, base);
      if (interval) {
        intervals.push(interval);
        labels.push(label);
      }
    }
  }

  return { intervals, labels };
}

function initSequence(): void {
  const song = pickRandom(SONG_STRUCTURES);
  const seq = buildSequence(song, handMode);
  intervalSequence = seq.intervals;
  sectionLabels = seq.labels;
  sequenceIndex = 0;
}

function advanceInterval(): void {
  sequenceIndex = (sequenceIndex + 1) % intervalSequence.length;

  currentInterval = intervalSequence[sequenceIndex];
  incorrectPressCount = 0;
  tempHighlight = false;
  hasWon = false;

  updateDisplay();
}

function pickFirstInterval(): void {
  initSequence();
  currentInterval = intervalSequence[0];
  incorrectPressCount = 0;
  tempHighlight = false;
  hasWon = false;
  updateDisplay();
}

// ── Display ──────────────────────────────────────────────────────────

function clefForInterval(interval: Interval): "treble" | "bass" {
  return interval.lower >= 60 ? "treble" : "bass";
}

function renderIntervalSheet(
  container: HTMLElement,
  interval: Interval,
  options: { color?: string } = {},
): void {
  const clef = clefForInterval(interval);
  renderSheet(container, [{ midi: [interval.lower, interval.upper], color: options.color }], {
    clef,
    staffWidth: 150,
    scale: 1.2,
  });
}

function renderPreview(): void {
  const base = handMode === "left" ? LEFT_BASE : RIGHT_BASE;
  // Show a perfect 5th as preview
  renderSheet(sheetEl, [{ midi: [base, base + 7] }], {
    clef: handMode === "left" ? "bass" : "treble",
    staffWidth: 150,
    scale: 1.2,
  });
}

function updateDisplay(): void {
  // Section label
  if (gameRunning && sectionLabels.length > 0) {
    sectionLabelEl.textContent = sectionLabels[sequenceIndex] ?? "";
  } else {
    sectionLabelEl.innerHTML = "&nbsp;";
  }

  // Sheet music
  if (currentInterval && gameRunning) {
    const color = hasWon ? "limegreen" : undefined;
    renderIntervalSheet(sheetEl, currentInterval, { color });
  } else if (!gameRunning) {
    renderPreview();
  } else {
    sheetEl.innerHTML = "&nbsp;";
  }

  // Interval label (labels mode shows note names + interval name)
  if (labelsCb.checked && currentInterval && gameRunning) {
    intervalLabelEl.textContent = `${midiToNoteName(currentInterval.lower)} + ${midiToNoteName(currentInterval.upper)} — ${currentInterval.name}`;
  } else {
    intervalLabelEl.innerHTML = "&nbsp;";
  }

  // Piano keyboard
  const showHighlight = highlightCb.checked || tempHighlight;

  const yellow: number[] = [];
  const green: number[] = [];
  const red: number[] = [];

  if (currentInterval && gameRunning) {
    const expected = [currentInterval.lower, currentInterval.upper];

    if (hasWon) {
      green.push(...expected);
    } else if (showHighlight) {
      yellow.push(...expected);
    }

    for (const n of pressedNotes) {
      if (!expected.includes(n)) {
        red.push(n);
      }
    }
  }

  piano.setAttribute("yellow", yellow.join(","));
  piano.setAttribute("green", green.join(","));
  piano.setAttribute("red", red.join(","));

  // Pressed notes text
  if (pressedNotes.size > 0 && gameRunning) {
    pressedEl.textContent = [...pressedNotes].map(midiToNoteName).join(", ");
  } else {
    pressedEl.innerHTML = "&nbsp;";
  }
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

  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }

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
  document.getElementById("stat-intervals")!.textContent = String(stats.intervalsPlayed);
  document.getElementById("stat-mistakes")!.textContent = String(stats.incorrectNotes);

  const total = stats.correctNotes + stats.incorrectNotes;
  const accuracy = total > 0 ? Math.round((stats.correctNotes / total) * 100) : 100;
  document.getElementById("stat-accuracy")!.textContent = `${accuracy}%`;

  const elapsedMin = secs / 60;
  const ipm = elapsedMin > 0 ? (stats.intervalsPlayed / elapsedMin).toFixed(1) : "0.0";
  document.getElementById("stat-speed")!.textContent = `${ipm} ipm`;
}

// ── Start / Stop ─────────────────────────────────────────────────────

function updateStartButton(): void {
  startBtn.textContent = gameRunning ? "Stop" : "Start";
  handSelect.disabled = gameRunning;
  durationSelect.disabled = gameRunning;
}

function startGame(): void {
  stats.intervalsPlayed = 0;
  stats.correctNotes = 0;
  stats.incorrectNotes = 0;
  gameRunning = true;
  pressedNotes.clear();
  hasWon = false;
  incorrectPressCount = 0;
  tempHighlight = false;
  currentInterval = null;

  session?.destroy();
  session = createSession();
  session.start();

  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(() => {
    if (session?.started) updateStatsDisplay();
  }, 1000);

  updateStartButton();
  pickFirstInterval();
}

function stopGame(): void {
  endSession();
}

startBtn.addEventListener("click", () => {
  if (gameRunning) stopGame();
  else startGame();
});

// ── Win check ────────────────────────────────────────────────────────

function checkWin(): void {
  if (hasWon || !gameRunning || !currentInterval) return;

  const expected = new Set([currentInterval.lower, currentInterval.upper]);

  // Win when exactly the two expected notes are pressed
  if (pressedNotes.size === 2 && [...pressedNotes].every((n) => expected.has(n))) {
    hasWon = true;
    stats.intervalsPlayed++;

    updateDisplay();

    setTimeout(() => {
      if (!gameRunning) return;
      pressedNotes.clear();
      advanceInterval();
    }, CORRECT_DELAY);
  }
}

// ── MIDI handling ────────────────────────────────────────────────────

function onMIDIMessage(event: MIDIMessageEvent): void {
  if (!gameRunning || !currentInterval) return;

  const [status, note, velocity] = event.data!;
  const command = status >> 4;
  const expected = new Set([currentInterval.lower, currentInterval.upper]);

  if (command === 9 && velocity > 0) {
    session?.activity();

    const wasPressed = pressedNotes.has(note);
    pressedNotes.add(note);

    if (!wasPressed) {
      if (expected.has(note)) {
        stats.correctNotes++;
      } else {
        stats.incorrectNotes++;

        if (!highlightCb.checked && !tempHighlight) {
          incorrectPressCount++;
          if (incorrectPressCount >= HELP_THRESHOLD) tempHighlight = true;
        }
      }
    }
  } else if (command === 8 || (command === 9 && velocity === 0)) {
    pressedNotes.delete(note);
    hasWon = false;
  }

  updateDisplay();
  checkWin();
}

// ── Settings persistence ─────────────────────────────────────────────

const savedHand = localStorage.getItem("intervals-hand");
if (savedHand) {
  handSelect.value = savedHand;
  if (handSelect.value === savedHand) {
    handMode = savedHand as Hand;
  }
}

const savedHighlight = localStorage.getItem("intervals-highlight");
if (savedHighlight !== null) highlightCb.checked = savedHighlight === "true";

const savedLabels = localStorage.getItem("intervals-labels");
if (savedLabels !== null) labelsCb.checked = savedLabels === "true";

handSelect.addEventListener("change", () => {
  handMode = handSelect.value as Hand;
  localStorage.setItem("intervals-hand", handMode);
});

highlightCb.addEventListener("change", () => {
  localStorage.setItem("intervals-highlight", String(highlightCb.checked));
  updateDisplay();
});

labelsCb.addEventListener("change", () => {
  localStorage.setItem("intervals-labels", String(labelsCb.checked));
  updateDisplay();
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

// Show preview interval before game starts
renderPreview();

// Also support piano-keyboard click input
// For intervals, clicks accumulate — press two keys to complete the interval
piano.addEventListener("key-click", ((e: CustomEvent<{ midi: number }>) => {
  if (!gameRunning || !currentInterval) return;

  const midi = e.detail.midi;
  session?.activity();

  // Toggle: if already pressed, release it; otherwise add it
  if (pressedNotes.has(midi)) {
    pressedNotes.delete(midi);
  } else {
    pressedNotes.add(midi);

    const expected = new Set([currentInterval.lower, currentInterval.upper]);
    if (expected.has(midi)) {
      stats.correctNotes++;
    } else {
      stats.incorrectNotes++;
      if (!highlightCb.checked && !tempHighlight) {
        incorrectPressCount++;
        if (incorrectPressCount >= HELP_THRESHOLD) tempHighlight = true;
      }
    }
  }

  updateDisplay();
  checkWin();
}) as EventListener);
