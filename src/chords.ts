/**
 * Chord data and music theory utilities.
 * Core module for chord practice mini-games.
 *
 * Chord notation formats:
 *   1. Simple:    "C", "Dm", "F#"           — triad, octave 4 implied
 *   2. Octave:    "C4", "Dm3", "F#5"        — explicit octave
 *   3. Precise:   "C4-E4-G4"                — exact voicing (dash-separated, ascending)
 *   4. Slash:     "C/E", "F4/C4"            — inversion / bass note
 *   5. Seventh:   "Cmaj7", "C7", "Cm7"      — 7th chords (limited)
 */

// ── Note names ───────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

type NoteName = (typeof NOTE_NAMES)[number];

// ── Chord quality ────────────────────────────────────────────────────

type ChordQuality = "maj" | "m" | "7" | "maj7" | "m7";

const QUALITY_INTERVALS: Record<ChordQuality, readonly number[]> = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  "7": [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
};

// ── Static data ──────────────────────────────────────────────────────

/** Root note MIDI numbers in octave 4. */
const ROOTS: Record<NoteName, number> = {
  C: 60,
  "C#": 61,
  D: 62,
  "D#": 63,
  E: 64,
  F: 65,
  "F#": 66,
  G: 67,
  "G#": 68,
  A: 69,
  "A#": 70,
  B: 71,
};

/** Enharmonic equivalents — flats to sharps. */
const FLAT_TO_SHARP: Record<string, NoteName> = {
  Bb: "A#",
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Cb: "B",
  Fb: "E",
};

/** All 24 major/minor triads in root position, octave 4. */
export const BASE_CHORDS: Record<string, readonly number[]> = {
  C: [60, 64, 67],
  "C#": [61, 65, 68],
  D: [62, 66, 69],
  "D#": [63, 67, 70],
  E: [64, 68, 71],
  F: [65, 69, 72],
  "F#": [66, 70, 73],
  G: [67, 71, 74],
  "G#": [68, 72, 75],
  A: [69, 73, 76],
  "A#": [70, 74, 77],
  B: [71, 75, 78],

  Cm: [60, 63, 67],
  "C#m": [61, 64, 68],
  Dm: [62, 65, 69],
  "D#m": [63, 66, 70],
  Em: [64, 67, 71],
  Fm: [65, 68, 72],
  "F#m": [66, 69, 73],
  Gm: [67, 70, 74],
  "G#m": [68, 71, 75],
  Am: [69, 72, 76],
  "A#m": [70, 73, 77],
  Bm: [71, 74, 78],
};

/** Musically compatible 4-chord progressions across all 12 keys. */
export const PROGRESSIONS: readonly (readonly string[])[] = [
  // C major
  ["C", "F", "G", "C"],
  ["C", "G", "Am", "F"],
  ["C", "Am", "F", "G"],
  ["Am", "F", "C", "G"],
  // C# major
  ["C#", "F#", "G#", "C#"],
  ["C#", "G#", "A#m", "F#"],
  ["C#", "A#m", "F#", "G#"],
  // D major
  ["D", "G", "A", "D"],
  ["D", "A", "Bm", "G"],
  ["D", "Bm", "G", "A"],
  // D# major
  ["D#", "G#", "A#", "D#"],
  ["D#", "A#", "Cm", "G#"],
  // E major
  ["E", "A", "B", "E"],
  ["E", "B", "C#m", "A"],
  ["E", "C#m", "A", "B"],
  // F major
  ["F", "A#", "C", "F"],
  ["F", "C", "Dm", "A#"],
  ["F", "Dm", "A#", "C"],
  // F# major
  ["F#", "B", "C#", "F#"],
  ["F#", "C#", "D#m", "B"],
  ["F#", "D#m", "B", "C#"],
  // G major
  ["G", "C", "D", "G"],
  ["G", "D", "Em", "C"],
  ["G", "Em", "C", "D"],
  // G# major
  ["G#", "C#", "D#", "G#"],
  ["G#", "D#", "Fm", "C#"],
  // A major
  ["A", "D", "E", "A"],
  ["A", "E", "F#m", "D"],
  ["A", "F#m", "D", "E"],
  // A# major
  ["A#", "D#", "F", "A#"],
  ["A#", "F", "G#m", "D#"],
  // B major
  ["B", "E", "F#", "B"],
  ["B", "F#", "G#m", "E"],
  ["B", "G#m", "E", "F#"],
];

/**
 * Song structures with verse + chorus progressions.
 * Each entry has a verse (4 chords) and chorus (4 chords) that pair well
 * together musically — the chorus feels like an arrival/lift from the verse.
 * Based on common pop/rock songwriting patterns in all 12 keys.
 */
export interface SongStructure {
  readonly pattern: string;
  readonly key: string;
  readonly verse: readonly string[];
  readonly chorus: readonly string[];
}

interface SongPattern {
  readonly id: string;
  readonly name: string;
  readonly verse: readonly string[];
  readonly chorus: readonly string[];
}

/** Roman numeral patterns — verse and chorus pairings that sound like real songs. */
const SONG_PATTERNS: readonly SongPattern[] = [
  {
    id: "pop-anthem",
    name: "Pop anthem",
    verse: ["vi", "IV", "I", "V"],
    chorus: ["IV", "V", "I", "vi"],
  },
  {
    id: "singer-songwriter",
    name: "Singer-songwriter",
    verse: ["I", "V", "vi", "IV"],
    chorus: ["IV", "V", "vi", "I"],
  },
  {
    id: "classic-rock",
    name: "Classic rock",
    verse: ["I", "vi", "IV", "V"],
    chorus: ["I", "IV", "V", "IV"],
  },
  {
    id: "pop-ballad",
    name: "Pop ballad",
    verse: ["ii", "IV", "I", "V"],
    chorus: ["IV", "I", "V", "vi"],
  },
  {
    id: "alt-rock",
    name: "Alt-rock",
    verse: ["vi", "IV", "V", "I"],
    chorus: ["I", "V", "IV", "V"],
  },
  {
    id: "soft-pop",
    name: "Soft pop",
    verse: ["I", "iii", "IV", "V"],
    chorus: ["IV", "V", "I", "vi"],
  },
  {
    id: "folk-rock",
    name: "Folk-rock",
    verse: ["I", "IV", "vi", "V"],
    chorus: ["I", "IV", "I", "V"],
  },
  {
    id: "jazz-pop",
    name: "Jazz-pop",
    verse: ["vi", "ii", "V", "I"],
    chorus: ["I", "V", "vi", "IV"],
  },
];

/** Pattern id → display label, for building UI dropdowns. */
export const SONG_PATTERN_LIST: readonly { id: string; label: string }[] = SONG_PATTERNS.map(
  ({ id, name, verse, chorus }) => ({
    id,
    label: `${name} (${verse.join("-")} → ${chorus.join("-")})`,
  }),
);

/** Map Roman numeral degree to chord name in a given key. */
const DEGREE_MAP: Record<string, { offset: number; quality: "maj" | "m" }> = {
  I: { offset: 0, quality: "maj" },
  ii: { offset: 2, quality: "m" },
  iii: { offset: 4, quality: "m" },
  IV: { offset: 5, quality: "maj" },
  V: { offset: 7, quality: "maj" },
  vi: { offset: 9, quality: "m" },
};

function degreeToChordName(degree: string, rootIndex: number): string {
  const deg = DEGREE_MAP[degree];
  if (!deg) return "C";
  const noteIndex = (rootIndex + deg.offset) % 12;
  const name = NOTE_NAMES[noteIndex];
  return deg.quality === "m" ? `${name}m` : name;
}

/** All song structures across all 12 keys. */
export const SONG_STRUCTURES: readonly SongStructure[] = NOTE_NAMES.flatMap((root, rootIndex) =>
  SONG_PATTERNS.map((pat) => ({
    pattern: pat.id,
    key: root,
    verse: pat.verse.map((deg) => degreeToChordName(deg, rootIndex)),
    chorus: pat.chorus.map((deg) => degreeToChordName(deg, rootIndex)),
  })),
);

/** Fingering patterns keyed by interval structure. */
export const FINGERING_PATTERNS: Record<string, readonly number[]> = {
  "4,3": [1, 3, 5], // Major (M3 + m3)
  "3,4": [1, 2, 5], // Minor (m3 + M3)
  "3,3": [1, 2, 4], // Diminished
  "4,4": [1, 3, 5], // Augmented
};

// ── MIDI ↔ note name conversion ──────────────────────────────────────

/** Convert MIDI note number (0-127) to note name with octave, e.g. "C4". */
export function midiToNoteName(noteNumber: number): string {
  const octave = Math.floor(noteNumber / 12) - 1;
  return NOTE_NAMES[noteNumber % 12] + octave;
}

/** Convert note name (e.g. "C4", "Db3") to MIDI number, or `null` if invalid. */
export function noteNameToMidi(noteName: string): number | null {
  const match = noteName.trim().match(/^([A-Ga-g])([#b]?)(\d+)$/);
  if (!match) return null;

  let note: string = match[1].toUpperCase() + (match[2] ?? "");
  const octave = Number(match[3]);

  if (note in FLAT_TO_SHARP) note = FLAT_TO_SHARP[note];

  const root = ROOTS[note as NoteName];
  if (root === undefined) return null;

  const midi = root + (octave - 4) * 12;
  return midi >= 0 && midi <= 127 ? midi : null;
}

// ── Chord parsing ────────────────────────────────────────────────────

export interface ParsedChord {
  root: string;
  quality: ChordQuality;
  octave: number | null;
}

export interface ParsedSlashChord {
  isSlashChord: true;
  rootChord: string;
  bassNote: string;
}

export interface ParsedPreciseNotes {
  isPreciseNotes: true;
  notes: number[];
}

/**
 * Parse a chord token.
 *
 * Returns a `ParsedChord`, `ParsedSlashChord`, or `null`.
 */
export function parseChord(token: string): ParsedChord | ParsedSlashChord | null {
  token = token.trim();
  if (!token) return null;

  // Slash chord: "F4/C4" or "F/C"
  const slashMatch = token.match(/^([^/]+)\/(.+)$/);
  if (slashMatch) {
    return {
      isSlashChord: true,
      rootChord: slashMatch[1].trim(),
      bassNote: slashMatch[2].trim(),
    };
  }

  const m = token.match(/^([A-Ga-g])([#b]?)(\d?)(.*)$/);
  if (!m) return null;

  let root: string = m[1].toUpperCase() + (m[2] ?? "");
  if (root in FLAT_TO_SHARP) root = FLAT_TO_SHARP[root];

  const octave = m[3] ? Number(m[3]) : null;
  const suffix = (m[4] ?? "").toLowerCase();

  let quality: ChordQuality = "maj";
  if (suffix.includes("maj7") || suffix.includes("ma7")) quality = "maj7";
  else if (suffix.includes("m7") || suffix.includes("min7")) quality = "m7";
  else if (suffix === "7" || suffix.endsWith("7")) quality = "7";
  else if (suffix === "m" || suffix.startsWith("m") || suffix.startsWith("min")) quality = "m";

  return { root, quality, octave };
}

/**
 * Parse precise note format: "C4-E4-G4".
 *
 * Returns exact MIDI notes (strictly ascending) or `null`.
 */
export function parsePreciseNotes(token: string): ParsedPreciseNotes | null {
  token = token.trim();
  if (!token.includes("-")) return null;

  const parts = token.split("-").map((t) => t.trim());
  if (parts.length < 2) return null;

  const notes: number[] = [];
  for (const part of parts) {
    const midi = noteNameToMidi(part);
    if (midi === null) return null;
    notes.push(midi);
  }

  // Must be strictly ascending
  for (let i = 1; i < notes.length; i++) {
    if (notes[i] <= notes[i - 1]) return null;
  }

  return { isPreciseNotes: true, notes };
}

// ── Chord building ───────────────────────────────────────────────────

/** Build MIDI notes from root name, quality, and optional octave. */
export function buildChord(
  rootName: string,
  quality: ChordQuality,
  octave: number | null = null,
): number[] | null {
  let root = ROOTS[rootName as NoteName];
  if (root === undefined) return null;

  if (octave !== null) root = root + (octave - 4) * 12;

  const intervals = QUALITY_INTERVALS[quality];
  return intervals.map((i) => root + i);
}

/**
 * Build MIDI notes from any chord string.
 *
 * Handles precise notes ("C4-E4-G4"), slash chords ("F4/C4"), and
 * standard names ("C", "Dm", "C4", "Cmaj7").
 */
export function buildChordNotes(chordName: string): number[] | null {
  // Precise note format takes priority
  const precise = parsePreciseNotes(chordName);
  if (precise) return precise.notes;

  const parsed = parseChord(chordName);
  if (!parsed) return null;

  // Slash chord
  if ("isSlashChord" in parsed) {
    const rootNotes = buildChordNotes(parsed.rootChord);
    if (!rootNotes) return null;

    const bassInfo = parseChord(parsed.bassNote);
    if (!bassInfo || "isSlashChord" in bassInfo) return null;

    let bassRoot = ROOTS[bassInfo.root as NoteName];
    if (bassRoot === undefined) return null;
    if (bassInfo.octave !== null) bassRoot = bassRoot + (bassInfo.octave - 4) * 12;

    const bassPitchClass = bassRoot % 12;
    const reordered: number[] = [];

    // Find matching pitch class in chord and create inversion
    let foundBass = false;
    for (let i = 0; i < rootNotes.length; i++) {
      if (rootNotes[i] % 12 === bassPitchClass) {
        foundBass = true;
        reordered.push(bassRoot);
        for (let j = 1; j < rootNotes.length; j++) {
          const idx = (i + j) % rootNotes.length;
          let note = rootNotes[idx];
          while (note <= reordered[reordered.length - 1]) note += 12;
          reordered.push(note);
        }
        break;
      }
    }

    if (!foundBass) {
      // Bass note not in chord — add it as non-chord bass
      reordered.push(bassRoot);
      for (const note of rootNotes) {
        let n = note;
        while (n <= reordered[reordered.length - 1]) n += 12;
        reordered.push(n);
      }
    }

    return reordered;
  }

  return buildChord(parsed.root, parsed.quality, parsed.octave);
}

// ── Fingering ────────────────────────────────────────────────────────

/** Assign fingering (1-5) based on interval pattern of a 3-note chord. */
export function assignFingering(notes: readonly number[]): readonly number[] {
  const pattern = `${notes[1] - notes[0]},${notes[2] - notes[1]}`;
  return FINGERING_PATTERNS[pattern] ?? [1, 3, 5];
}

// ── Transposition ────────────────────────────────────────────────────

/** Transpose all BASE_CHORDS by the given number of semitones. */
export function transposeChords(semitones: number): Record<string, number[]> {
  const transposed: Record<string, number[]> = {};
  for (const [name, notes] of Object.entries(BASE_CHORDS)) {
    transposed[name] = notes.map((n) => n + semitones);
  }
  return transposed;
}

// ── Reverse lookup (MIDI → names) ────────────────────────────────────

/** Find chord name by exact match in BASE_CHORDS, or `null`. */
export function findChordName(notes: readonly number[]): string | null {
  const sorted = [...notes].sort((a, b) => a - b).join(",");
  for (const [name, chordNotes] of Object.entries(BASE_CHORDS)) {
    if (chordNotes.join(",") === sorted) return name;
  }
  return null;
}

/** Convert MIDI notes to chord name with slash notation for inversions. */
export function notesToChordName(notes: readonly number[]): string | null {
  if (notes.length === 0) return null;

  const sorted = [...notes].sort((a, b) => a - b);

  // Exact match first
  const exact = findChordName(sorted);
  if (exact) return exact;

  const pitchClasses = sorted.map((n) => n % 12);

  // Check inversions of known triads
  for (const [chordName, chordNotes] of Object.entries(BASE_CHORDS)) {
    const chordPC = chordNotes.map((n) => n % 12);
    if (chordPC.length !== pitchClasses.length) continue;

    for (let rot = 0; rot < chordPC.length; rot++) {
      const rotated = [...chordPC.slice(rot), ...chordPC.slice(0, rot)];
      if (rotated.join(",") === pitchClasses.join(",")) {
        const bassPC = sorted[0] % 12;
        const rootPC = chordNotes[0] % 12;
        if (bassPC === rootPC) return chordName;

        const bassName = Object.keys(ROOTS).find((k) => ROOTS[k as NoteName] % 12 === bassPC);
        return bassName ? `${chordName}/${bassName}` : chordName;
      }
    }
  }

  // 7th chord detection (4 notes)
  if (pitchClasses.length === 4) {
    const intervals: number[] = [];
    for (let i = 0; i < 3; i++) {
      let iv = pitchClasses[i + 1] - pitchClasses[i];
      if (iv < 0) iv += 12;
      intervals.push(iv);
    }

    for (let rot = 0; rot < 4; rot++) {
      const ri = [...intervals.slice(rot), ...intervals.slice(0, rot)];
      const str = ri.join(",");

      let quality: string | null = null;
      if (str === "4,3,4") quality = "maj7";
      else if (str === "4,3,3") quality = "7";
      else if (str === "3,4,3") quality = "m7";

      if (quality) {
        const rootPC = pitchClasses[(4 - rot) % 4];
        const rootName = Object.keys(ROOTS).find((k) => ROOTS[k as NoteName] % 12 === rootPC);
        if (!rootName) continue;

        const bassPC = sorted[0] % 12;
        if (bassPC === rootPC) return `${rootName}${quality}`;

        const bassName = Object.keys(ROOTS).find((k) => ROOTS[k as NoteName] % 12 === bassPC);
        return bassName ? `${rootName}${quality}/${bassName}` : `${rootName}${quality}`;
      }
    }
  }

  return null;
}

/** Convert MIDI notes to precise string format: "C4-E4-G4". */
export function notesToPreciseString(notes: readonly number[]): string {
  return [...notes]
    .sort((a, b) => a - b)
    .map(midiToNoteName)
    .join("-");
}
