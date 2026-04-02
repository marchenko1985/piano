/**
 * Debug page for sheet music rendering with abcjs.
 * Tests all use cases needed by practice games.
 */

import "../style.css";
import { renderSheet, renderNote, renderChord, midiToAbc } from "../sheet.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";
app.style.maxWidth = "800px";

app.innerHTML = `
  <h1>Sheet Music Debug</h1>
  <p class="text-muted">Testing abcjs rendering for all practice game use cases.</p>
  <div id="examples" class="stack-lg"></div>
`;

const examples = document.getElementById("examples")!;

// ── Helper to create example sections ───────────────────────────────

function addExample(title: string, description: string): HTMLElement {
  const section = document.createElement("section");
  section.className = "card stack-sm";
  section.style.padding = "var(--space-md)";

  const h2 = document.createElement("h3");
  h2.textContent = title;
  h2.style.margin = "0";
  section.appendChild(h2);

  const desc = document.createElement("p");
  desc.className = "text-muted";
  desc.style.margin = "0";
  desc.style.fontSize = "var(--text-sm)";
  desc.textContent = description;
  section.appendChild(desc);

  const content = document.createElement("div");
  content.className = "stack-sm";
  section.appendChild(content);

  examples.appendChild(section);
  return content;
}

// ── 1. Single notes on treble clef ──────────────────────────────────

{
  const el = addExample(
    "1. Single notes — treble clef",
    "Middle C (C4) through C6, testing full treble range.",
  );

  const row = document.createElement("div");
  row.className = "row-sm";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-start";

  const testNotes = [60, 62, 64, 65, 67, 69, 71, 72, 76, 79, 84];
  for (const midi of testNotes) {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const label = document.createElement("div");
    label.className = "text-muted";
    label.style.fontSize = "var(--text-sm)";
    label.textContent = `MIDI ${midi} (${midiToAbc(midi)})`;
    wrap.appendChild(label);

    const container = document.createElement("div");
    renderNote(container, midi, { staffWidth: 100 });
    wrap.appendChild(container);

    row.appendChild(wrap);
  }
  el.appendChild(row);
}

// ── 2. Single notes on bass clef ────────────────────────────────────

{
  const el = addExample("2. Single notes — bass clef", "C2 through B3, testing full bass range.");

  const row = document.createElement("div");
  row.className = "row-sm";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-start";

  const testNotes = [36, 38, 40, 41, 43, 45, 47, 48, 52, 55];
  for (const midi of testNotes) {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const label = document.createElement("div");
    label.className = "text-muted";
    label.style.fontSize = "var(--text-sm)";
    label.textContent = `MIDI ${midi} (${midiToAbc(midi)})`;
    wrap.appendChild(label);

    const container = document.createElement("div");
    renderNote(container, midi, { clef: "bass", staffWidth: 100 });
    wrap.appendChild(container);

    row.appendChild(wrap);
  }
  el.appendChild(row);
}

// ── 3. Accidentals ──────────────────────────────────────────────────

{
  const el = addExample("3. Accidentals", "Sharps and flats: C#4, Eb4, F#4, Ab4, Bb4.");

  const row = document.createElement("div");
  row.className = "row-sm";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-start";

  const testNotes = [61, 63, 66, 68, 70]; // C#, Eb, F#, Ab, Bb
  for (const midi of testNotes) {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const label = document.createElement("div");
    label.className = "text-muted";
    label.style.fontSize = "var(--text-sm)";
    label.textContent = `MIDI ${midi} (${midiToAbc(midi)})`;
    wrap.appendChild(label);

    const container = document.createElement("div");
    renderNote(container, midi, { staffWidth: 100 });
    wrap.appendChild(container);

    row.appendChild(wrap);
  }
  el.appendChild(row);
}

// ── 4. Chords ───────────────────────────────────────────────────────

{
  const el = addExample(
    "4. Chords",
    "C major, D minor, F major, G major — stacked notes on treble clef.",
  );

  const row = document.createElement("div");
  row.className = "row-sm";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-start";

  const chords: [string, number[]][] = [
    ["C", [60, 64, 67]],
    ["Dm", [62, 65, 69]],
    ["F", [65, 69, 72]],
    ["G", [67, 71, 74]],
    ["Am", [69, 72, 76]],
  ];

  for (const [name, midi] of chords) {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const label = document.createElement("div");
    label.className = "text-muted";
    label.style.fontSize = "var(--text-sm)";
    label.textContent = name;
    wrap.appendChild(label);

    const container = document.createElement("div");
    renderChord(container, midi, { staffWidth: 120 });
    wrap.appendChild(container);

    row.appendChild(wrap);
  }
  el.appendChild(row);
}

// ── 5. Intervals ────────────────────────────────────────────────────

{
  const el = addExample(
    "5. Intervals",
    "Two-note intervals: minor 3rd, major 3rd, P4, P5, octave.",
  );

  const row = document.createElement("div");
  row.className = "row-sm";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-start";

  const intervals: [string, number[]][] = [
    ["m3", [60, 63]],
    ["M3", [60, 64]],
    ["P4", [60, 65]],
    ["P5", [60, 67]],
    ["m6", [60, 68]],
    ["M6", [60, 69]],
    ["P8", [60, 72]],
  ];

  for (const [name, midi] of intervals) {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const label = document.createElement("div");
    label.className = "text-muted";
    label.style.fontSize = "var(--text-sm)";
    label.textContent = name;
    wrap.appendChild(label);

    const container = document.createElement("div");
    renderChord(container, midi, { staffWidth: 100 });
    wrap.appendChild(container);

    row.appendChild(wrap);
  }
  el.appendChild(row);
}

// ── 6. Note highlighting / colors ───────────────────────────────────

{
  const el = addExample(
    "6. Note highlighting",
    "Colored notes for game feedback: yellow (expected), green (correct), red (wrong).",
  );

  const row = document.createElement("div");
  row.className = "row-sm";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-start";

  const colorTests: [string, string][] = [
    ["Expected", "goldenrod"],
    ["Correct", "limegreen"],
    ["Wrong", "tomato"],
    ["Info", "dodgerblue"],
  ];

  for (const [label, color] of colorTests) {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const labelEl = document.createElement("div");
    labelEl.className = "text-muted";
    labelEl.style.fontSize = "var(--text-sm)";
    labelEl.textContent = label;
    wrap.appendChild(labelEl);

    const container = document.createElement("div");
    renderNote(container, 64, { staffWidth: 100, color });
    wrap.appendChild(container);

    row.appendChild(wrap);
  }
  el.appendChild(row);
}

// ── 7. Multiple notes with durations ────────────────────────────────

{
  const el = addExample("7. Note durations", "Whole, half, quarter, eighth notes in a single bar.");

  const container = document.createElement("div");
  renderSheet(container, [{ midi: [60], duration: "w" }], { staffWidth: 120 });

  const container2 = document.createElement("div");
  renderSheet(
    container2,
    [
      { midi: [62], duration: "h" },
      { midi: [64], duration: "h" },
    ],
    { staffWidth: 160 },
  );

  const container3 = document.createElement("div");
  renderSheet(
    container3,
    [
      { midi: [65], duration: "q" },
      { midi: [67], duration: "q" },
      { midi: [69], duration: "q" },
      { midi: [71], duration: "q" },
    ],
    { staffWidth: 220, showTime: true },
  );

  const container4 = document.createElement("div");
  renderSheet(
    container4,
    [
      { midi: [72], duration: "8" },
      { midi: [71], duration: "8" },
      { midi: [69], duration: "8" },
      { midi: [67], duration: "8" },
      { midi: [65], duration: "8" },
      { midi: [64], duration: "8" },
      { midi: [62], duration: "8" },
      { midi: [60], duration: "8" },
    ],
    { staffWidth: 350, showTime: true },
  );

  const labels = ["Whole note", "Half notes", "Quarter notes (4/4)", "Eighth notes (scale down)"];
  [container, container2, container3, container4].forEach((c, i) => {
    const label = document.createElement("div");
    label.className = "text-muted";
    label.style.fontSize = "var(--text-sm)";
    label.textContent = labels[i];
    el.appendChild(label);
    el.appendChild(c);
  });
}

// ── 8. Bass clef chords ─────────────────────────────────────────────

{
  const el = addExample("8. Bass clef chords", "Left hand chords: C3, Dm3, F3, G2.");

  const row = document.createElement("div");
  row.className = "row-sm";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-start";

  const chords: [string, number[]][] = [
    ["C", [48, 52, 55]],
    ["Dm", [50, 53, 57]],
    ["F", [53, 57, 60]],
    ["G", [43, 47, 50]],
  ];

  for (const [name, midi] of chords) {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const label = document.createElement("div");
    label.className = "text-muted";
    label.style.fontSize = "var(--text-sm)";
    label.textContent = name;
    wrap.appendChild(label);

    const container = document.createElement("div");
    renderChord(container, midi, { clef: "bass", staffWidth: 120 });
    wrap.appendChild(container);

    row.appendChild(wrap);
  }
  el.appendChild(row);
}

// ── 9. Scaling ──────────────────────────────────────────────────────

{
  const el = addExample(
    "9. Scale / size control",
    "Same note at different scale factors: 0.5, 0.75, 1.0, 1.5.",
  );

  const row = document.createElement("div");
  row.className = "row-sm";
  row.style.flexWrap = "wrap";
  row.style.alignItems = "flex-end";

  for (const scale of [0.5, 0.75, 1.0, 1.5]) {
    const wrap = document.createElement("div");
    wrap.style.textAlign = "center";

    const label = document.createElement("div");
    label.className = "text-muted";
    label.style.fontSize = "var(--text-sm)";
    label.textContent = `scale=${scale}`;
    wrap.appendChild(label);

    const container = document.createElement("div");
    renderNote(container, 64, { staffWidth: 100, scale });
    wrap.appendChild(container);

    row.appendChild(wrap);
  }
  el.appendChild(row);
}

// ── 10. midiToAbc mapping table ─────────────────────────────────────

{
  const el = addExample(
    "10. MIDI → ABC mapping reference",
    "Verifying octave and accidental conversions.",
  );

  const table = document.createElement("table");
  table.style.fontSize = "var(--text-sm)";
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";

  const header = document.createElement("tr");
  for (const h of ["MIDI", "Scientific", "ABC"]) {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.padding = "var(--space-xs) var(--space-sm)";
    th.style.borderBottom = "1px solid var(--border)";
    th.style.textAlign = "left";
    header.appendChild(th);
  }
  table.appendChild(header);

  const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const testMidi = [36, 48, 55, 58, 60, 61, 63, 66, 68, 70, 72, 84];

  for (const midi of testMidi) {
    const row = document.createElement("tr");
    const octave = Math.floor(midi / 12) - 1;
    const name = NOTE_NAMES[midi % 12] + octave;

    for (const val of [String(midi), name, midiToAbc(midi)]) {
      const td = document.createElement("td");
      td.textContent = val;
      td.style.padding = "var(--space-xs) var(--space-sm)";
      td.style.borderBottom = "1px solid var(--border)";
      td.style.fontFamily = "var(--font-mono)";
      row.appendChild(td);
    }
    table.appendChild(row);
  }
  el.appendChild(table);
}
