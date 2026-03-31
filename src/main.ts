import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <h1>Piano</h1>
  <p class="text-muted">A collection of mini-games for learning piano with a MIDI keyboard.</p>

  <section class="stack-sm">
    <h2>Debug</h2>
    <ul>
      <li><a href="/piano/debug/piano-keyboard.html">Piano Keyboard</a> — component test page</li>
      <li><a href="/piano/debug/chords.html">Chords</a> — chord parsing, building, and lookup</li>
      <li><a href="/piano/debug/session.html">Session</a> — timer, progress bar, inactivity timeout</li>
      <li><a href="/piano/debug/components.html">Components</a> — design system showcase</li>
    </ul>
  </section>
`;
