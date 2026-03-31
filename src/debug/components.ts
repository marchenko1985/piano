import "../style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <h1>Design System Components</h1>

  <section class="stack-sm">
    <h2>Buttons</h2>
    <div class="row-sm" style="flex-wrap: wrap">
      <button class="btn btn-primary">Primary</button>
      <button class="btn btn-secondary">Secondary</button>
      <button class="btn btn-ghost">Ghost</button>
      <button class="btn btn-primary" disabled>Disabled</button>
    </div>
    <div class="row-sm" style="flex-wrap: wrap">
      <button class="btn btn-primary btn-sm">Primary sm</button>
      <button class="btn btn-secondary btn-sm">Secondary sm</button>
      <button class="btn btn-ghost btn-sm">Ghost sm</button>
      <button class="btn btn-sm" disabled>Disabled sm</button>
    </div>
  </section>

  <section class="stack-sm">
    <h2>Form Elements</h2>
    <div class="stack-sm" style="max-width: 400px">
      <input class="input" type="text" placeholder="Text input" />
      <input class="input" type="text" value="With value" />
      <select class="select">
        <option>Select option 1</option>
        <option>Select option 2</option>
        <option>Select option 3</option>
      </select>
    </div>
  </section>

  <section class="stack-sm">
    <h2>Badges</h2>
    <div class="row-sm" style="flex-wrap: wrap">
      <span class="badge badge-accent">Accent</span>
      <span class="badge badge-success">Success</span>
      <span class="badge badge-warning">Warning</span>
      <span class="badge badge-error">Error</span>
      <span class="badge badge-info">Info</span>
    </div>
  </section>

  <section class="stack-sm">
    <h2>Card</h2>
    <div class="card stack-sm">
      <h3>Card Title</h3>
      <p>This is a card container with some content inside it.</p>
      <div class="row-sm">
        <button class="btn btn-primary btn-sm">Action</button>
        <button class="btn btn-ghost btn-sm">Cancel</button>
      </div>
    </div>
  </section>

  <section class="stack-sm">
    <h2>Typography</h2>
    <h1>Heading 1 (--text-2xl)</h1>
    <h2>Heading 2 (--text-xl)</h2>
    <h3>Heading 3 (--text-lg)</h3>
    <p>Body text (--text-base). The quick brown fox jumps over the lazy dog.</p>
    <p class="text-muted">Muted text for secondary information.</p>
    <p class="text-accent">Accent text for emphasis.</p>
    <p class="text-error">Error text.</p>
    <p class="text-success">Success text.</p>
    <p class="text-warning">Warning text.</p>
    <p><code>Inline code</code></p>
  </section>

  <section class="stack-sm">
    <h2>Layout: Stack</h2>
    <div class="stack-sm">
      <div class="card">stack-sm item 1</div>
      <div class="card">stack-sm item 2</div>
      <div class="card">stack-sm item 3</div>
    </div>
  </section>

  <section class="stack-sm">
    <h2>Layout: Row</h2>
    <div class="row-sm">
      <div class="card">row-sm 1</div>
      <div class="card">row-sm 2</div>
      <div class="card">row-sm 3</div>
    </div>
    <div class="row-md">
      <div class="card">row-md 1</div>
      <div class="card">row-md 2</div>
      <div class="card">row-md 3</div>
    </div>
  </section>

  <section class="stack-sm">
    <h2>Dialog</h2>
    <button class="btn btn-secondary" id="open-dialog">Open Dialog</button>
    <dialog class="dialog stack-sm" id="demo-dialog">
      <h3>Dialog Title</h3>
      <p>This is a dialog with some content.</p>
      <div class="row-sm">
        <button class="btn btn-primary btn-sm" id="close-dialog">Close</button>
      </div>
    </dialog>
  </section>
`;

document.getElementById("open-dialog")!.addEventListener("click", () => {
  (document.getElementById("demo-dialog") as HTMLDialogElement).showModal();
});
document.getElementById("close-dialog")!.addEventListener("click", () => {
  (document.getElementById("demo-dialog") as HTMLDialogElement).close();
});
