import "../style.css";
import { start, stop, isRunning, setBpm, getBpm, setBeatsPerMeasure } from "../metronome.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <h1>Metronome</h1>

  <section class="stack-md">
    <div class="row-sm center">
      <label class="text-muted" for="bpm-input">BPM</label>
      <input id="bpm-input" class="input" type="number" min="30" max="300" value="120" style="width: 5em" />
      <input id="bpm-slider" type="range" min="30" max="300" value="120" style="flex: 1; max-width: 300px" />
    </div>

    <div class="row-sm center">
      <label class="text-muted" for="beats-select">Time</label>
      <select id="beats-select" class="select" style="width: 6em">
        <option value="2">2/4</option>
        <option value="3">3/4</option>
        <option value="4" selected>4/4</option>
        <option value="6">6/8</option>
      </select>
    </div>

    <div class="center">
      <button class="btn btn-primary" id="toggle-btn">Start</button>
    </div>
  </section>

  <section class="stack-sm">
    <div id="beat-dots" class="row-sm center" style="min-height: 48px"></div>
    <p id="beat-label" class="text-muted" style="font-variant-numeric: tabular-nums">—</p>
  </section>
`;

// ── Elements ────────────────────────────────────────────────────────

const bpmInput = document.getElementById("bpm-input") as HTMLInputElement;
const bpmSlider = document.getElementById("bpm-slider") as HTMLInputElement;
const beatsSelect = document.getElementById("beats-select") as HTMLSelectElement;
const toggleBtn = document.getElementById("toggle-btn")!;
const beatDots = document.getElementById("beat-dots")!;
const beatLabel = document.getElementById("beat-label")!;

// ── Beat dots ───────────────────────────────────────────────────────

function renderDots(count: number): void {
  beatDots.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("div");
    dot.className = "beat-dot";
    dot.dataset.index = String(i);
    Object.assign(dot.style, {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      background: "var(--border)",
      transition: "background var(--duration-fast), transform var(--duration-fast)",
    });
    beatDots.appendChild(dot);
  }
}

function highlightDot(beat: number, downbeat: boolean): void {
  const dots = beatDots.querySelectorAll<HTMLElement>(".beat-dot");
  for (const d of dots) {
    d.style.background = "var(--border)";
    d.style.transform = "scale(1)";
  }
  const active = dots[beat];
  if (active) {
    active.style.background = downbeat ? "var(--accent)" : "var(--fg-muted)";
    active.style.transform = "scale(1.3)";
  }
  beatLabel.textContent = `Beat ${beat + 1}`;
}

renderDots(4);

// ── BPM controls ────────────────────────────────────────────────────

bpmInput.addEventListener("input", () => {
  const val = Number(bpmInput.value);
  if (val >= 30 && val <= 300) {
    bpmSlider.value = String(val);
    setBpm(val);
  }
});

bpmSlider.addEventListener("input", () => {
  bpmInput.value = bpmSlider.value;
  setBpm(Number(bpmSlider.value));
});

// ── Time signature ──────────────────────────────────────────────────

beatsSelect.addEventListener("change", () => {
  const beats = Number(beatsSelect.value);
  setBeatsPerMeasure(beats);
  renderDots(beats);
});

// ── Start / stop ────────────────────────────────────────────────────

toggleBtn.addEventListener("click", () => {
  if (isRunning()) {
    stop();
    toggleBtn.textContent = "Start";
    toggleBtn.className = "btn btn-primary";
    beatLabel.textContent = "—";
    // Reset dots
    for (const d of beatDots.querySelectorAll<HTMLElement>(".beat-dot")) {
      d.style.background = "var(--border)";
      d.style.transform = "scale(1)";
    }
  } else {
    void start({
      bpm: getBpm(),
      beatsPerMeasure: Number(beatsSelect.value),
      onBeat: highlightDot,
    });
    toggleBtn.textContent = "Stop";
    toggleBtn.className = "btn btn-secondary";
  }
});
