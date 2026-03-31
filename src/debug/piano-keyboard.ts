import "../style.css";
import "../components/piano-keyboard.ts";
import { MIDIManager } from "../midi.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <h1>Piano Keyboard Component</h1>

  <section class="stack-sm">
    <p class="text-muted">MIDI: <span id="midi-status">initializing...</span></p>
    <piano-keyboard id="piano" style="height: 150px"></piano-keyboard>
  </section>

  <section class="stack-sm">
    <div class="row-sm center">
      <button class="btn btn-secondary btn-sm" title="invert left" id="invert-left">&larr; Invert</button>
      <button class="btn btn-secondary btn-sm" id="reset">Reset</button>
      <button class="btn btn-secondary btn-sm" title="invert right" id="invert-right">Invert &rarr;</button>
    </div>

    <div id="major-chords" style="display: grid; grid-template-columns: repeat(13, 1fr); gap: var(--space-xs)"></div>
    <div id="minor-chords" style="display: grid; grid-template-columns: repeat(13, 1fr); gap: var(--space-xs)"></div>
  </section>

  <section>
    <div class="row-sm center" style="flex-wrap: wrap">
      <span class="text-muted">Colors</span>
      <button class="btn btn-ghost btn-sm" id="show-gray">Gray</button>
      <button class="btn btn-ghost btn-sm" id="show-yellow">Yellow</button>
      <button class="btn btn-ghost btn-sm" id="show-orange">Orange</button>
      <button class="btn btn-ghost btn-sm" id="show-red">Red</button>
      <button class="btn btn-ghost btn-sm" id="show-green">Green</button>
      <button class="btn btn-ghost btn-sm" id="show-all-colors">All Colors</button>
    </div>
  </section>

  <section class="stack-sm">
    <piano-keyboard start="60" end="72" style="height: 120px; width: 500px; max-width: 100%; margin: 0 auto" yellow="60,64,67"></piano-keyboard>
  </section>

  <section class="stack-sm">
    <piano-keyboard start="21" end="108" style="height: 100px"></piano-keyboard>
  </section>
`;

const piano = document.getElementById("piano") as HTMLElement;

// Major chords: root position triads starting from C4 (MIDI 60)
const MAJOR_CHORDS: [string, string][] = [
  ["C", "60,64,67"],
  ["C#/Db", "61,65,68"],
  ["D", "62,66,69"],
  ["D#/Eb", "63,67,70"],
  ["E", "64,68,71"],
  ["F", "65,69,72"],
  ["F#/Gb", "66,70,73"],
  ["G", "67,71,74"],
  ["G#/Ab", "68,72,75"],
  ["A", "69,73,76"],
  ["A#/Bb", "70,74,77"],
  ["B", "71,75,78"],
];

// Minor chords: root position triads starting from C4
const MINOR_CHORDS: [string, string][] = [
  ["Cm", "60,63,67"],
  ["C#m", "61,64,68"],
  ["Dm", "62,65,69"],
  ["D#m", "63,66,70"],
  ["Em", "64,67,71"],
  ["Fm", "65,68,72"],
  ["F#m", "66,69,73"],
  ["Gm", "67,70,74"],
  ["G#m", "68,71,75"],
  ["Am", "69,72,76"],
  ["A#m", "70,73,77"],
  ["Bm", "71,74,78"],
];

function createChordButtons(
  container: HTMLElement,
  label: string,
  chords: [string, string][],
): void {
  const labelEl = document.createElement("span");
  labelEl.className = "text-muted";
  labelEl.textContent = label;
  container.appendChild(labelEl);

  for (const [name, notes] of chords) {
    const btn = document.createElement("button");
    btn.className = "btn btn-ghost btn-sm";
    btn.textContent = name;
    btn.addEventListener("click", () => piano.setAttribute("yellow", notes));
    container.appendChild(btn);
  }
}

createChordButtons(document.getElementById("major-chords")!, "Major", MAJOR_CHORDS);
createChordButtons(document.getElementById("minor-chords")!, "Minor", MINOR_CHORDS);

// Reset
document.getElementById("reset")!.addEventListener("click", () => {
  for (const attr of ["gray", "yellow", "orange", "red", "green"]) {
    piano.removeAttribute(attr);
  }
});

// Inversion helpers
function getYellowNotes(): number[] {
  return (piano.getAttribute("yellow") ?? "")
    .split(",")
    .map((n) => parseInt(n.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

document.getElementById("invert-right")!.addEventListener("click", () => {
  const notes = getYellowNotes();
  if (notes.length !== 3) return;
  const inverted = [notes[1], notes[2], notes[0] + 12];
  piano.setAttribute("yellow", inverted.join(","));
});

document.getElementById("invert-left")!.addEventListener("click", () => {
  const notes = getYellowNotes();
  if (notes.length !== 3) return;
  const inverted = [notes[2] - 12, notes[0], notes[1]];
  piano.setAttribute("yellow", inverted.join(","));
});

// Color state demos
const C_MAJOR = "60,64,67";
document.getElementById("show-gray")!.addEventListener("click", () => {
  piano.removeAttribute("yellow");
  piano.setAttribute("gray", C_MAJOR);
});
document.getElementById("show-yellow")!.addEventListener("click", () => {
  piano.removeAttribute("gray");
  piano.setAttribute("yellow", C_MAJOR);
});
document.getElementById("show-orange")!.addEventListener("click", () => {
  piano.setAttribute("orange", C_MAJOR);
});
document.getElementById("show-red")!.addEventListener("click", () => {
  piano.setAttribute("red", "61,65,68");
});
document.getElementById("show-green")!.addEventListener("click", () => {
  piano.setAttribute("green", C_MAJOR);
});
document.getElementById("show-all-colors")!.addEventListener("click", () => {
  piano.setAttribute("gray", "48,49,50,51");
  piano.setAttribute("yellow", "60,64,67");
  piano.setAttribute("orange", "72,76,79");
  piano.setAttribute("red", "61,65");
  piano.setAttribute("green", "64,67");
});

// MIDI input — highlight pressed keys with green on the main keyboard
const pressedNotes = new Set<number>();
const midiStatus = document.getElementById("midi-status")!;

function updatePressedDisplay(): void {
  piano.setAttribute("green", [...pressedNotes].sort((a, b) => a - b).join(","));
}

const midiManager = new MIDIManager({
  onMessage: (event) => {
    const [status, note, velocity] = event.data!;
    const command = status >> 4;

    if (command === 9 && velocity > 0) {
      pressedNotes.add(note);
    } else if (command === 8 || (command === 9 && velocity === 0)) {
      pressedNotes.delete(note);
    }
    updatePressedDisplay();
  },
  onConnectionChange: (connected, deviceName) => {
    midiStatus.textContent = connected ? deviceName : "not connected";
  },
});

void midiManager.initialize();
