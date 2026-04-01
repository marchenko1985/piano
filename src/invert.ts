import "./style.css";
import "./components/piano-keyboard.ts";
import {
  PROGRESSIONS,
  assignFingering,
  assignFingeringInContext,
  buildChordNotes,
  midiToNoteName,
} from "./chords.ts";
import { chordDistance, getAllInversions, getInversionLabel } from "./voice-leading.ts";

// ── DOM ──────────────────────────────────────────────────────────────

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";
app.style.maxWidth = "700px";

app.innerHTML = `
  <h1>Inversion Explorer</h1>
  <p class="text-muted">Enter chords to find the most ergonomic inversions for smooth voice leading.</p>

  <div class="row-sm center" style="flex-wrap: wrap">
    <input id="chord-input" class="input" placeholder="e.g. Am F C G" style="flex: 1; min-width: 200px" />
    <button class="btn btn-ghost" id="random-btn">Random</button>
    <button class="btn btn-primary" id="go-btn">Explore</button>
  </div>

  <div id="results" class="stack-lg"></div>
`;

const chordInput = document.getElementById("chord-input") as HTMLInputElement;
const resultsEl = document.getElementById("results")!;

// ── Types ────────────────────────────────────────────────────────────

interface ChordVoicing {
  name: string;
  rootNotes: readonly number[];
  voiced: number[];
  displayName: string;
  ghostNotes: number[];
  fingers: readonly number[];
}

// ── Random progression ──────────────────────────────────────────────

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

document.getElementById("random-btn")!.addEventListener("click", () => {
  const prog = pickRandom(PROGRESSIONS);
  chordInput.value = prog.join(" ");
});

// ── Parse input → chord list ────────────────────────────────────────

function parseChords(text: string): { name: string; notes: number[] }[] | null {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  const chords: { name: string; notes: number[] }[] = [];
  for (const token of tokens) {
    const notes = buildChordNotes(token);
    if (!notes || notes.length !== 3) return null;
    chords.push({ name: token, notes });
  }
  return chords;
}

// ── Build voicings ──────────────────────────────────────────────────

function buildOriginal(chords: { name: string; notes: number[] }[]): ChordVoicing[] {
  let prevFingers: readonly number[] = [];
  let prevNotes: number[] = [];

  return chords.map(({ name, notes }) => {
    const fingers =
      prevFingers.length === 3
        ? assignFingeringInContext(notes, "right", prevNotes, prevFingers)
        : assignFingering(notes, "right");

    const voicing: ChordVoicing = {
      name,
      rootNotes: notes,
      voiced: notes,
      displayName: name,
      ghostNotes: [],
      fingers,
    };

    prevNotes = notes;
    prevFingers = fingers;
    return voicing;
  });
}

/**
 * Brute-force search: enumerate all possible inversion paths and return
 * every path that achieves the minimum total distance.
 */
function findAllOptimalPaths(chords: { name: string; notes: number[] }[]): number[][][] {
  // For each chord, collect all candidate voicings
  const candidates: number[][][] = chords.map(({ notes }) =>
    getAllInversions(notes, { hand: "right" }),
  );

  // First chord also includes root position (it might not be in getAllInversions range)
  const firstRoot = [...chords[0].notes];
  if (!candidates[0].some((inv) => inv.every((n, i) => n === firstRoot[i]))) {
    candidates[0].unshift(firstRoot);
  }

  // Enumerate all paths, tracking the best distance and all tied paths
  let bestDistance = Infinity;
  let bestPaths: number[][][] = [];

  function search(depth: number, path: number[][], dist: number): void {
    // Prune: if we already exceed the best, stop
    if (dist > bestDistance) return;

    if (depth === chords.length) {
      if (dist < bestDistance) {
        bestDistance = dist;
        bestPaths = [path.map((v) => [...v])];
      } else if (dist === bestDistance) {
        bestPaths.push(path.map((v) => [...v]));
      }
      return;
    }

    for (const inv of candidates[depth]) {
      const stepDist = depth === 0 ? 0 : chordDistance(path[depth - 1], inv);
      path.push(inv);
      search(depth + 1, path, dist + stepDist);
      path.pop();
    }
  }

  search(0, [], 0);

  // Deduplicate octave-equivalent paths (same pitch classes + intervals, different octave)
  const seen = new Set<string>();
  return bestPaths.filter((path) => {
    const key = path
      .map((chord) => `${chord[0] % 12}:${chord[1] - chord[0]},${chord[2] - chord[1]}`)
      .join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildOptimizedPaths(chords: { name: string; notes: number[] }[]): ChordVoicing[][] {
  const paths = findAllOptimalPaths(chords);

  // Sort paths by proximity to original root position voicings
  const rootNotes = chords.map(({ notes }) => notes);
  paths.sort((a, b) => {
    const distA = a.reduce(
      (sum, voiced, i) => sum + voiced.reduce((s, n, j) => s + Math.abs(n - rootNotes[i][j]), 0),
      0,
    );
    const distB = b.reduce(
      (sum, voiced, i) => sum + voiced.reduce((s, n, j) => s + Math.abs(n - rootNotes[i][j]), 0),
      0,
    );
    return distA - distB;
  });

  return paths.map((path) => {
    let prevFingers: readonly number[] = [];
    let prevNotes: number[] = [];

    return path.map((voiced, i) => {
      const { name, notes } = chords[i];
      const voicedSet = new Set(voiced);
      const ghostNotes: number[] = [];
      for (const n of notes) {
        if (!voicedSet.has(n)) ghostNotes.push(n);
      }

      const displayName = getInversionLabel(name, notes, voiced);
      const fingers =
        prevFingers.length === 3
          ? assignFingeringInContext(voiced, "right", prevNotes, prevFingers)
          : assignFingering(voiced, "right");

      prevNotes = voiced;
      prevFingers = fingers;

      return { name, rootNotes: notes, voiced, displayName, ghostNotes, fingers };
    });
  });
}

// ── Distance calculation ────────────────────────────────────────────

function totalDistance(voicings: ChordVoicing[]): number {
  let total = 0;
  for (let i = 1; i < voicings.length; i++) {
    total += chordDistance(voicings[i - 1].voiced, voicings[i].voiced);
  }
  return total;
}

// ── Render a section of keyboards ───────────────────────────────────

function renderSection(
  voicings: ChordVoicing[],
  label: string,
  distance: number,
  description: string,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "stack-sm";

  const header = document.createElement("div");
  header.className = "row-sm center";
  header.style.alignItems = "baseline";
  header.style.flexWrap = "wrap";

  const title = document.createElement("h2");
  title.style.fontSize = "var(--text-lg)";
  title.style.margin = "0";
  title.textContent = label;
  header.appendChild(title);

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `${distance} semitones total movement`;
  header.appendChild(badge);

  section.appendChild(header);

  if (description) {
    const desc = document.createElement("p");
    desc.className = "text-muted";
    desc.style.margin = "0";
    desc.textContent = description;
    section.appendChild(desc);
  }

  // Keyboards stacked vertically
  const list = document.createElement("div");
  list.className = "stack-sm";

  for (let i = 0; i < voicings.length; i++) {
    const v = voicings[i];
    const cell = document.createElement("div");
    cell.className = "stack-sm";
    cell.style.alignItems = "center";

    // Chord info (centered above keyboard)
    const info = document.createElement("div");
    info.style.textAlign = "center";

    const nameEl = document.createElement("span");
    nameEl.style.fontWeight = "600";
    nameEl.style.fontFamily = "var(--font-mono)";
    nameEl.textContent = v.displayName;
    info.appendChild(nameEl);

    const notesEl = document.createElement("span");
    notesEl.className = "text-muted";
    notesEl.style.fontSize = "var(--text-sm)";
    notesEl.style.marginLeft = "var(--space-sm)";
    notesEl.textContent = v.voiced.map(midiToNoteName).join(", ");
    info.appendChild(notesEl);

    cell.appendChild(info);

    // Keyboard
    const kb = document.createElement("piano-keyboard");
    kb.setAttribute("start", "48");
    kb.setAttribute("end", "84");
    kb.style.height = "60px";
    kb.style.width = "100%";
    kb.setAttribute("yellow", v.voiced.join(","));
    if (v.ghostNotes.length > 0) {
      kb.setAttribute("gray", v.ghostNotes.join(","));
    }
    if (v.fingers.length === 3) {
      kb.setAttribute("fingers", v.voiced.map((n, j) => `${n}:${v.fingers[j]}`).join(","));
    }
    cell.appendChild(kb);

    list.appendChild(cell);

    // Distance arrow between chords
    if (i < voicings.length - 1) {
      const dist = chordDistance(v.voiced, voicings[i + 1].voiced);
      const distEl = document.createElement("div");
      distEl.className = "text-muted";
      distEl.style.fontSize = "var(--text-sm)";
      distEl.style.textAlign = "center";
      distEl.textContent = `↓ ${dist} semitones`;
      list.appendChild(distEl);
    }
  }

  section.appendChild(list);
  return section;
}

// ── Explore ─────────────────────────────────────────────────────────

function explore(): void {
  const chords = parseChords(chordInput.value);
  if (!chords || chords.length < 2) {
    resultsEl.innerHTML = `<p class="text-error">Enter at least 2 valid chord names separated by spaces.</p>`;
    return;
  }

  resultsEl.innerHTML = "";

  const original = buildOriginal(chords);
  const origDist = totalDistance(original);

  // Original section
  resultsEl.appendChild(
    renderSection(
      original,
      "Root position",
      origDist,
      "All chords in their default root position voicing.",
    ),
  );

  // Find all optimal paths
  const optimizedPaths = buildOptimizedPaths(chords);

  if (optimizedPaths.length === 0) return;

  const optDist = totalDistance(optimizedPaths[0]);
  const saved = origDist - optDist;

  for (let p = 0; p < optimizedPaths.length; p++) {
    const path = optimizedPaths[p];
    const label = optimizedPaths.length === 1 ? "Optimized" : `Variant ${p + 1}`;
    const desc =
      p === 0
        ? saved > 0
          ? `Voice leading reduces total movement by ${saved} semitones (${Math.round((saved / origDist) * 100)}% less). ${optimizedPaths.length > 1 ? `Found ${optimizedPaths.length} equally optimal paths.` : ""}`
          : "Root position is already optimal for this sequence."
        : "";

    resultsEl.appendChild(renderSection(path, label, optDist, desc));
  }
}

document.getElementById("go-btn")!.addEventListener("click", explore);
chordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") explore();
});
