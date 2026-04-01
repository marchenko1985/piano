# Porting Roadmap

Tracking what to port from the old vanilla JS project (`~/Downloads/chords/`). Each item gets revisited before porting — some may be redesigned or dropped.

## Phase 1: Foundation

- [x] **`<piano-keyboard>` component** — rewrite as TypeScript Web Component with Shadow DOM
- [x] **Piano test page** (`debug/piano-keyboard.html`) — chord buttons, inversion controls, visual testing
- [x] **Chords module** — chord data, parsing (5 formats), MIDI↔note conversion, reverse lookup
- [x] **Chords test page** (`debug/chords.html`) — parse & build, MIDI↔name, reverse lookup, progressions
- [x] **MIDI module** — device detection, note on/off routing (TypeScript)

## Phase 2: First Game

- [x] **Session module** — timed sessions, progress tracking, inactivity timeout
- [x] **Progress bar** — native `<progress>` styled with design tokens (replaced web component)
- [x] **Session test page** (`debug/session.html`) — timer controls, progress demo
- [x] **Random chord game** (`random.html`) — timed practice, hand selection, progression-aware picking, chord presets (all/major/minor/progression), 8 song patterns with verse+chorus structure

## Phase 3: More Games

- [x] **Voice-leading module** — inversion generation, optimal voice leading, slash notation
- [x] **Inversions game** (`inversions.html`) — root→inversion practice (1st/2nd), song patterns with voice-led progressions
- [x] **Sequence game** (`sequence.html`) — custom/preset sequences, voice leading toggle, grid visualization, loop support
- [x] **Fingering hints** — context-aware finger numbers (1-5) on piano keyboard, common-tone retention across chord transitions
- [x] **Audio module** — Web Audio oscillator synthesis, SoundFont piano samples, metronome
- [ ] **Sheet music module** — VexFlow wrapper for notation rendering
- [ ] **Notes game** (`notes.html`) — single note sight-reading
- [ ] **Intervals game** (`intervals.html`) — harmonic interval recognition

## Phase 4: Rhythm

- [ ] **Rhythm game** (`rhythm.html`) — pattern practice with timing
- [ ] **Rhythm v2** — progressive 22-chapter curriculum (decide: port or redesign?)

## Phase 5: Reference Tools

- [x] **Inversion explorer** (`invert.html`) — voice leading path visualization, brute-force optimal paths with deduplication
- [ ] **Scale finder** (`scale-chords.html`) — find scales for given chords (candidate for mini game, not just reference)
- [ ] **Note visualizer** (`visualize-notes.html`)

## Phase 6: Cheat Sheets

- [ ] **Interval reference** (`interval.html`)
- [ ] **Scales reference** (`scales.html`)
- [ ] **Roman numerals** (`roman.html`)

## Cleanup

- [x] Remove placeholder demo code (counter, timer, click game)
- [x] Landing page with links to all games/tools
- [x] Favicon / branding
- [x] Design system (tokens + components)
