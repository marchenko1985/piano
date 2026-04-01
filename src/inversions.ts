import "./style.css";
import "./components/piano-keyboard.ts";
import { BASE_CHORDS, midiToNoteName, transposeChords } from "./chords.ts";
import { getInversionLabel } from "./voice-leading.ts";
import { MIDIManager } from "./midi.ts";
import { Session } from "./session.ts";

// ── Types ────────────────────────────────────────────────────────────

type Hand = "left" | "right" | "both";
type Preset = "all" | "major" | "minor";
type Phase = "root" | "inversion";

interface Stats {
  chordsPlayed: number;
  notesPlayed: number;
  correctNotes: number;
  incorrectNotes: number;
}

// ── DOM ──────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";
app.style.justifyContent = "center";

app.innerHTML = `
  <div class="row-sm center" style="flex-wrap: wrap">
    <span class="text-muted">MIDI:</span>
    <span id="midi-status" class="text-muted">initializing...</span>

    <select id="preset-select" class="select" style="width: 10em; margin-left: var(--space-md)">
      <option value="all">All chords</option>
      <option value="major">Major</option>
      <option value="minor">Minor</option>
    </select>

    <select id="hand-select" class="select" style="width: auto">
      <option value="right">Right hand</option>
      <option value="left">Left hand</option>
      <option value="both">Both hands</option>
    </select>

    <select id="duration-select" class="select" style="width: auto">
      <option value="60000">1 min</option>
      <option value="120000">2 min</option>
      <option value="180000" selected>3 min</option>
      <option value="300000">5 min</option>
      <option value="600000">10 min</option>
    </select>

    <label><input type="checkbox" id="highlight-cb" checked /> Highlight</label>

    <button class="btn btn-primary" id="start-btn">Start</button>
  </div>

  <div class="stack-sm">
    <div id="phase-label" class="text-accent" style="font-size: var(--text-sm); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em">&nbsp;</div>
    <div id="chord-name" style="font-size: var(--text-2xl); font-weight: bold"></div>
    <div id="chord-notes" class="text-muted"></div>
    <div id="active-hand" class="text-muted" style="font-style: italic"></div>
  </div>

  <piano-keyboard id="piano" start="48" end="83" style="height: 150px"></piano-keyboard>

  <div id="pressed" class="text-muted">&nbsp;</div>

  <progress id="progress" max="100" value="0"></progress>

  <dialog id="results" class="dialog stack-sm" style="text-align: left">
    <h2 style="text-align: center">Practice Complete</h2>
    <table style="margin: 0 auto">
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Time</th><td id="stat-time">0:00</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Chords</th><td id="stat-chords">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Notes</th><td id="stat-notes">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Accuracy</th><td id="stat-accuracy">100%</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Speed</th><td id="stat-speed">0.0 cpm</td></tr>
    </table>
    <div style="text-align: center">
      <button class="btn btn-primary" id="close-btn">Close</button>
    </div>
  </dialog>
`;

const piano = document.getElementById("piano")!;
const phaseLabelEl = document.getElementById("phase-label")!;
const chordNameEl = document.getElementById("chord-name")!;
const chordNotesEl = document.getElementById("chord-notes")!;
const activeHandEl = document.getElementById("active-hand")!;
const pressedEl = document.getElementById("pressed")!;
const midiStatusEl = document.getElementById("midi-status")!;
const highlightCb = document.getElementById("highlight-cb") as HTMLInputElement;
const progressEl = document.getElementById("progress") as HTMLProgressElement;
const resultsDialog = document.getElementById("results") as HTMLDialogElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const handSelect = document.getElementById("hand-select") as HTMLSelectElement;
const durationSelect = document.getElementById("duration-select") as HTMLSelectElement;
const presetSelect = document.getElementById("preset-select") as HTMLSelectElement;

// ── Chord presets ────────────────────────────────────────────────────

const MAJOR_CHORDS: Record<string, readonly number[]> = Object.fromEntries(
  Object.entries(BASE_CHORDS).filter(([name]) => !name.includes("m")),
);

const MINOR_CHORDS: Record<string, readonly number[]> = Object.fromEntries(
  Object.entries(BASE_CHORDS).filter(([name]) => name.includes("m")),
);

function getChordsForPreset(p: Preset): Record<string, readonly number[]> {
  if (p === "major") return MAJOR_CHORDS;
  if (p === "minor") return MINOR_CHORDS;
  return BASE_CHORDS;
}

// ── Game state ───────────────────────────────────────────────────────

let preset: Preset = "all";
let handMode: Hand = "right";
let activeHand: "left" | "right" = "right";
let chords: Record<string, readonly number[]> = { ...BASE_CHORDS };
const leftChords: Record<string, readonly number[]> = transposeChords(-12);
const leftMajor: Record<string, readonly number[]> = Object.fromEntries(
  Object.entries(leftChords).filter(([name]) => !name.includes("m")),
);
const leftMinor: Record<string, readonly number[]> = Object.fromEntries(
  Object.entries(leftChords).filter(([name]) => name.includes("m")),
);

// Current chord being practiced
let currentChordName = "";
let rootNotes: readonly number[] = [];

// Phase: first play root position, then play a random inversion
let phase: Phase = "root";
let expectedNotes: number[] = [];
let ghostNotes: number[] = []; // gray keys showing where the note was before inversion

const pressedNotes = new Set<number>();
let hasWon = false;
let incorrectPressCount = 0;
let tempHighlight = false;
const HELP_THRESHOLD = 5;

const stats: Stats = { chordsPlayed: 0, notesPlayed: 0, correctNotes: 0, incorrectNotes: 0 };
let gameRunning = false;

// ── Session ──────────────────────────────────────────────────────────

let session: Session | null = null;
let statsInterval: ReturnType<typeof setInterval> | null = null;

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
  document.getElementById("stat-chords")!.textContent = String(stats.chordsPlayed);
  document.getElementById("stat-notes")!.textContent = String(stats.notesPlayed);

  const total = stats.correctNotes + stats.incorrectNotes;
  const accuracy = total > 0 ? Math.round((stats.correctNotes / total) * 100) : 100;
  document.getElementById("stat-accuracy")!.textContent = `${accuracy}%`;

  const elapsedMin = secs / 60;
  const cpm = elapsedMin > 0 ? (stats.chordsPlayed / elapsedMin).toFixed(1) : "0.0";
  document.getElementById("stat-speed")!.textContent = `${cpm} cpm`;
}

// ── Start / Stop ─────────────────────────────────────────────────────

function updateStartButton(): void {
  startBtn.textContent = gameRunning ? "Stop" : "Start";
  presetSelect.disabled = gameRunning;
  handSelect.disabled = gameRunning;
  durationSelect.disabled = gameRunning;
}

function startGame(): void {
  stats.chordsPlayed = 0;
  stats.notesPlayed = 0;
  stats.correctNotes = 0;
  stats.incorrectNotes = 0;
  gameRunning = true;
  pressedNotes.clear();
  hasWon = false;
  incorrectPressCount = 0;
  tempHighlight = false;

  session?.destroy();
  session = createSession();
  session.start();

  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(() => {
    if (session?.started) updateStatsDisplay();
  }, 1000);

  preset = presetSelect.value as Preset;

  updateStartButton();
  pickNewChord();
}

function stopGame(): void {
  endSession();
}

startBtn.addEventListener("click", () => {
  if (gameRunning) stopGame();
  else startGame();
});

// ── Helpers ──────────────────────────────────────────────────────────

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getChordsForHand(hand: "left" | "right"): Record<string, readonly number[]> {
  if (hand === "left") {
    if (preset === "major") return leftMajor;
    if (preset === "minor") return leftMinor;
    return leftChords;
  }
  return getChordsForPreset(preset);
}

// ── Chord & inversion picking ───────────────────────────────────────

function pickNewChord(): void {
  activeHand =
    handMode === "both" ? (Math.random() < 0.5 ? "left" : "right") : (handMode as "left" | "right");
  chords = getChordsForHand(activeHand);

  // Pick a random chord different from the current one
  const names = Object.keys(chords);
  let next: string;
  do {
    next = pickRandom(names);
  } while (next === currentChordName && names.length > 1);

  currentChordName = next;
  rootNotes = chords[next];
  phase = "root";
  expectedNotes = [...rootNotes];
  ghostNotes = [];
  incorrectPressCount = 0;
  tempHighlight = false;

  updateDisplay();
}

function pickInversion(): void {
  phase = "inversion";

  const [a, b, c] = rootNotes;

  // One note moves per inversion:
  // - 1st inversion (up): move bottom note up one octave → [b, c, a+12]
  // - 2nd inversion (down): move top note down one octave → [c-12, a, b]
  const candidates: { notes: number[]; ghost: number }[] = [];

  const upInv = [b, c, a + 12];
  if (upInv[2] <= 83) {
    candidates.push({ notes: upInv, ghost: a });
  }

  const downInv = [c - 12, a, b];
  if (downInv[0] >= 48) {
    candidates.push({ notes: downInv, ghost: c });
  }

  if (candidates.length === 0) {
    pickNewChord();
    return;
  }

  const picked = pickRandom(candidates);
  expectedNotes = picked.notes;
  ghostNotes = [picked.ghost];

  incorrectPressCount = 0;
  tempHighlight = false;

  updateDisplay();
}

// ── Display ──────────────────────────────────────────────────────────

function updateDisplay(): void {
  // Phase label
  if (phase === "root") {
    phaseLabelEl.textContent = "Root position";
  } else {
    phaseLabelEl.textContent = "Inversion";
  }

  // Chord name — show slash notation for inversions
  if (phase === "root") {
    chordNameEl.textContent = currentChordName;
  } else {
    chordNameEl.textContent = getInversionLabel(currentChordName, rootNotes, expectedNotes);
  }

  chordNotesEl.textContent = expectedNotes.map(midiToNoteName).join(", ");
  activeHandEl.textContent = handMode === "both" ? `(${activeHand} hand)` : "";

  // Piano highlighting
  const showHighlight = highlightCb.checked || tempHighlight;
  const yellow = showHighlight ? expectedNotes : [];
  const gray = showHighlight ? ghostNotes : [];
  const green: number[] = [];
  const red: number[] = [];

  for (const note of pressedNotes) {
    if (expectedNotes.includes(note)) green.push(note);
    else red.push(note);
  }

  piano.setAttribute("yellow", yellow.join(","));
  piano.setAttribute("gray", gray.join(","));
  piano.setAttribute("green", green.join(","));
  piano.setAttribute("red", red.join(","));

  const pressedNames = [...pressedNotes]
    .sort((a, b) => a - b)
    .map(midiToNoteName)
    .join(", ");
  pressedEl.textContent = pressedNames ? `Pressed: ${pressedNames}` : "\u00A0";
}

// ── Win check ────────────────────────────────────────────────────────

function checkWin(): void {
  if (hasWon || !gameRunning) return;

  const allPressed = expectedNotes.every((n) => pressedNotes.has(n));
  const noExtra = pressedNotes.size === expectedNotes.length;

  if (allPressed && noExtra) {
    hasWon = true;
    stats.chordsPlayed++;

    setTimeout(() => {
      if (!gameRunning) return;
      pressedNotes.clear();
      hasWon = false;

      if (phase === "root") {
        // After playing root position, ask for an inversion
        pickInversion();
      } else {
        // After playing inversion, pick a new chord
        pickNewChord();
      }
    }, 600);
  }
}

// ── MIDI handling ────────────────────────────────────────────────────

function onMIDIMessage(event: MIDIMessageEvent): void {
  if (!gameRunning) return;

  const [status, note, velocity] = event.data!;
  const command = status >> 4;

  if (command === 9 && velocity > 0) {
    session?.activity();

    const wasPressed = pressedNotes.has(note);
    pressedNotes.add(note);

    if (!wasPressed) {
      stats.notesPlayed++;
      if (expectedNotes.includes(note)) {
        stats.correctNotes++;
      } else {
        stats.incorrectNotes++;
      }

      if (!highlightCb.checked && !tempHighlight && !expectedNotes.includes(note)) {
        incorrectPressCount++;
        if (incorrectPressCount >= HELP_THRESHOLD) tempHighlight = true;
      }
    }
  } else if (command === 8 || (command === 9 && velocity === 0)) {
    pressedNotes.delete(note);
    hasWon = false;
  }

  updateDisplay();
  checkWin();
}

// ── Settings ─────────────────────────────────────────────────────────

const savedPreset = localStorage.getItem("inversions-preset");
if (savedPreset) {
  presetSelect.value = savedPreset;
  if (presetSelect.value !== savedPreset) {
    presetSelect.value = "all";
    localStorage.removeItem("inversions-preset");
  }
  preset = presetSelect.value as Preset;
}

presetSelect.addEventListener("change", () => {
  preset = presetSelect.value as Preset;
  localStorage.setItem("inversions-preset", preset);
  if (!gameRunning) {
    pressedNotes.clear();
    currentChordName = "";
    pickNewChord();
  }
});

const savedHand = localStorage.getItem("inversions-hand");
if (savedHand) {
  handSelect.value = savedHand;
  handMode = savedHand as Hand;
}

handSelect.addEventListener("change", () => {
  handMode = handSelect.value as Hand;
  localStorage.setItem("inversions-hand", handMode);
  if (!gameRunning) {
    pressedNotes.clear();
    currentChordName = "";
    pickNewChord();
  }
});

highlightCb.addEventListener("change", updateDisplay);

// ── Close dialog ────────────────────────────────────────────────────

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

pickNewChord();
void midiManager.initialize();
