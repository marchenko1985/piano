import "./style.css";
import "./components/piano-keyboard.ts";
import {
  BASE_CHORDS,
  NOTE_NAMES,
  SONG_PATTERN_LIST,
  SONG_STRUCTURES,
  assignFingering,
  assignFingeringInContext,
  buildChordNotes,
  midiToNoteName,
  transposeChords,
} from "./chords.ts";
import { findClosestInversion, getInversionLabel } from "./voice-leading.ts";
import { MIDIManager } from "./midi.ts";
import { Session } from "./session.ts";

// ── Types ────────────────────────────────────────────────────────────

type Hand = "left" | "right";

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
  <div id="settings-section" class="stack-sm">
    <div class="row-sm center" style="flex-wrap: wrap">
      <span class="text-muted">MIDI:</span>
      <span id="midi-status" class="text-muted">initializing...</span>

      <select id="hand-select" class="select" style="width: auto; margin-left: var(--space-md)">
        <option value="right">Right hand</option>
        <option value="left">Left hand</option>
      </select>

      <select id="loops-select" class="select" style="width: auto">
        <option value="1">1 loop</option>
        <option value="2">2 loops</option>
        <option value="3" selected>3 loops</option>
        <option value="4">4 loops</option>
        <option value="5">5 loops</option>
        <option value="6">6 loops</option>
        <option value="7">7 loops</option>
        <option value="8">8 loops</option>
        <option value="9">9 loops</option>
        <option value="10">10 loops</option>
      </select>

      <label style="margin-left: var(--space-sm)"><input type="checkbox" id="highlight-cb" checked /> Highlight</label>
      <label><input type="checkbox" id="optimize-cb" /> Optimize</label>
    </div>

    <h2 style="font-size: var(--text-lg)">Sequence</h2>
    <textarea id="chord-input" class="input" rows="4" style="width: 100%; font-family: var(--font-mono); resize: vertical" placeholder="Paste chords here, e.g.: C Am F G&#10;Or use the generator below"></textarea>

    <div class="row-sm center" style="flex-wrap: wrap">
      <select id="key-select" class="select" style="width: 5em"></select>
      <select id="pattern-select" class="select" style="width: 14em"></select>
      <button class="btn btn-ghost" id="generate-btn">Generate</button>
      <span style="flex: 1"></span>
      <button class="btn btn-primary" id="submit-btn">Start</button>
    </div>
  </div>

  <div id="game-section" style="display: none" class="stack-sm">
    <div class="row-sm center" style="flex-wrap: wrap">
      <label><input type="checkbox" id="highlight-cb-game" checked /> Highlight</label>
      <label><input type="checkbox" id="optimize-cb-game" /> Optimize</label>
      <span style="flex: 1"></span>
      <span id="loop-label" class="text-muted"></span>
      <button class="btn btn-secondary" id="stop-btn">Stop</button>
    </div>

    <div id="grid-container" class="card" style="overflow-x: auto; padding: var(--space-sm)">
      <table id="chord-grid" style="margin: 0 auto; border-collapse: collapse"></table>
    </div>

    <div id="chord-name" style="font-size: var(--text-2xl); font-weight: bold"></div>
    <div id="chord-notes" class="text-muted"></div>

    <piano-keyboard id="piano" style="height: 150px"></piano-keyboard>

    <div id="pressed" class="text-muted">&nbsp;</div>

    <progress id="progress" max="100" value="0"></progress>
  </div>

  <dialog id="results" class="dialog stack-sm" style="text-align: left">
    <h2 style="text-align: center">Sequence Complete</h2>
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

// ── Elements ─────────────────────────────────────────────────────────

const piano = document.getElementById("piano")!;
const chordNameEl = document.getElementById("chord-name")!;
const chordNotesEl = document.getElementById("chord-notes")!;
const pressedEl = document.getElementById("pressed")!;
const midiStatusEl = document.getElementById("midi-status")!;
const highlightCb = document.getElementById("highlight-cb") as HTMLInputElement;
const optimizeCb = document.getElementById("optimize-cb") as HTMLInputElement;
const highlightCbGame = document.getElementById("highlight-cb-game") as HTMLInputElement;
const optimizeCbGame = document.getElementById("optimize-cb-game") as HTMLInputElement;
const progressEl = document.getElementById("progress") as HTMLProgressElement;
const resultsDialog = document.getElementById("results") as HTMLDialogElement;
const submitBtn = document.getElementById("submit-btn") as HTMLButtonElement;
const stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;
const handSelect = document.getElementById("hand-select") as HTMLSelectElement;
const loopsSelect = document.getElementById("loops-select") as HTMLSelectElement;
const keySelect = document.getElementById("key-select") as HTMLSelectElement;
const patternSelect = document.getElementById("pattern-select") as HTMLSelectElement;
const chordInput = document.getElementById("chord-input") as HTMLTextAreaElement;
const chordGrid = document.getElementById("chord-grid")!;
const settingsSection = document.getElementById("settings-section")!;
const gameSection = document.getElementById("game-section")!;

// ── Populate dropdowns ───────────────────────────────────────────────

for (const name of NOTE_NAMES) {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  keySelect.appendChild(opt);
}

for (const { id, label } of SONG_PATTERN_LIST) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = label;
  patternSelect.appendChild(opt);
}

// ── Generator ────────────────────────────────────────────────────────

document.getElementById("generate-btn")!.addEventListener("click", () => {
  const key = keySelect.value;
  const patternId = patternSelect.value;
  const structure = SONG_STRUCTURES.find((s) => s.pattern === patternId && s.key === key);
  if (!structure) return;

  const verse = structure.verse.join(" ");
  const chorus = structure.chorus.join(" ");
  // Verse x2 + Chorus x1
  chordInput.value = `${verse}\n${verse}\n${chorus}`;
});

// ── Parse textarea → 2D chord grid ──────────────────────────────────

interface ChordCell {
  name: string;
  rootNotes: number[];
  displayName: string;
  voiced: number[];
  ghostNotes: number[];
  fingers: readonly number[];
}

let grid: ChordCell[][] = [];
let currentRow = 0;
let currentCol = 0;
let currentLoop = 0;
let totalLoops = 3;
let hand: Hand = "right";

const leftChords = transposeChords(-12);

function parseGrid(): boolean {
  const text = chordInput.value.trim();
  if (!text) return false;

  hand = handSelect.value as Hand;
  const isLeft = hand === "left";

  const lines = text.split("\n").filter((l) => l.trim());
  const rawGrid: { name: string; notes: number[] }[][] = [];

  for (const line of lines) {
    const tokens = line.trim().split(/\s+/);
    const row: { name: string; notes: number[] }[] = [];

    for (const token of tokens) {
      // Try building notes for the chord name
      let notes = buildChordNotes(token);
      if (!notes) return false;

      // Transpose for left hand
      if (isLeft) {
        // Check if it's a simple chord name (not precise format)
        if (token in BASE_CHORDS && token in leftChords) {
          notes = [...leftChords[token]];
        } else {
          notes = notes.map((n) => n - 12);
        }
      }

      row.push({ name: token, notes });
    }

    if (row.length > 0) rawGrid.push(row);
  }

  if (rawGrid.length === 0) return false;

  // Apply voice leading if optimize is enabled
  if (optimizeCb.checked) {
    applyVoiceLeading(rawGrid);
  } else {
    grid = [];
    let prevNotes: number[] = [];
    let prevFingers: readonly number[] = [];
    for (const rawRow of rawGrid) {
      const row: ChordCell[] = [];
      for (const { name, notes } of rawRow) {
        const fingers =
          prevFingers.length === 3
            ? assignFingeringInContext(notes, hand, prevNotes, prevFingers)
            : assignFingering(notes, hand);
        row.push({
          name,
          rootNotes: notes,
          displayName: name,
          voiced: notes,
          ghostNotes: [],
          fingers,
        });
        prevNotes = notes;
        prevFingers = fingers;
      }
      grid.push(row);
    }
  }

  return true;
}

function applyVoiceLeading(rawGrid: { name: string; notes: number[] }[][]): void {
  const handOpt = { hand };
  grid = [];

  let prev: number[] | null = null;
  let prevFingers: readonly number[] = [];

  for (const rawRow of rawGrid) {
    const row: ChordCell[] = [];

    for (const { name, notes } of rawRow) {
      let voiced: number[];
      if (prev) {
        voiced = findClosestInversion(prev, notes, handOpt);
      } else {
        voiced = [...notes];
      }

      // Ghost keys: root position notes not in voiced chord
      const voicedSet = new Set(voiced);
      const ghostNotes: number[] = [];
      for (const n of notes) {
        if (!voicedSet.has(n)) ghostNotes.push(n);
      }

      const displayName = getInversionLabel(name, notes, voiced);

      const fingers =
        prev && prevFingers.length === 3
          ? assignFingeringInContext(voiced, hand, prev, prevFingers)
          : assignFingering(voiced, hand);

      row.push({ name, rootNotes: notes, displayName, voiced, ghostNotes, fingers });
      prev = voiced;
      prevFingers = fingers;
    }

    grid.push(row);
  }
}

// ── Re-optimize when toggle changes during game ─────────────────────

optimizeCb.addEventListener("change", () => {
  if (!gameRunning || grid.length === 0) return;

  // Re-parse with new optimization setting
  const text = chordInput.value.trim();
  if (!text) return;

  // Rebuild raw grid from current grid cell names
  const rawGrid = grid.map((row) =>
    row.map((cell) => ({
      name: cell.name,
      notes: [...cell.rootNotes],
    })),
  );

  if (optimizeCb.checked) {
    applyVoiceLeading(rawGrid);
  } else {
    grid = [];
    let prevNotes: number[] = [];
    let prevFingers: readonly number[] = [];
    for (const rawRow of rawGrid) {
      const row: ChordCell[] = [];
      for (const { name, notes } of rawRow) {
        const fingers =
          prevFingers.length === 3
            ? assignFingeringInContext(notes, hand, prevNotes, prevFingers)
            : assignFingering(notes, hand);
        row.push({
          name,
          rootNotes: notes,
          displayName: name,
          voiced: notes,
          ghostNotes: [],
          fingers,
        });
        prevNotes = notes;
        prevFingers = fingers;
      }
      grid.push(row);
    }
  }

  renderGrid();
  updateDisplay();
});

// ── Loop label ──────────────────────────────────────────────────────

const loopLabel = document.getElementById("loop-label")!;

function updateLoopLabel(): void {
  if (totalLoops > 1) {
    loopLabel.textContent = `Loop ${currentLoop + 1}/${totalLoops}`;
  } else {
    loopLabel.textContent = "";
  }
}

// ── Grid rendering ──────────────────────────────────────────────────

function renderGrid(): void {
  chordGrid.innerHTML = "";

  for (let r = 0; r < grid.length; r++) {
    const tr = document.createElement("tr");

    for (let c = 0; c < grid[r].length; c++) {
      const td = document.createElement("td");
      td.style.padding = "var(--space-xs) var(--space-sm)";
      td.style.whiteSpace = "nowrap";
      td.style.fontFamily = "var(--font-mono)";
      td.textContent = grid[r][c].displayName;

      if (r === currentRow && c === currentCol) {
        td.style.fontWeight = "bold";
        td.style.color = "var(--accent)";
      } else if (r < currentRow || (r === currentRow && c < currentCol)) {
        td.style.color = "var(--fg-muted)";
        td.style.opacity = "0.5";
      }

      tr.appendChild(td);
    }

    chordGrid.appendChild(tr);
  }
}

// ── Game state ───────────────────────────────────────────────────────

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
    totalDuration: 600_000, // 10 min max, but sequence end triggers completion
    inactivityTimeout: 60_000,
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
  updateUI();
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

// ── UI visibility ────────────────────────────────────────────────────

function updateUI(): void {
  settingsSection.style.display = gameRunning ? "none" : "";
  gameSection.style.display = gameRunning ? "" : "none";
}

// ── Start / Stop ─────────────────────────────────────────────────────

function startGame(): void {
  if (!parseGrid()) return;

  totalLoops = Number(loopsSelect.value) || 3;

  stats.chordsPlayed = 0;
  stats.notesPlayed = 0;
  stats.correctNotes = 0;
  stats.incorrectNotes = 0;
  gameRunning = true;
  pressedNotes.clear();
  hasWon = false;
  incorrectPressCount = 0;
  tempHighlight = false;

  currentRow = 0;
  currentCol = 0;
  currentLoop = 0;

  // Sync checkboxes from settings to game section
  highlightCbGame.checked = highlightCb.checked;
  optimizeCbGame.checked = optimizeCb.checked;

  // Set piano range based on hand
  if (hand === "left") {
    piano.setAttribute("start", "36");
    piano.setAttribute("end", "72");
  } else {
    piano.setAttribute("start", "48");
    piano.setAttribute("end", "84");
  }

  session?.destroy();
  session = createSession();
  session.start();

  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(() => {
    if (session?.started) updateStatsDisplay();
  }, 1000);

  renderGrid();
  updateLoopLabel();
  updateUI();
  updateDisplay();
}

function stopGame(): void {
  endSession();
}

submitBtn.addEventListener("click", () => {
  startGame();
});

stopBtn.addEventListener("click", () => {
  stopGame();
});

// ── Display ──────────────────────────────────────────────────────────

function currentCell(): ChordCell | null {
  if (currentRow >= grid.length) return null;
  if (currentCol >= grid[currentRow].length) return null;
  return grid[currentRow][currentCol];
}

function updateDisplay(): void {
  const cell = currentCell();
  if (!cell) return;

  chordNameEl.textContent = cell.displayName;
  chordNotesEl.textContent = cell.voiced.map(midiToNoteName).join(", ");

  // Piano highlighting
  const showHighlight = highlightCb.checked || tempHighlight;
  const yellow = showHighlight ? cell.voiced : [];
  const gray = showHighlight && optimizeCb.checked ? cell.ghostNotes : [];
  const green: number[] = [];
  const red: number[] = [];

  for (const note of pressedNotes) {
    if (cell.voiced.includes(note)) green.push(note);
    else red.push(note);
  }

  piano.setAttribute("yellow", yellow.join(","));
  piano.setAttribute("gray", gray.join(","));
  piano.setAttribute("green", green.join(","));
  piano.setAttribute("red", red.join(","));

  if (showHighlight && cell.voiced.length === 3 && cell.fingers.length === 3) {
    piano.setAttribute("fingers", cell.voiced.map((n, i) => `${n}:${cell.fingers[i]}`).join(","));
  } else {
    piano.removeAttribute("fingers");
  }

  const pressedNames = [...pressedNotes]
    .sort((a, b) => a - b)
    .map(midiToNoteName)
    .join(", ");
  pressedEl.textContent = pressedNames ? `Pressed: ${pressedNames}` : "\u00A0";
}

// ── Advance to next chord ────────────────────────────────────────────

function advance(): void {
  currentCol++;
  if (currentCol >= grid[currentRow].length) {
    currentCol = 0;
    currentRow++;
  }

  if (currentRow >= grid.length) {
    currentLoop++;
    if (currentLoop >= totalLoops) {
      endSession();
      return;
    }
    // Reset to top for next loop
    currentRow = 0;
    currentCol = 0;
  }

  updateLoopLabel();

  incorrectPressCount = 0;
  tempHighlight = false;
  renderGrid();
  updateDisplay();
}

// ── Win check ────────────────────────────────────────────────────────

function checkWin(): void {
  if (hasWon || !gameRunning) return;

  const cell = currentCell();
  if (!cell) return;

  const allPressed = cell.voiced.every((n) => pressedNotes.has(n));
  const noExtra = pressedNotes.size === cell.voiced.length;

  if (allPressed && noExtra) {
    hasWon = true;
    stats.chordsPlayed++;

    setTimeout(() => {
      if (!gameRunning) return;
      pressedNotes.clear();
      hasWon = false;
      advance();
    }, 600);
  }
}

// ── MIDI handling ────────────────────────────────────────────────────

function onMIDIMessage(event: MIDIMessageEvent): void {
  if (!gameRunning) return;

  const cell = currentCell();
  if (!cell) return;

  const [status, note, velocity] = event.data!;
  const command = status >> 4;

  if (command === 9 && velocity > 0) {
    session?.activity();

    const wasPressed = pressedNotes.has(note);
    pressedNotes.add(note);

    if (!wasPressed) {
      stats.notesPlayed++;
      if (cell.voiced.includes(note)) {
        stats.correctNotes++;
      } else {
        stats.incorrectNotes++;
      }

      if (!highlightCb.checked && !tempHighlight && !cell.voiced.includes(note)) {
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

// ── Settings persistence ─────────────────────────────────────────────

const savedHand = localStorage.getItem("sequence-hand");
if (savedHand) {
  handSelect.value = savedHand;
}

handSelect.addEventListener("change", () => {
  localStorage.setItem("sequence-hand", handSelect.value);
});

highlightCb.addEventListener("change", updateDisplay);

// Sync game-section checkboxes back to settings and trigger behavior
highlightCbGame.addEventListener("change", () => {
  highlightCb.checked = highlightCbGame.checked;
  updateDisplay();
});

optimizeCbGame.addEventListener("change", () => {
  optimizeCb.checked = optimizeCbGame.checked;
  optimizeCb.dispatchEvent(new Event("change"));
});

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

updateUI();
void midiManager.initialize();
