/**
 * Voice leading optimization algorithms.
 * Generates inversions and optimizes chord progressions for minimal hand movement.
 */

import { midiToNoteName } from "./chords.ts";

// ── Types ───────────────────────────────────────────────────────────

export interface VoiceLeadingOptions {
  readonly hand?: "left" | "right";
  readonly rangeMin?: number;
  readonly rangeMax?: number;
}

export interface InversionInfo {
  readonly type: "root" | "first" | "second";
  readonly slashNote: string;
}

// ── Core functions ──────────────────────────────────────────────────

/**
 * Generate all playable inversions of a triad across multiple octaves.
 *
 * Creates root position, 1st inversion, and 2nd inversion, each shifted
 * down/up one octave, then filters by hand range and max span of 12 semitones.
 */
export function getAllInversions(
  notes: readonly number[],
  options: VoiceLeadingOptions = {},
): number[][] {
  const hand = options.hand ?? "right";
  const rangeMin = options.rangeMin ?? (hand === "left" ? 36 : 48);
  const rangeMax = options.rangeMax ?? (hand === "left" ? 60 : 72);

  const baseInversions: number[][] = [
    [notes[0], notes[1], notes[2]], // Root position
    [notes[1], notes[2], notes[0] + 12], // 1st inversion
    [notes[2], notes[0] + 12, notes[1] + 12], // 2nd inversion
  ];

  const inversions: number[][] = [];

  for (const inv of baseInversions) {
    inversions.push([inv[0] - 12, inv[1] - 12, inv[2] - 12]);
    inversions.push([...inv]);
    inversions.push([inv[0] + 12, inv[1] + 12, inv[2] + 12]);
  }

  return inversions.filter((inv) => {
    const span = inv[2] - inv[0];
    const lowest = inv[0];
    return span <= 12 && lowest >= rangeMin && lowest <= rangeMax;
  });
}

/**
 * Calculate total semitone movement between two chords (voice-by-voice).
 */
export function chordDistance(a: readonly number[], b: readonly number[]): number {
  return a.reduce((sum, note, i) => sum + Math.abs(note - b[i]), 0);
}

/**
 * Find the inversion of `nextChord` that minimizes movement from `prevChord`.
 */
export function findClosestInversion(
  prevChord: readonly number[],
  nextChord: readonly number[],
  options: VoiceLeadingOptions = {},
): number[] {
  const inversions = getAllInversions(nextChord, options);
  let best = inversions[0];
  let minDistance = chordDistance(prevChord, inversions[0]);

  for (const inv of inversions) {
    const dist = chordDistance(prevChord, inv);
    if (dist < minDistance) {
      minDistance = dist;
      best = inv;
    }
  }

  return best;
}

/**
 * Apply voice leading to an entire chord progression.
 *
 * The first chord stays in root position; each subsequent chord is voiced
 * to minimize movement from the previous one.
 */
export function voiceLeadProgression(
  chordNames: readonly string[],
  chordLookup: Readonly<Record<string, readonly number[]>>,
  options: VoiceLeadingOptions = {},
): number[][] {
  const chords = chordNames.map((name) => chordLookup[name]);
  const voiced: number[][] = [[...chords[0]]];

  for (let i = 1; i < chords.length; i++) {
    const prev = voiced[i - 1];
    const next = chords[i];
    voiced.push(findClosestInversion(prev, next, options));
  }

  return voiced;
}

/**
 * Check if a voicing is a root-position transposition of the given chord.
 * A voicing is "root position" if its bass note's pitch class matches
 * the root note's pitch class in the original chord.
 */
export function isRootPosition(
  rootPosition: readonly number[],
  voicing: readonly number[],
): boolean {
  return voicing[0] % 12 === rootPosition[0] % 12;
}

// ── Inversion analysis ──────────────────────────────────────────────

/**
 * Determine what inversion a voicing is relative to its root position.
 *
 * Compares the bass (lowest) note's pitch class against the root, third,
 * and fifth of the root-position chord to classify the inversion.
 */
export function getInversionType(
  rootPosition: readonly number[],
  voicing: number[],
): InversionInfo {
  const bassPC = voicing[0] % 12;
  const rootPC = rootPosition[0] % 12;
  const thirdPC = rootPosition[1] % 12;
  const fifthPC = rootPosition[2] % 12;

  const slashNote = midiToNoteName(voicing[0]).replace(/\d+$/, "");

  if (bassPC === rootPC) {
    return { type: "root", slashNote };
  }
  if (bassPC === thirdPC) {
    return { type: "first", slashNote };
  }
  if (bassPC === fifthPC) {
    return { type: "second", slashNote };
  }

  // Fallback — shouldn't happen with valid triads
  return { type: "root", slashNote };
}

/**
 * Return a display label for a voiced chord, using slash notation for inversions.
 *
 * Examples: "C" (root position), "C/E" (1st inversion), "C/G" (2nd inversion).
 */
export function getInversionLabel(
  chordName: string,
  rootPosition: readonly number[],
  voicing: number[],
): string {
  const info = getInversionType(rootPosition, voicing);

  if (info.type === "root") {
    return chordName;
  }

  return `${chordName}/${info.slashNote}`;
}
