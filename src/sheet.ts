/**
 * Sheet music rendering module using abcjs.
 *
 * Provides a clean API for rendering notes, chords, and intervals
 * on treble/bass clef staves for practice games.
 */

import abcjs from "abcjs";

// ── MIDI to ABC conversion ─────────────────────────────────────────

const ABC_NOTES = ["C", "^C", "D", "_E", "E", "F", "^F", "G", "_A", "A", "_B", "B"] as const;

/**
 * Convert a MIDI note number to ABC notation.
 *
 * ABC octave convention:
 *   C,, = C2, C, = C3, C = C4 (middle C), c = C5, c' = C6, c'' = C7
 */
export function midiToAbc(midi: number): string {
  const noteIndex = midi % 12;
  const octave = Math.floor(midi / 12) - 1; // scientific octave
  const abc = ABC_NOTES[noteIndex];

  // Split accidental prefix from letter
  const match = abc.match(/^([_^]*)([A-G])$/)!;
  const accidental = match[1];
  const letter = match[2];

  if (octave >= 5) {
    return accidental + letter.toLowerCase() + "'".repeat(octave - 5);
  }
  return accidental + letter + ",".repeat(4 - octave);
}

// ── Types ───────────────────────────────────────────────────────────

export interface NoteData {
  /** MIDI note numbers (single note or chord) */
  readonly midi: readonly number[];
  /** Duration: "w" (whole), "h" (half), "q" (quarter), "8" (eighth) */
  readonly duration?: string;
  /** Highlight color (CSS color name or hex) */
  readonly color?: string;
}

export interface SheetOptions {
  /** Clef to display: "treble", "bass", or "grand" (both) */
  readonly clef?: "treble" | "bass" | "grand";
  /** Width of the staff in pixels */
  readonly staffWidth?: number;
  /** Scale factor (default 1) */
  readonly scale?: number;
  /** Show time signature (default false for single notes) */
  readonly showTime?: boolean;
  /** Time signature when shown (default "4/4") */
  readonly timeSignature?: string;
  /** Add CSS classes to SVG elements for styling (default true) */
  readonly addClasses?: boolean;
}

// ── Duration mapping ────────────────────────────────────────────────

const DURATION_MAP: Record<string, string> = {
  w: "4", // whole = 4 quarter notes
  h: "2", // half = 2 quarter notes
  q: "", // quarter = 1 (default with L:1/4)
  "8": "/2", // eighth = half a quarter
  "16": "/4", // sixteenth
};

function abcDuration(dur: string): string {
  return DURATION_MAP[dur] ?? "";
}

// ── ABC string builders ─────────────────────────────────────────────

function buildNoteAbc(note: NoteData): string {
  const dur = abcDuration(note.duration ?? "w");
  if (note.midi.length === 1) {
    return midiToAbc(note.midi[0]) + dur;
  }
  // Chord: [CEG]
  return "[" + note.midi.map(midiToAbc).join("") + "]" + dur;
}

function buildRestAbc(dur: string): string {
  return "z" + abcDuration(dur);
}

interface StaffInput {
  notes: readonly NoteData[];
  clef: "treble" | "bass";
  showTime: boolean;
  timeSignature: string;
}

function buildStaffAbc(input: StaffInput): string {
  const { notes, clef, showTime, timeSignature } = input;
  const lines: string[] = [
    "X:1",
    showTime ? `M:${timeSignature}` : "M:none",
    "L:1/4",
    `K:C clef=${clef}`,
  ];

  if (notes.length === 0) {
    lines.push(buildRestAbc("w"));
  } else {
    lines.push(notes.map(buildNoteAbc).join(""));
  }

  return lines.join("\n");
}

// ── Main render function ────────────────────────────────────────────

/**
 * Render notes on a music staff.
 *
 * @param target - DOM element or CSS selector for the container
 * @param notes - Array of notes/chords to render
 * @param options - Display options
 *
 * @example
 * // Single note on treble clef
 * renderSheet("#container", [{ midi: [60] }]);
 *
 * // Chord on bass clef
 * renderSheet("#container", [{ midi: [48, 52, 55] }], { clef: "bass" });
 *
 * // Multiple notes with durations
 * renderSheet("#container", [
 *   { midi: [60], duration: "q" },
 *   { midi: [62], duration: "q" },
 *   { midi: [64], duration: "h" },
 * ], { showTime: true });
 */
export function renderSheet(
  target: string | HTMLElement,
  notes: readonly NoteData[],
  options: SheetOptions = {},
): void {
  const el = typeof target === "string" ? document.querySelector<HTMLElement>(target)! : target;
  if (!el) return;

  const clef = options.clef ?? "treble";
  const staffWidth = options.staffWidth ?? 200;
  const scale = options.scale ?? 1;
  const showTime = options.showTime ?? false;
  const timeSignature = options.timeSignature ?? "4/4";
  const addClasses = options.addClasses ?? true;

  el.innerHTML = "";

  if (clef === "grand") {
    // Grand staff: render treble and bass in separate containers
    const trebleDiv = document.createElement("div");
    const bassDiv = document.createElement("div");
    bassDiv.style.marginTop = "-30px"; // overlap staves slightly
    el.appendChild(trebleDiv);
    el.appendChild(bassDiv);

    // Split notes by pitch: >= C4 (60) → treble, < C4 → bass
    const trebleNotes = notes.filter((n) => n.midi[0] >= 60);
    const bassNotes = notes.filter((n) => n.midi[0] < 60);

    renderStaff(trebleDiv, trebleNotes, "treble", {
      staffWidth,
      scale,
      showTime,
      timeSignature,
      addClasses,
    });
    renderStaff(bassDiv, bassNotes, "bass", {
      staffWidth,
      scale,
      showTime,
      timeSignature,
      addClasses,
    });
  } else {
    renderStaff(el, notes, clef, { staffWidth, scale, showTime, timeSignature, addClasses });
  }

  // Apply colors after rendering
  if (addClasses) {
    applyColors(el, notes);
  }
}

function renderStaff(
  el: HTMLElement,
  notes: readonly NoteData[],
  clef: "treble" | "bass",
  opts: {
    staffWidth: number;
    scale: number;
    showTime: boolean;
    timeSignature: string;
    addClasses: boolean;
  },
): void {
  const abc = buildStaffAbc({
    notes,
    clef,
    showTime: opts.showTime,
    timeSignature: opts.timeSignature,
  });

  abcjs.renderAbc(el, abc, {
    staffwidth: opts.staffWidth,
    scale: opts.scale,
    add_classes: opts.addClasses,
    paddingtop: 0,
    paddingbottom: 0,
    paddingleft: 0,
    paddingright: 0,
  });
}

// ── Color highlighting ──────────────────────────────────────────────

function applyColors(container: HTMLElement, notes: readonly NoteData[]): void {
  const svg = container.querySelector("svg");
  if (!svg) return;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    if (!note.color) continue;

    // abcjs assigns class abcjs-n{index} for note position within measure
    const selector = `.abcjs-note.abcjs-n${i}`;
    const elements = svg.querySelectorAll(selector);
    for (const el of elements) {
      (el as SVGElement).setAttribute("fill", note.color);
      (el as SVGElement).setAttribute("stroke", note.color);
    }
  }
}

// ── Convenience helpers ─────────────────────────────────────────────

/**
 * Render a single MIDI note on a staff.
 */
export function renderNote(
  target: string | HTMLElement,
  midi: number,
  options: SheetOptions & { color?: string } = {},
): void {
  const { color, ...sheetOpts } = options;
  renderSheet(target, [{ midi: [midi], color }], sheetOpts);
}

/**
 * Render a chord (multiple MIDI notes) on a staff.
 */
export function renderChord(
  target: string | HTMLElement,
  midi: readonly number[],
  options: SheetOptions & { color?: string } = {},
): void {
  const { color, ...sheetOpts } = options;
  renderSheet(target, [{ midi, color }], sheetOpts);
}
