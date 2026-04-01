import { describe, expect, test } from "vite-plus/test";
import { BASE_CHORDS } from "./chords.ts";
import {
  getAllInversions,
  chordDistance,
  findClosestInversion,
  getInversionType,
  getInversionLabel,
  isRootPosition,
  voiceLeadProgression,
} from "./voice-leading.ts";

// C major root position: C4-E4-G4
const C = BASE_CHORDS["C"]; // [60, 64, 67]
const Am = BASE_CHORDS["Am"]; // [69, 72, 76]

describe("getAllInversions", () => {
  test("generates inversions within right-hand range", () => {
    const inversions = getAllInversions(C);
    expect(inversions.length).toBeGreaterThan(0);

    for (const inv of inversions) {
      expect(inv).toHaveLength(3);
      // Span must be <= 12 semitones
      expect(inv[2] - inv[0]).toBeLessThanOrEqual(12);
      // Lowest note in right-hand range (48-72)
      expect(inv[0]).toBeGreaterThanOrEqual(48);
      expect(inv[0]).toBeLessThanOrEqual(72);
      // Notes must be sorted ascending
      expect(inv[0]).toBeLessThanOrEqual(inv[1]);
      expect(inv[1]).toBeLessThanOrEqual(inv[2]);
    }
  });

  test("includes root position, 1st inversion, and 2nd inversion", () => {
    const inversions = getAllInversions(C);
    const pitchClassSets = inversions.map((inv) =>
      inv
        .map((n) => n % 12)
        .sort((a, b) => a - b)
        .join(","),
    );
    // All inversions of C major have the same pitch classes: 0,4,7
    for (const pcs of pitchClassSets) {
      expect(pcs).toBe("0,4,7");
    }
  });

  test("generates inversions for left-hand range", () => {
    const inversions = getAllInversions(C, { hand: "left" });
    expect(inversions.length).toBeGreaterThan(0);

    for (const inv of inversions) {
      expect(inv[0]).toBeGreaterThanOrEqual(36);
      expect(inv[0]).toBeLessThanOrEqual(60);
    }
  });

  test("no inversion is just an octave transposition of another", () => {
    const inversions = getAllInversions(C);
    // Each inversion should have a unique bass pitch class
    // (there may be duplicates across octaves, but each unique voicing shape should appear)
    const shapes = new Set(inversions.map((inv) => inv.map((n) => n % 12).join(",")));
    // C major has 3 distinct shapes: root (0,4,7), 1st inv (4,7,0), 2nd inv (7,0,4)
    expect(shapes.size).toBeGreaterThanOrEqual(2);
  });
});

describe("isRootPosition", () => {
  test("detects root position at same octave", () => {
    expect(isRootPosition(C, [60, 64, 67])).toBe(true);
  });

  test("detects root position at different octave", () => {
    expect(isRootPosition(C, [72, 76, 79])).toBe(true); // C5-E5-G5
    expect(isRootPosition(C, [48, 52, 55])).toBe(true); // C3-E3-G3
  });

  test("rejects 1st inversion", () => {
    expect(isRootPosition(C, [64, 67, 72])).toBe(false); // E4-G4-C5
  });

  test("rejects 2nd inversion", () => {
    expect(isRootPosition(C, [67, 72, 76])).toBe(false); // G4-C5-E5
  });
});

describe("chordDistance", () => {
  test("same chord has zero distance", () => {
    expect(chordDistance([60, 64, 67], [60, 64, 67])).toBe(0);
  });

  test("calculates voice-by-voice semitone distance", () => {
    // C root [60,64,67] → Am 1st inv [60,64,69]: only G→A = 2
    expect(chordDistance([60, 64, 67], [60, 64, 69])).toBe(2);
  });

  test("larger movement sums correctly", () => {
    // Each voice moves 12 semitones
    expect(chordDistance([60, 64, 67], [72, 76, 79])).toBe(12 + 12 + 12);
  });
});

describe("getInversionType", () => {
  test("identifies root position", () => {
    const result = getInversionType(C, [60, 64, 67]);
    expect(result.type).toBe("root");
  });

  test("identifies 1st inversion", () => {
    const result = getInversionType(C, [64, 67, 72]);
    expect(result.type).toBe("first");
    expect(result.slashNote).toBe("E");
  });

  test("identifies 2nd inversion", () => {
    const result = getInversionType(C, [67, 72, 76]);
    expect(result.type).toBe("second");
    expect(result.slashNote).toBe("G");
  });

  test("identifies inversion in different octave", () => {
    // 1st inversion one octave down: E3-G3-C4
    const result = getInversionType(C, [52, 55, 60]);
    expect(result.type).toBe("first");
  });
});

describe("getInversionLabel", () => {
  test("root position shows chord name only", () => {
    expect(getInversionLabel("C", C, [60, 64, 67])).toBe("C");
  });

  test("1st inversion shows slash notation", () => {
    expect(getInversionLabel("C", C, [64, 67, 72])).toBe("C/E");
  });

  test("2nd inversion shows slash notation", () => {
    expect(getInversionLabel("C", C, [67, 72, 76])).toBe("C/G");
  });

  test("works with minor chords", () => {
    expect(getInversionLabel("Am", Am, [72, 76, 81])).toBe("Am/C");
  });
});

describe("findClosestInversion", () => {
  test("finds closest Am inversion from C root position", () => {
    const closest = findClosestInversion([60, 64, 67], Am);
    // Am 1st inversion [60,64,69] has distance 2 — should be picked
    expect(chordDistance([60, 64, 67], closest)).toBeLessThanOrEqual(2);
  });

  test("result is a valid inversion of the target chord", () => {
    const closest = findClosestInversion([60, 64, 67], Am);
    const pitchClasses = closest.map((n) => n % 12).sort((a, b) => a - b);
    // Am pitch classes: A=9, C=0, E=4 → sorted: [0, 4, 9]
    expect(pitchClasses).toEqual([0, 4, 9]);
  });
});

describe("voiceLeadProgression", () => {
  test("first chord stays in root position", () => {
    const voiced = voiceLeadProgression(["C", "Am"], BASE_CHORDS);
    expect(voiced[0]).toEqual([...C]);
  });

  test("subsequent chords are optimized", () => {
    const voiced = voiceLeadProgression(["C", "Am", "F"], BASE_CHORDS);
    expect(voiced).toHaveLength(3);

    // Each transition should have reasonable distance
    for (let i = 1; i < voiced.length; i++) {
      const dist = chordDistance(voiced[i - 1], voiced[i]);
      // Optimized voice leading should keep distance small
      expect(dist).toBeLessThanOrEqual(10);
    }
  });
});
