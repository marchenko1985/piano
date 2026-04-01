import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <h1>Piano</h1>
  <p class="text-muted">A collection of mini-games for learning piano with a MIDI keyboard.</p>

  <section class="stack-sm">
    <h2>Games</h2>
    <ul>
      <li><a href="/piano/random.html">Random Chords</a> — timed chord practice with progressions</li>
      <li><a href="/piano/inversions.html">Inversions</a> — chord inversion practice with voice leading</li>
      <li><a href="/piano/sequence.html">Sequence</a> — custom chord sequence practice</li>
    </ul>
  </section>

  <section class="stack-sm">
    <h2>Debug</h2>
    <ul>
      <li><a href="/piano/debug/piano-keyboard.html">Piano Keyboard</a> — component test page</li>
      <li><a href="/piano/debug/chords.html">Chords</a> — chord parsing, building, and lookup</li>
      <li><a href="/piano/debug/session.html">Session</a> — timer, progress bar, inactivity timeout</li>
      <li><a href="/piano/debug/components.html">Components</a> — design system showcase</li>
      <li><a href="/piano/debug/audio.html">Web Audio</a> — oscillator synthesis, note & chord playback</li>
      <li><a href="/piano/debug/soundfont.html">SoundFont</a> — piano sample playback</li>
      <li><a href="/piano/debug/metronome.html">Metronome</a> — tempo, time signature, visual beat</li>
    </ul>
  </section>
`;
