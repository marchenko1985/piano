import "./style.css";
import "./components/piano-keyboard.ts";
import { BASE_CHORDS, PROGRESSIONS, midiToNoteName, transposeChords } from "./chords.ts";
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
// Deduplicate
for (const key of Object.keys(NEXT_CHORDS)) {
  NEXT_CHORDS[key] = [...new Set(NEXT_CHORDS[key])];
}

// ── Simple audio feedback ────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function ensureAudio(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function playRootNote(midiNote: number): void {
  const ctx = ensureAudio();
  if (ctx.state !== "running") void ctx.resume();

  const freq = 440 * 2 ** ((midiNote - 69) / 12);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.4);
}

// ── DOM ──────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <div class="row-sm center" style="flex-wrap: wrap">
    <span class="text-muted">MIDI:</span>
    <span id="midi-status" class="text-muted">initializing...</span>
    <span class="text-muted" style="margin-left: var(--space-md)">Hand:</span>
    <label><input type="radio" name="hand" value="left" /> left</label>
    <label><input type="radio" name="hand" value="right" checked /> right</label>
    <label><input type="radio" name="hand" value="both" /> both</label>
    <label style="margin-left: var(--space-md)"><input type="checkbox" id="highlight-cb" checked /> Highlight</label>
  </div>

  <div class="stack-sm">
    <div id="chord-name" style="font-size: var(--text-2xl); font-weight: bold"></div>
    <div id="chord-notes" class="text-muted"></div>
    <div id="active-hand" class="text-muted" style="font-style: italic"></div>
  </div>

  <piano-keyboard id="piano" start="48" end="83" style="height: 150px"></piano-keyboard>

  <div id="pressed" class="text-muted"></div>

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
      <button class="btn btn-primary" id="restart-btn">Play Again</button>
    </div>
  </dialog>
`;

const piano = document.getElementById("piano")!;
const chordNameEl = document.getElementById("chord-name")!;
const chordNotesEl = document.getElementById("chord-notes")!;
const activeHandEl = document.getElementById("active-hand")!;
const pressedEl = document.getElementById("pressed")!;
const midiStatusEl = document.getElementById("midi-status")!;
const highlightCb = document.getElementById("highlight-cb") as HTMLInputElement;
const progressEl = document.getElementById("progress") as HTMLProgressElement;
const resultsDialog = document.getElementById("results") as HTMLDialogElement;

// ── Game state ───────────────────────────────────────────────────────

let handMode: Hand = "right";
let activeHand: "left" | "right" = "right";
let chords: Record<string, readonly number[]> = { ...BASE_CHORDS };
const leftChords: Record<string, readonly number[]> = transposeChords(-12);

let expectedName = "";
let expectedNotes: readonly number[] = [];
const pressedNotes = new Set<number>();
let hasWon = false;
let chordCounter = 0;
let incorrectPressCount = 0;
let tempHighlight = false;
const HELP_THRESHOLD = 5;

const stats: Stats = { chordsPlayed: 0, notesPlayed: 0, correctNotes: 0, incorrectNotes: 0 };
let sessionActive = true;

// ── Session ──────────────────────────────────────────────────────────

let session: Session | null = null;
let statsInterval: ReturnType<typeof setInterval> | null = null;

function createSession(): Session {
  return new Session({
    totalDuration: 180_000,
    inactivityTimeout: 30_000,
    progressElement: progressEl,
    onEnd: endSession,
  });
}

function endSession(): void {
  if (!sessionActive) return;
  sessionActive = false;

  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }

  updateStatsDisplay();
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

// ── Chord picking ────────────────────────────────────────────────────

function updateChordsForHand(hand: "left" | "right"): void {
  chords = hand === "left" ? leftChords : { ...BASE_CHORDS };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomChord(): void {
  // Choose hand for this chord
  activeHand =
    handMode === "both" ? (Math.random() < 0.5 ? "left" : "right") : (handMode as "left" | "right");
  updateChordsForHand(activeHand);

  const names = Object.keys(chords);
  let next: string;

  // Every 8th chord, break progression loops
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

  expectedName = next;
  expectedNotes = chords[next];
  chordCounter++;
  incorrectPressCount = 0;
  tempHighlight = false;

  updateDisplay();
  playRootNote(expectedNotes[0]);
}

// ── Display ──────────────────────────────────────────────────────────

function updateDisplay(): void {
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
  pressedEl.textContent = pressedNames ? `Pressed: ${pressedNames}` : "";
}

// ── Win check ────────────────────────────────────────────────────────

function checkWin(): void {
  if (hasWon || !sessionActive) return;

  const allPressed = expectedNotes.every((n) => pressedNotes.has(n));
  const noExtra = pressedNotes.size === expectedNotes.length;

  if (allPressed && noExtra) {
    hasWon = true;
    stats.chordsPlayed++;

    setTimeout(() => {
      if (!sessionActive) return;
      pressedNotes.clear();
      hasWon = false;
      pickRandomChord();
    }, 600);
  }
}

// ── MIDI handling ────────────────────────────────────────────────────

function onMIDIMessage(event: MIDIMessageEvent): void {
  if (!sessionActive) return;

  const [status, note, velocity] = event.data!;
  const command = status >> 4;

  if (command === 9 && velocity > 0) {
    // Start session on first keypress
    if (session && !session.started) session.start();
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

      // Auto-help after too many wrong presses
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

// ── Hand selection ───────────────────────────────────────────────────

const saved = localStorage.getItem("random-hand");
if (saved) {
  const radio = document.querySelector<HTMLInputElement>(`input[name="hand"][value="${saved}"]`);
  if (radio) {
    radio.checked = true;
    handMode = saved as Hand;
  }
}

for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="hand"]')) {
  radio.addEventListener("change", () => {
    handMode = radio.value as Hand;
    localStorage.setItem("random-hand", handMode);
    pressedNotes.clear();
    hasWon = false;
    expectedName = "";
    chordCounter = 0;
    incorrectPressCount = 0;
    tempHighlight = false;
    pickRandomChord();
  });
}

highlightCb.addEventListener("change", updateDisplay);

// ── Restart ──────────────────────────────────────────────────────────

document.getElementById("restart-btn")!.addEventListener("click", () => {
  resultsDialog.close();
  resetGame();
});

function resetGame(): void {
  stats.chordsPlayed = 0;
  stats.notesPlayed = 0;
  stats.correctNotes = 0;
  stats.incorrectNotes = 0;
  sessionActive = true;
  pressedNotes.clear();
  hasWon = false;
  chordCounter = 0;
  incorrectPressCount = 0;
  tempHighlight = false;

  session?.destroy();
  session = createSession();

  if (statsInterval) clearInterval(statsInterval);
  statsInterval = setInterval(() => {
    if (session?.started) updateStatsDisplay();
  }, 1000);

  pickRandomChord();
}

// ── Init ─────────────────────────────────────────────────────────────

const midiManager = new MIDIManager({
  onMessage: onMIDIMessage,
  onConnectionChange: (connected, deviceName) => {
    midiStatusEl.textContent = connected ? deviceName : "not connected";
    if (connected) resetGame();
    else session?.pause();
  },
});

// Show first chord but don't create session until MIDI connects
pickRandomChord();
void midiManager.initialize();
