import "../style.css";
import "../components/piano-keyboard.ts";
import { startNote, startChord, type NoteHandle } from "../audio.ts";
import { BASE_CHORDS, midiToNoteName } from "../chords.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <h1>Web Audio</h1>

  <section class="stack-sm">
    <h2>Keyboard</h2>
    <p class="text-muted">Press and hold keys to play oscillator-synthesized notes.</p>
    <piano-keyboard id="piano" style="height: 120px"></piano-keyboard>
  </section>

  <section class="stack-sm">
    <h2>Chords</h2>
    <p class="text-muted">Press and hold a chord button to play it.</p>
    <div id="chord-buttons" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(70px, 1fr)); gap: var(--space-xs)"></div>
  </section>

  <section class="stack-sm">
    <h2>Sequences</h2>
    <p class="text-muted">Programmatic playback of chord progressions and melodies.</p>
    <div class="row-sm center">
      <button class="btn btn-secondary" id="play-progression">Chord progression</button>
      <button class="btn btn-secondary" id="play-melody">Melody</button>
    </div>
  </section>
`;

// ── Sequence helper ─────────────────────────────────────────────────

interface Step {
  notes: number[];
  duration: number;
}

let sequencePlaying = false;
let sequenceCancel = false;

async function playSequence(
  steps: Step[],
  play: (notes: number[]) => Promise<NoteHandle>,
): Promise<void> {
  if (sequencePlaying) {
    sequenceCancel = true;
    return;
  }
  sequencePlaying = true;
  sequenceCancel = false;

  for (const step of steps) {
    if (sequenceCancel) break;
    if (step.notes.length === 0) {
      piano.removeAttribute("yellow");
      await delay(step.duration);
      continue;
    }
    piano.setAttribute("yellow", step.notes.join(","));
    const handle = await play(step.notes);
    await delay(step.duration);
    handle.stop();
    await delay(50); // brief silence so repeated notes are audible
  }

  piano.removeAttribute("yellow");
  sequencePlaying = false;
  sequenceCancel = false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Keyboard playback ───────────────────────────────────────────────

const piano = document.getElementById("piano")!;
let activeKeyHandle: NoteHandle | null = null;
let keyDown = false;

piano.addEventListener("key-down", ((e: CustomEvent<{ midi: number }>) => {
  activeKeyHandle?.stop();
  keyDown = true;
  const midi = e.detail.midi;
  piano.setAttribute("yellow", String(midi));
  void startNote(midi).then((h) => {
    if (!keyDown) {
      h.stop();
    } else {
      activeKeyHandle = h;
    }
  });
}) as EventListener);

piano.addEventListener("key-up", (() => {
  keyDown = false;
  activeKeyHandle?.stop();
  activeKeyHandle = null;
  piano.removeAttribute("yellow");
}) as EventListener);

// ── Chord buttons ───────────────────────────────────────────────────

const chordContainer = document.getElementById("chord-buttons")!;

for (const [name, notes] of Object.entries(BASE_CHORDS)) {
  const btn = document.createElement("button");
  btn.className = "btn btn-ghost btn-sm";
  btn.textContent = name;
  btn.title = notes.map(midiToNoteName).join(", ");

  let handle: NoteHandle | null = null;
  let pressed = false;

  btn.addEventListener("mousedown", () => {
    pressed = true;
    piano.setAttribute("yellow", notes.join(","));
    void startChord(notes).then((h) => {
      if (!pressed) {
        h.stop();
      } else {
        handle = h;
      }
    });
  });

  const stop = () => {
    pressed = false;
    handle?.stop();
    handle = null;
    piano.removeAttribute("yellow");
  };
  btn.addEventListener("mouseup", stop);
  btn.addEventListener("mouseleave", stop);

  chordContainer.appendChild(btn);
}

// ── Sequences ───────────────────────────────────────────────────────

// I–V–vi–IV in C (C-G-Am-F), each chord played twice
const chordProgression: Step[] = [
  { notes: [...BASE_CHORDS["C"]], duration: 500 },
  { notes: [...BASE_CHORDS["C"]], duration: 500 },
  { notes: [...BASE_CHORDS["G"]], duration: 500 },
  { notes: [...BASE_CHORDS["G"]], duration: 500 },
  { notes: [...BASE_CHORDS["Am"]], duration: 500 },
  { notes: [...BASE_CHORDS["Am"]], duration: 500 },
  { notes: [...BASE_CHORDS["F"]], duration: 500 },
  { notes: [...BASE_CHORDS["F"]], duration: 500 },
];

// "Ode to Joy" opening phrase (E E F G | G F E D | C C D E | E D D)
const melody: Step[] = [
  { notes: [64], duration: 300 }, // E4
  { notes: [64], duration: 300 }, // E4
  { notes: [65], duration: 300 }, // F4
  { notes: [67], duration: 300 }, // G4
  { notes: [67], duration: 300 }, // G4
  { notes: [65], duration: 300 }, // F4
  { notes: [64], duration: 300 }, // E4
  { notes: [62], duration: 300 }, // D4
  { notes: [60], duration: 300 }, // C4
  { notes: [60], duration: 300 }, // C4
  { notes: [62], duration: 300 }, // D4
  { notes: [64], duration: 300 }, // E4
  { notes: [64], duration: 450 }, // E4 (dotted)
  { notes: [62], duration: 150 }, // D4 (short)
  { notes: [62], duration: 600 }, // D4 (held)
];

document.getElementById("play-progression")!.addEventListener("click", () => {
  void playSequence(chordProgression, (notes) => startChord(notes));
});

document.getElementById("play-melody")!.addEventListener("click", () => {
  void playSequence(melody, ([note]) => startNote(note));
});
