import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<section id="center">
  <div>
    <h1>Game Page</h1>
    <p>This is the <strong>game</strong> page of the multi-page app.</p>
    <p>Edit <code>src/game.ts</code> and save to test <code>HMR</code></p>
  </div>
  <div class="game-area">
    <p id="score">Score: 0</p>
    <button id="click-btn" type="button" class="counter">Click me!</button>
  </div>
  <nav>
    <a href="/">Home</a> |
    <a href="/practice.html">Practice</a>
  </nav>
</section>
`;

let score = 0;
const btn = document.querySelector<HTMLButtonElement>("#click-btn")!;
const scoreEl = document.querySelector<HTMLParagraphElement>("#score")!;

btn.addEventListener("click", () => {
  score++;
  scoreEl.textContent = `Score: ${score}`;
});
