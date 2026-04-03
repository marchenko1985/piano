/**
 * Debug page for exploring scrolling sheet music with abcjs.
 *
 * Experiments:
 * 1. Multi-bar rendering (2 bars, 4 bars, 8+ bars)
 * 2. Horizontal scrolling container with playhead
 * 3. Long session rendered as one continuous staff
 * 4. Note highlighting during scroll
 * 5. Mix mode: different patterns per bar with rest bars
 */

import "../style.css";
import abcjs from "abcjs";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";
app.style.maxWidth = "900px";

app.innerHTML = `
  <h1>Sheet Scroll Debug</h1>
  <p class="text-muted">Experimenting with scrolling sheet music for mix mode.</p>

  <section class="card stack-sm" style="padding: var(--space-md)">
    <h3 style="margin: 0">1. Single bar (current behavior)</h3>
    <div id="ex-single"></div>
  </section>

  <section class="card stack-sm" style="padding: var(--space-md)">
    <h3 style="margin: 0">2. Two bars side by side</h3>
    <p class="text-muted" style="margin: 0; font-size: var(--text-sm)">Current pattern + next pattern, like a teleprompter.</p>
    <div id="ex-two"></div>
  </section>

  <section class="card stack-sm" style="padding: var(--space-md)">
    <h3 style="margin: 0">3. Four bars (Alberti → rest → Arpeggio up → rest)</h3>
    <p class="text-muted" style="margin: 0; font-size: var(--text-sm)">Mix mode preview: pattern A, rest, pattern B, rest.</p>
    <div id="ex-four"></div>
  </section>

  <section class="card stack-sm" style="padding: var(--space-md)">
    <h3 style="margin: 0">4. Long scroll (8 bars in a scrolling container)</h3>
    <p class="text-muted" style="margin: 0; font-size: var(--text-sm)">Full session as one long staff. Uses wide staffwidth + overflow scroll.</p>
    <div id="ex-scroll-container" style="overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-sm)">
      <div id="ex-scroll" style="min-width: max-content"></div>
    </div>
  </section>

  <section class="card stack-sm" style="padding: var(--space-md)">
    <h3 style="margin: 0">5. Animated scroll with playhead</h3>
    <p class="text-muted" style="margin: 0; font-size: var(--text-sm)">Auto-scrolling at tempo with a playhead marker. Click to start/stop.</p>
    <div class="row-sm">
      <button class="btn btn-primary btn-sm" id="play-btn">▶ Play</button>
      <span class="text-muted" id="beat-label">Beat: 0</span>
    </div>
    <div style="position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-sm)">
      <div id="playhead" style="
        position: absolute; left: 50%; top: 0; bottom: 0; width: 2px;
        background: var(--accent); z-index: 10;
        transform: translateX(-50%);
      "></div>
      <div id="ex-animated" style="position: relative; transition: none;"></div>
    </div>
  </section>

  <section class="card stack-sm" style="padding: var(--space-md)">
    <h3 style="margin: 0">6. Wrapping staff (natural line breaks)</h3>
    <p class="text-muted" style="margin: 0; font-size: var(--text-sm)">Let abcjs wrap to multiple lines. 16 bars, default staffwidth.</p>
    <div id="ex-wrap"></div>
  </section>
`;

// ── ABC patterns for C major ────────────────────────────────────────

const ALBERTI = "C G E G"; // Alberti bass (quarter notes)
const ARPEGGIO_UP = "C E G c"; // Arpeggio ascending
const ARPEGGIO_DOWN = "c G E C"; // Arpeggio descending
const WALKING = "C E G E"; // Walking bass
const REST_BAR = "z4"; // Full bar rest

// ── 1. Single bar ───────────────────────────────────────────────────

abcjs.renderAbc("ex-single", ["X:1", "M:4/4", "L:1/4", "K:C", `|:${ALBERTI}:|`].join("\n"), {
  staffwidth: 280,
  scale: 1.3,
  add_classes: true,
});

// ── 2. Two bars ─────────────────────────────────────────────────────

abcjs.renderAbc(
  "ex-two",
  ["X:1", "M:4/4", "L:1/4", "K:C", `|:${ALBERTI}|${ARPEGGIO_UP}:|`].join("\n"),
  { staffwidth: 450, scale: 1.3, add_classes: true },
);

// ── 3. Four bars (mix mode) ─────────────────────────────────────────

abcjs.renderAbc(
  "ex-four",
  ["X:1", "M:4/4", "L:1/4", "K:C", `|${ALBERTI}|${REST_BAR}|${ARPEGGIO_UP}|${REST_BAR}|`].join(
    "\n",
  ),
  { staffwidth: 700, scale: 1.2, add_classes: true },
);

// ── 4. Long scroll (8 bars) ────────────────────────────────────────

const eightBars = [
  ALBERTI,
  ALBERTI,
  REST_BAR,
  ARPEGGIO_UP,
  ARPEGGIO_UP,
  REST_BAR,
  WALKING,
  WALKING,
].join("|");

abcjs.renderAbc("ex-scroll", ["X:1", "M:4/4", "L:1/4", "K:C", `|${eightBars}|`].join("\n"), {
  staffwidth: 1600,
  scale: 1.2,
  add_classes: true,
  wrap: undefined,
});

// ── 5. Animated scroll ──────────────────────────────────────────────

const animatedBars = [
  ALBERTI,
  ALBERTI,
  ALBERTI,
  ALBERTI,
  REST_BAR,
  ARPEGGIO_UP,
  ARPEGGIO_UP,
  ARPEGGIO_UP,
  ARPEGGIO_UP,
  REST_BAR,
  ARPEGGIO_DOWN,
  ARPEGGIO_DOWN,
  ARPEGGIO_DOWN,
  ARPEGGIO_DOWN,
  REST_BAR,
  WALKING,
  WALKING,
  WALKING,
  WALKING,
].join("|");

const animatedEl = document.getElementById("ex-animated")!;
abcjs.renderAbc("ex-animated", ["X:1", "M:4/4", "L:1/4", "K:C", `|${animatedBars}|`].join("\n"), {
  staffwidth: 3800,
  scale: 1.2,
  add_classes: true,
  wrap: undefined,
});

// Get actual note X positions from the rendered SVG
const animSvg = animatedEl.querySelector("svg");
const totalAnimBeats = 19 * 4; // 19 bars × 4 beats
const BPM = 90;
const MS_PER_BEAT = 60000 / BPM;

let playing = false;
let startTime = 0;
let animRafId = 0;
const playBtn = document.getElementById("play-btn")!;
const beatLabel = document.getElementById("beat-label")!;

// Build a beat→X position map from the rendered SVG elements.
// Each element has an abcjs-d class encoding its duration (e.g. d0-25 = quarter, d1 = whole).
// We accumulate beats so scrolling and highlighting stay in sync.
interface BeatEntry {
  el: Element;
  x: number; // center X relative to SVG
  startBeat: number; // cumulative beat where this element starts
  beats: number; // duration in beats (quarter = 1)
}

const noteAndRestEls = animSvg ? [...animSvg.querySelectorAll(".abcjs-note, .abcjs-rest")] : [];
const svgRect = animSvg?.getBoundingClientRect();

function parseDuration(el: Element): number {
  // abcjs class like "abcjs-d0-25" → 0.25 whole notes → 1 beat (in 4/4 with L:1/4)
  // "abcjs-d1" → 1 whole note → 4 beats
  const match = (el as SVGElement).className.baseVal?.match(/abcjs-d(\d+(?:-\d+)?)/);
  if (!match) return 1;
  const raw = match[1].replace("-", "."); // "0-25" → "0.25"
  const wholeNotes = parseFloat(raw);
  return wholeNotes * 4; // convert whole notes to quarter-note beats
}

const beatMap: BeatEntry[] = [];
let cumulativeBeat = 0;
for (const el of noteAndRestEls) {
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2 - (svgRect?.left ?? 0);
  const beats = parseDuration(el);
  beatMap.push({ el, x, startBeat: cumulativeBeat, beats });
  cumulativeBeat += beats;
}

// Find the entry active at a given beat (for highlighting)
function getEntryAtBeat(beat: number): { entry: BeatEntry; index: number } | null {
  for (let i = beatMap.length - 1; i >= 0; i--) {
    if (beat >= beatMap[i].startBeat) return { entry: beatMap[i], index: i };
  }
  return beatMap.length > 0 ? { entry: beatMap[0], index: 0 } : null;
}

// Interpolate X position for fractional beats using actual note positions
function getXForBeat(beat: number): number {
  const cur = getEntryAtBeat(beat);
  if (!cur) return 0;
  const { entry, index } = cur;
  const next = beatMap[index + 1];
  if (!next) return entry.x;
  const frac = (beat - entry.startBeat) / entry.beats;
  return entry.x + (next.x - entry.x) * frac;
}

const CONTAINER_WIDTH = animatedEl.parentElement!.clientWidth;

// Set initial position: first note at center (playhead)
const initialX = CONTAINER_WIDTH / 2 - (beatMap[0]?.x ?? 0);
animatedEl.style.transform = `translateX(${initialX}px)`;

function animateScroll(): void {
  if (!playing) return;
  animRafId = requestAnimationFrame(animateScroll);

  const elapsed = performance.now() - startTime;
  const beat = elapsed / MS_PER_BEAT;
  beatLabel.textContent = `Beat: ${Math.floor(beat)} / ${totalAnimBeats}`;

  if (beat >= totalAnimBeats) {
    playing = false;
    playBtn.textContent = "▶ Play";
    cancelAnimationFrame(animRafId);
    return;
  }

  // Scroll using actual note positions — highlight stays perfectly in sync
  const currentX = getXForBeat(beat);
  const translateX = CONTAINER_WIDTH / 2 - currentX;
  animatedEl.style.transform = `translateX(${translateX}px)`;

  // Highlight the currently active element (uses beat map for correct timing)
  const active = getEntryAtBeat(beat);
  const activeIdx = active?.index ?? -1;
  for (let i = 0; i < beatMap.length; i++) {
    const el = beatMap[i].el as SVGElement;
    if (i === activeIdx) {
      el.setAttribute("fill", "oklch(0.55 0.2 260)");
      el.setAttribute("stroke", "oklch(0.55 0.2 260)");
    } else {
      el.removeAttribute("fill");
      el.removeAttribute("stroke");
    }
  }
}

playBtn.addEventListener("click", () => {
  if (playing) {
    playing = false;
    playBtn.textContent = "▶ Play";
    cancelAnimationFrame(animRafId);
    // Reset to initial position
    animatedEl.style.transform = `translateX(${initialX}px)`;
    // Reset colors
    for (const { el } of beatMap) {
      (el as SVGElement).removeAttribute("fill");
      (el as SVGElement).removeAttribute("stroke");
    }
  } else {
    playing = true;
    playBtn.textContent = "■ Stop";
    startTime = performance.now();
    animRafId = requestAnimationFrame(animateScroll);
  }
});

// ── 6. Wrapping staff ───────────────────────────────────────────────

const sixteenBars = Array(4).fill([ALBERTI, ALBERTI, REST_BAR, ARPEGGIO_UP].join("|")).join("|");

// Use wrap option so abcjs breaks into multiple lines
abcjs.renderAbc("ex-wrap", ["X:1", "M:4/4", "L:1/4", "K:C", `|${sixteenBars}|`].join("\n"), {
  staffwidth: 700,
  scale: 1.1,
  add_classes: true,
  wrap: { minSpacing: 1.5, maxSpacing: 2.5, preferredMeasuresPerLine: 4 },
});
