import "./style.css";
import "./components/piano-keyboard.ts";
import { SONG_STRUCTURES, buildChordNotes, midiToNoteName } from "./chords.ts";
import type { SongStructure } from "./chords.ts";
import { MIDIManager } from "./midi.ts";
import { Session } from "./session.ts";
import { renderNote } from "./sheet.ts";

// ── Types ────────────────────────────────────────────────────────────

type Hand = "left" | "right";

interface Stats {
  notesPlayed: number;
  correctNotes: number;
  incorrectNotes: number;
}

// ── Constants ────────────────────────────────────────────────────────

const HELP_THRESHOLD = 5;
const CORRECT_DELAY = 400;

// Comfortable octave ranges per hand
const LEFT_BASE = 48; // C3
const RIGHT_BASE = 60; // C4

// ── DOM ──────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";
app.style.justifyContent = "center";

app.innerHTML = `
  <h1>Note Reading</h1>

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
    <div id="active-hand" class="text-muted" style="font-style: italic; min-height: 1.4em">&nbsp;</div>
  </div>

  <piano-keyboard id="piano" start="36" end="84" style="height: 150px"></piano-keyboard>

  <div id="pressed" class="text-muted" style="text-align: center; min-height: 1.4em">&nbsp;</div>

  <progress id="progress" max="100" value="0"></progress>

  <dialog id="results" class="dialog stack-sm" style="text-align: left">
    <h2 style="text-align: center">Practice Complete</h2>
    <table style="margin: 0 auto">
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Time</th><td id="stat-time">0:00</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Notes</th><td id="stat-notes">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Mistakes</th><td id="stat-mistakes">0</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Accuracy</th><td id="stat-accuracy">100%</td></tr>
      <tr><th style="text-align: right; padding-right: var(--space-sm)">Speed</th><td id="stat-speed">0.0 npm</td></tr>
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
const activeHandEl = document.getElementById("active-hand")!;
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
let expectedNote = -1;

const pressedNotes = new Set<number>();
let hasWon = false;
let incorrectPressCount = 0;
let tempHighlight = false;

const stats: Stats = { notesPlayed: 0, correctNotes: 0, incorrectNotes: 0 };

// ── Song pattern sequence ────────────────────────────────────────────

// The sequence of MIDI notes to play through, built from a song pattern
let noteSequence: number[] = [];
let sequenceIndex = 0;
let sectionLabels: string[] = []; // parallel array: label for each note

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get the root MIDI note for a chord name, placed in the target octave.
 * Returns the root note closest to baseNote for smooth melodic movement.
 */
function chordRootMidi(chordName: string, baseOctave: number): number {
  const notes = buildChordNotes(chordName);
  if (!notes) return baseOctave; // fallback
  const rootPc = notes[0] % 12; // pitch class of root
  return baseOctave + rootPc;
}

/**
 * Build a loopable note sequence from a song structure.
 * Structure: Verse × 2 → Chorus × 1, then repeats.
 * Each chord contributes its root note.
 */
function buildSequence(
  song: SongStructure,
  hand: "left" | "right",
): { notes: number[]; labels: string[] } {
  const base = hand === "left" ? LEFT_BASE : RIGHT_BASE;
  const notes: number[] = [];
  const labels: string[] = [];

  // Build one cycle: verse, verse, chorus
  const sections: [string, readonly string[]][] = [
    ["Verse", song.verse],
    ["Verse", song.verse],
    ["Chorus", song.chorus],
  ];

  for (const [label, chords] of sections) {
    for (const chord of chords) {
      const midi = chordRootMidi(chord, base);
      notes.push(midi);
      labels.push(label);
    }
  }

  return { notes, labels };
}

function initSequence(): void {
  const song = pickRandom(SONG_STRUCTURES);
  const seq = buildSequence(song, handMode);
  noteSequence = seq.notes;
  sectionLabels = seq.labels;
  sequenceIndex = 0;
}

function advanceNote(): void {
  // Loop the sequence
  sequenceIndex = (sequenceIndex + 1) % noteSequence.length;

  expectedNote = noteSequence[sequenceIndex];
  incorrectPressCount = 0;
  tempHighlight = false;
  hasWon = false;

  updateDisplay();
}

function pickFirstNote(): void {
  initSequence();
  expectedNote = noteSequence[0];
  incorrectPressCount = 0;
  tempHighlight = false;
  hasWon = false;
  updateDisplay();
}

// ── Display ──────────────────────────────────────────────────────────

function clefForNote(midi: number): "treble" | "bass" {
  return midi >= 60 ? "treble" : "bass";
}

function updateDisplay(): void {
  // Section label
  if (gameRunning && sectionLabels.length > 0) {
    sectionLabelEl.textContent = sectionLabels[sequenceIndex] ?? "";
  } else {
    sectionLabelEl.innerHTML = "&nbsp;";
  }

  // Sheet music
  if (expectedNote >= 0) {
    const clef = clefForNote(expectedNote);

    let color: string | undefined;
    if (hasWon) {
      color = "limegreen";
    }

    renderNote(sheetEl, expectedNote, {
      clef,
      staffWidth: 150,
      scale: 1.2,
      color,
    });
  } else if (!gameRunning) {
    // Preview note before game starts
    const previewNote = handMode === "left" ? LEFT_BASE : RIGHT_BASE;
    renderNote(sheetEl, previewNote, {
      clef: handMode === "left" ? "bass" : "treble",
      staffWidth: 150,
      scale: 1.2,
    });
  } else {
    sheetEl.innerHTML = "&nbsp;";
  }

  // Note label below sheet (intermediate mode — always visible when enabled)
  if (labelsCb.checked && expectedNote >= 0 && gameRunning) {
    activeHandEl.textContent = midiToNoteName(expectedNote);
  } else {
    activeHandEl.innerHTML = "&nbsp;";
  }

  // Piano keyboard
  const showHighlight = highlightCb.checked || tempHighlight;

  const yellow: number[] = [];
  const green: number[] = [];
  const red: number[] = [];

  if (expectedNote >= 0 && gameRunning) {
    if (hasWon) {
      green.push(expectedNote);
    } else if (showHighlight) {
      yellow.push(expectedNote);
    }

    for (const n of pressedNotes) {
      if (n !== expectedNote) {
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
  document.getElementById("stat-notes")!.textContent = String(stats.notesPlayed);
  document.getElementById("stat-mistakes")!.textContent = String(stats.incorrectNotes);

  const total = stats.correctNotes + stats.incorrectNotes;
  const accuracy = total > 0 ? Math.round((stats.correctNotes / total) * 100) : 100;
  document.getElementById("stat-accuracy")!.textContent = `${accuracy}%`;

  const elapsedMin = secs / 60;
  const npm = elapsedMin > 0 ? (stats.notesPlayed / elapsedMin).toFixed(1) : "0.0";
  document.getElementById("stat-speed")!.textContent = `${npm} npm`;
}

// ── Start / Stop ─────────────────────────────────────────────────────

function updateStartButton(): void {
  startBtn.textContent = gameRunning ? "Stop" : "Start";
  handSelect.disabled = gameRunning;
  durationSelect.disabled = gameRunning;
}

function startGame(): void {
  stats.notesPlayed = 0;
  stats.correctNotes = 0;
  stats.incorrectNotes = 0;
  gameRunning = true;
  pressedNotes.clear();
  hasWon = false;
  incorrectPressCount = 0;
  tempHighlight = false;
  expectedNote = -1;

  session?.destroy();
  session = createSession();
  session.start();

  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(() => {
    if (session?.started) updateStatsDisplay();
  }, 1000);

  updateStartButton();
  pickFirstNote();
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
  if (hasWon || !gameRunning) return;

  // Correct when only the expected note is pressed
  if (pressedNotes.has(expectedNote) && pressedNotes.size === 1) {
    hasWon = true;
    stats.notesPlayed++;

    updateDisplay();

    setTimeout(() => {
      if (!gameRunning) return;
      pressedNotes.clear();
      advanceNote();
    }, CORRECT_DELAY);
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
      if (note === expectedNote) {
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

const savedHand = localStorage.getItem("notes-hand");
if (savedHand) {
  handSelect.value = savedHand;
  if (handSelect.value === savedHand) {
    handMode = savedHand as Hand;
  }
}

const savedHighlight = localStorage.getItem("notes-highlight");
if (savedHighlight !== null) highlightCb.checked = savedHighlight === "true";

const savedLabels = localStorage.getItem("notes-labels");
if (savedLabels !== null) labelsCb.checked = savedLabels === "true";

handSelect.addEventListener("change", () => {
  handMode = handSelect.value as Hand;
  localStorage.setItem("notes-hand", handMode);
});

highlightCb.addEventListener("change", () => {
  localStorage.setItem("notes-highlight", String(highlightCb.checked));
  updateDisplay();
});

labelsCb.addEventListener("change", () => {
  localStorage.setItem("notes-labels", String(labelsCb.checked));
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

// Show a preview note before game starts
renderNote(sheetEl, handMode === "left" ? LEFT_BASE : RIGHT_BASE, {
  clef: handMode === "left" ? "bass" : "treble",
  staffWidth: 150,
  scale: 1.2,
});

// Also support piano-keyboard click input
piano.addEventListener("key-click", ((e: CustomEvent<{ midi: number }>) => {
  if (!gameRunning) return;

  const midi = e.detail.midi;
  pressedNotes.clear();
  pressedNotes.add(midi);
  session?.activity();

  if (midi === expectedNote) {
    stats.correctNotes++;
  } else {
    stats.incorrectNotes++;
    if (!highlightCb.checked && !tempHighlight) {
      incorrectPressCount++;
      if (incorrectPressCount >= HELP_THRESHOLD) tempHighlight = true;
    }
  }

  updateDisplay();
  checkWin();

  // Auto-release after short delay for click input
  setTimeout(() => {
    pressedNotes.delete(midi);
    hasWon = false;
    updateDisplay();
  }, 300);
}) as EventListener);
