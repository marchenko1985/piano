import "./style.css";
import "./components/piano-keyboard.ts";
import {
  BASE_CHORDS,
  PROGRESSIONS,
  SONG_PATTERN_LIST,
  SONG_STRUCTURES,
  midiToNoteName,
  transposeChords,
} from "./chords.ts";
import type { SongStructure } from "./chords.ts";
import { MIDIManager } from "./midi.ts";
import { Session } from "./session.ts";

// ── Types ────────────────────────────────────────────────────────────

type Hand = "left" | "right" | "both";

interface Stats {
  chordsPlayed: number;
  notesPlayed: number;
  correctNotes: number;
  incorrectNotes: number;
}

// ── Build next-chord map from progressions ───────────────────────────

const NEXT_CHORDS: Record<string, string[]> = {};
for (const prog of PROGRESSIONS) {
  for (let i = 0; i < prog.length - 1; i++) {
    const cur = prog[i];
    const nxt = prog[i + 1];
    (NEXT_CHORDS[cur] ??= []).push(nxt);
  }
}
for (const key of Object.keys(NEXT_CHORDS)) {
  NEXT_CHORDS[key] = [...new Set(NEXT_CHORDS[key])];
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
      <option value="progression">Progression</option>
      <optgroup label="Verse + Chorus"></optgroup>
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
    <div id="section-label" class="text-accent" style="font-size: var(--text-sm); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em">&nbsp;</div>
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
const sectionLabelEl = document.getElementById("section-label")!;
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

// ── Populate song pattern options ────────────────────────────────────

const songOptgroup = presetSelect.querySelector("optgroup")!;
for (const { id, label } of SONG_PATTERN_LIST) {
  const opt = document.createElement("option");
  opt.value = `song:${id}`;
  opt.textContent = label;
  songOptgroup.appendChild(opt);
}

// ── Chord presets ────────────────────────────────────────────────────

type Preset = "all" | "major" | "minor" | "progression" | `song:${string}`;

const MAJOR_CHORDS: Record<string, readonly number[]> = Object.fromEntries(
  Object.entries(BASE_CHORDS).filter(([name]) => !name.includes("m")),
);

const MINOR_CHORDS: Record<string, readonly number[]> = Object.fromEntries(
  Object.entries(BASE_CHORDS).filter(([name]) => name.includes("m")),
);

function getChordsForPreset(preset: Preset): Record<string, readonly number[]> {
  if (preset === "major") return MAJOR_CHORDS;
  if (preset === "minor") return MINOR_CHORDS;
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

let activeProgression: readonly string[] | null = null;
let progressionIndex = 0;

// Song mode state: Verse(x2) → Chorus(x1) → repeat
let activeSong: SongStructure | null = null;
type SongSection = "verse1" | "verse2" | "chorus";
let songSection: SongSection = "verse1";
let songChordIndex = 0;

let expectedName = "";
let expectedNotes: readonly number[] = [];
const pressedNotes = new Set<number>();
let hasWon = false;
let chordCounter = 0;
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
  chordCounter = 0;
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
  activeProgression = null;
  progressionIndex = 0;
  activeSong = null;
  songSection = "verse1";
  songChordIndex = 0;

  updateStartButton();
  pickRandomChord();
}

function stopGame(): void {
  endSession();
}

startBtn.addEventListener("click", () => {
  if (gameRunning) stopGame();
  else startGame();
});

// ── Chord picking ────────────────────────────────────────────────────

function getChordsForHand(hand: "left" | "right"): Record<string, readonly number[]> {
  if (hand === "left") {
    if (preset === "major") return leftMajor;
    if (preset === "minor") return leftMinor;
    return leftChords;
  }
  if (preset.startsWith("song:") || preset === "progression") return BASE_CHORDS;
  return getChordsForPreset(preset);
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function advanceSongSection(): void {
  songChordIndex++;
  const sectionLength = activeSong
    ? (songSection === "chorus" ? activeSong.chorus : activeSong.verse).length
    : 4;

  if (songChordIndex >= sectionLength) {
    songChordIndex = 0;
    if (songSection === "verse1") songSection = "verse2";
    else if (songSection === "verse2") songSection = "chorus";
    else songSection = "verse1";
  }
}

function pickNextSongChord(): string {
  if (!activeSong) {
    const patternId = preset.slice(5); // strip "song:" prefix
    const candidates = SONG_STRUCTURES.filter((s) => s.pattern === patternId);
    activeSong = pickRandom(candidates.length > 0 ? candidates : SONG_STRUCTURES);
  }

  const section = songSection === "chorus" ? activeSong.chorus : activeSong.verse;
  return section[songChordIndex];
}

function pickNextProgressionChord(): string {
  if (!activeProgression) activeProgression = pickRandom(PROGRESSIONS);

  // Loop the same progression (not pick a new one)
  const chord = activeProgression[progressionIndex];
  progressionIndex = (progressionIndex + 1) % activeProgression.length;
  return chord;
}

function pickRandomChord(): void {
  activeHand =
    handMode === "both" ? (Math.random() < 0.5 ? "left" : "right") : (handMode as "left" | "right");
  chords = getChordsForHand(activeHand);

  let next: string;

  if (preset.startsWith("song:")) {
    next = pickNextSongChord();
  } else if (preset === "progression") {
    next = pickNextProgressionChord();
  } else {
    const names = Object.keys(chords);
    const shouldBreak = chordCounter > 0 && chordCounter % 8 === 0;

    if (shouldBreak || !expectedName) {
      do {
        next = pickRandom(names);
      } while (next === expectedName && names.length > 1);
    } else {
      const candidates = (NEXT_CHORDS[expectedName] ?? []).filter((c) => names.includes(c));
      if (candidates.length > 0) {
        next = pickRandom(candidates);
      } else {
        do {
          next = pickRandom(names);
        } while (next === expectedName && names.length > 1);
      }
    }
  }

  expectedName = next;
  expectedNotes = chords[next];
  chordCounter++;
  incorrectPressCount = 0;
  tempHighlight = false;

  updateDisplay();

  // Advance song/progression index *after* display so the label matches the current chord
  if (preset.startsWith("song:")) advanceSongSection();
}

// ── Display ──────────────────────────────────────────────────────────

function getSectionLabel(): string {
  if (preset.startsWith("song:")) {
    if (songSection === "chorus") return "Chorus";
    return "Verse";
  }
  if (preset === "progression" && activeProgression) return "Progression";
  return "";
}

function updateDisplay(): void {
  const label = getSectionLabel();
  sectionLabelEl.textContent = label || "\u00A0";

  chordNameEl.textContent = expectedName;
  chordNotesEl.textContent = expectedNotes.map(midiToNoteName).join(", ");
  activeHandEl.textContent = handMode === "both" ? `(${activeHand} hand)` : "";

  const showHighlight = highlightCb.checked || tempHighlight;
  const yellow = showHighlight ? expectedNotes : [];
  const green: number[] = [];
  const red: number[] = [];

  for (const note of pressedNotes) {
    if (expectedNotes.includes(note)) green.push(note);
    else red.push(note);
  }

  piano.setAttribute("yellow", yellow.join(","));
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
      pickRandomChord();
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

const savedPreset = localStorage.getItem("random-preset");
if (savedPreset) {
  presetSelect.value = savedPreset;
  // If the saved value doesn't match any option, reset to "all"
  if (presetSelect.value !== savedPreset) {
    presetSelect.value = "all";
    localStorage.removeItem("random-preset");
  }
  preset = presetSelect.value as Preset;
}

presetSelect.addEventListener("change", () => {
  preset = presetSelect.value as Preset;
  localStorage.setItem("random-preset", preset);
  if (!gameRunning) {
    pressedNotes.clear();
    expectedName = "";
    chordCounter = 0;
    activeProgression = null;
    progressionIndex = 0;
    activeSong = null;
    songSection = "verse1";
    songChordIndex = 0;
    pickRandomChord();
  }
});

const savedHand = localStorage.getItem("random-hand");
if (savedHand) {
  handSelect.value = savedHand;
  handMode = savedHand as Hand;
}

handSelect.addEventListener("change", () => {
  handMode = handSelect.value as Hand;
  localStorage.setItem("random-hand", handMode);
  if (!gameRunning) {
    pressedNotes.clear();
    expectedName = "";
    chordCounter = 0;
    pickRandomChord();
  }
});

highlightCb.addEventListener("change", updateDisplay);

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

pickRandomChord();
void midiManager.initialize();
