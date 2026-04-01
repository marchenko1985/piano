import "../style.css";
import "../components/piano-keyboard.ts";
import {
  BASE_CHORDS,
  PROGRESSIONS,
  buildChordNotes,
  midiToNoteName,
  noteNameToMidi,
  notesToChordName,
  notesToPreciseString,
  parseChord,
  parsePreciseNotes,
  assignFingering,
  transposeChords,
} from "../chords.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <h1>Chords Module</h1>

  <section class="stack-sm">
    <h2>Parse & Build</h2>
    <p class="text-muted">Type a chord name to parse and visualize it on the keyboard.</p>
    <div class="row-sm center">
      <input id="chord-input" class="input" placeholder='e.g. "C", "Dm3", "C4-E4-G4", "F/C"' style="max-width: 300px" />
      <button class="btn btn-primary" id="parse-btn">Parse</button>
    </div>
    <pre id="parse-output" style="text-align: left; font-size: var(--text-sm); margin: 0 auto; max-width: 500px"></pre>
    <piano-keyboard id="piano-parse" style="height: 120px; width: 600px; max-width: 100%; margin: 0 auto"></piano-keyboard>
  </section>

  <section class="stack-sm">
    <h2>MIDI &harr; Note Name</h2>
    <div style="display: grid; grid-template-columns: 240px auto; gap: var(--space-sm); align-items: center; max-width: 400px; margin: 0 auto">
      <input id="midi-input" class="input" type="number" placeholder="MIDI (0-127)" min="0" max="127" />
      <span id="midi-output" class="text-muted">—</span>
      <input id="note-input" class="input" placeholder='Note name (e.g. "C4")' />
      <span id="note-output" class="text-muted">—</span>
    </div>
  </section>

  <section class="stack-sm">
    <h2>Reverse Lookup</h2>
    <p class="text-muted">Click keys on the keyboard below, then identify the chord.</p>
    <piano-keyboard id="piano-reverse" style="height: 120px; width: 600px; max-width: 100%; margin: 0 auto"></piano-keyboard>
    <div class="row-sm center">
      <button class="btn btn-secondary btn-sm" id="identify-btn">Identify</button>
      <button class="btn btn-ghost btn-sm" id="clear-reverse">Clear</button>
    </div>
    <p id="reverse-output" class="text-muted">Click keys to select notes</p>
  </section>

  <section class="stack-sm">
    <h2>Progressions</h2>
    <p class="text-muted">${PROGRESSIONS.length} progressions across 12 keys. Click to visualize.</p>
    <div id="progressions" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-xs)"></div>
    <piano-keyboard id="piano-prog" style="height: 120px"></piano-keyboard>
    <div class="row-sm center">
      <button class="btn btn-ghost btn-sm" id="prog-prev">&larr;</button>
      <span id="prog-label" class="text-muted">—</span>
      <button class="btn btn-ghost btn-sm" id="prog-next">&rarr;</button>
    </div>
  </section>

  <section class="stack-sm">
    <h2>All Base Chords</h2>
    <p class="text-muted">${Object.keys(BASE_CHORDS).length} triads. Click to visualize.</p>
    <piano-keyboard id="piano-all" style="height: 120px; width: 600px; max-width: 100%; margin: 0 auto"></piano-keyboard>
    <div id="all-chords" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: var(--space-xs)"></div>
  </section>
`;

// ── Parse & Build ────────────────────────────────────────────────────

const chordInput = document.getElementById("chord-input") as HTMLInputElement;
const parseOutput = document.getElementById("parse-output")!;
const pianoParse = document.getElementById("piano-parse")!;

function doParse(): void {
  const val = chordInput.value.trim();
  if (!val) {
    parseOutput.textContent = "";
    pianoParse.removeAttribute("yellow");
    pianoParse.removeAttribute("fingers");
    return;
  }

  const lines: string[] = [];

  // Try precise notes
  const precise = parsePreciseNotes(val);
  if (precise) {
    lines.push(`Format: precise notes`);
    lines.push(`Notes:  ${precise.notes.map(midiToNoteName).join(", ")}`);
    lines.push(`MIDI:   ${precise.notes.join(", ")}`);
    pianoParse.setAttribute("yellow", precise.notes.join(","));
    if (precise.notes.length === 3) {
      const fingers = assignFingering(precise.notes);
      lines.push(`Fingering: ${fingers.join("-")}`);
      pianoParse.setAttribute(
        "fingers",
        precise.notes.map((n, i) => `${n}:${fingers[i]}`).join(","),
      );
    } else {
      pianoParse.removeAttribute("fingers");
    }
  } else {
    const parsed = parseChord(val);
    if (!parsed) {
      lines.push("Could not parse chord.");
      pianoParse.removeAttribute("yellow");
      pianoParse.removeAttribute("fingers");
    } else if ("isSlashChord" in parsed) {
      lines.push(`Format: slash chord`);
      lines.push(`Root:   ${parsed.rootChord}`);
      lines.push(`Bass:   ${parsed.bassNote}`);
      const notes = buildChordNotes(val);
      if (notes) {
        lines.push(`Notes:  ${notes.map(midiToNoteName).join(", ")}`);
        lines.push(`MIDI:   ${notes.join(", ")}`);
        if (notes.length === 3) {
          const fingers = assignFingering(notes);
          lines.push(`Fingering: ${fingers.join("-")}`);
          pianoParse.setAttribute("fingers", notes.map((n, i) => `${n}:${fingers[i]}`).join(","));
        } else {
          pianoParse.removeAttribute("fingers");
        }
        pianoParse.setAttribute("yellow", notes.join(","));
      }
    } else {
      lines.push(`Format: standard`);
      lines.push(`Root:   ${parsed.root}`);
      lines.push(`Quality: ${parsed.quality}`);
      lines.push(`Octave: ${parsed.octave ?? "4 (default)"}`);
      const notes = buildChordNotes(val);
      if (notes) {
        lines.push(`Notes:  ${notes.map(midiToNoteName).join(", ")}`);
        lines.push(`MIDI:   ${notes.join(", ")}`);
        lines.push(`Precise: ${notesToPreciseString(notes)}`);
        const fingers = assignFingering(notes);
        lines.push(`Fingering: ${fingers.join("-")}`);
        pianoParse.setAttribute("yellow", notes.join(","));
        pianoParse.setAttribute("fingers", notes.map((n, i) => `${n}:${fingers[i]}`).join(","));
      }
    }
  }

  parseOutput.textContent = lines.join("\n");
}

document.getElementById("parse-btn")!.addEventListener("click", doParse);
chordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doParse();
});

// ── MIDI ↔ Note Name ─────────────────────────────────────────────────

const midiInput = document.getElementById("midi-input") as HTMLInputElement;
const midiOutput = document.getElementById("midi-output")!;
midiInput.addEventListener("input", () => {
  const n = Number(midiInput.value);
  midiOutput.textContent = Number.isFinite(n) && n >= 0 && n <= 127 ? midiToNoteName(n) : "—";
});

const noteInput = document.getElementById("note-input") as HTMLInputElement;
const noteOutput = document.getElementById("note-output")!;
noteInput.addEventListener("input", () => {
  const midi = noteNameToMidi(noteInput.value);
  noteOutput.textContent = midi !== null ? `MIDI ${midi}` : "—";
});

// ── Reverse Lookup ───────────────────────────────────────────────────

const pianoReverse = document.getElementById("piano-reverse")!;
const reverseOutput = document.getElementById("reverse-output")!;
const selectedNotes = new Set<number>();

pianoReverse.addEventListener("key-click", ((e: CustomEvent<{ midi: number }>) => {
  const midi = e.detail.midi;

  if (selectedNotes.has(midi)) selectedNotes.delete(midi);
  else selectedNotes.add(midi);

  pianoReverse.setAttribute("yellow", [...selectedNotes].join(","));
  reverseOutput.textContent =
    selectedNotes.size > 0
      ? `Selected: ${[...selectedNotes]
          .sort((a, b) => a - b)
          .map(midiToNoteName)
          .join(", ")}`
      : "Click keys to select notes";
}) as EventListener);

document.getElementById("identify-btn")!.addEventListener("click", () => {
  if (selectedNotes.size === 0) return;
  const sorted = [...selectedNotes].sort((a, b) => a - b);
  const name = notesToChordName(sorted);
  reverseOutput.textContent = name
    ? `${name}  (${notesToPreciseString(sorted)})`
    : `Unknown chord  (${notesToPreciseString(sorted)})`;
});

document.getElementById("clear-reverse")!.addEventListener("click", () => {
  selectedNotes.clear();
  pianoReverse.removeAttribute("yellow");
  reverseOutput.textContent = "Click keys to select notes";
});

// ── Progressions ─────────────────────────────────────────────────────

const progContainer = document.getElementById("progressions")!;
const pianoProg = document.getElementById("piano-prog")!;
const progLabel = document.getElementById("prog-label")!;
let activeProgression: readonly string[] | null = null;
let progIndex = 0;

function showProgChord(): void {
  if (!activeProgression) return;
  const chord = activeProgression[progIndex];
  const notes = buildChordNotes(chord);
  progLabel.textContent = `${chord}  (${progIndex + 1}/${activeProgression.length})`;
  if (notes) {
    pianoProg.setAttribute("yellow", notes.join(","));
  }
}

for (const prog of PROGRESSIONS) {
  const btn = document.createElement("button");
  btn.className = "btn btn-ghost btn-sm";
  btn.textContent = prog.join(" → ");
  btn.addEventListener("click", () => {
    activeProgression = prog;
    progIndex = 0;
    showProgChord();
  });
  progContainer.appendChild(btn);
}

document.getElementById("prog-prev")!.addEventListener("click", () => {
  if (!activeProgression) return;
  progIndex = (progIndex - 1 + activeProgression.length) % activeProgression.length;
  showProgChord();
});

document.getElementById("prog-next")!.addEventListener("click", () => {
  if (!activeProgression) return;
  progIndex = (progIndex + 1) % activeProgression.length;
  showProgChord();
});

// ── All Base Chords ──────────────────────────────────────────────────

const allChordsContainer = document.getElementById("all-chords")!;
const pianoAll = document.getElementById("piano-all")!;

for (const [name, notes] of Object.entries(BASE_CHORDS)) {
  const btn = document.createElement("button");
  btn.className = "btn btn-ghost btn-sm";
  btn.textContent = name;
  btn.title = notes.map(midiToNoteName).join(", ");
  btn.addEventListener("click", () => {
    pianoAll.setAttribute("yellow", notes.join(","));
  });
  allChordsContainer.appendChild(btn);
}

// Verify transposeChords works (no UI, just a quick sanity check logged to console)
const leftHand = transposeChords(-12);
console.log("transposeChords(-12) C:", leftHand["C"]);
