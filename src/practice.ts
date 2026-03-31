import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<section id="center">
  <div>
    <h1>Practice Page</h1>
    <p>This is the <strong>practice</strong> page of the multi-page app.</p>
    <p>Edit <code>src/practice.ts</code> and save to test <code>HMR</code></p>
  </div>
  <div class="practice-area">
    <p>Timer: <span id="timer">0</span>s</p>
    <button id="start-btn" type="button" class="counter">Start Timer</button>
    <button id="reset-btn" type="button" class="counter">Reset</button>
  </div>
  <nav>
    <a href="/">Home</a> |
    <a href="/game.html">Game</a>
  </nav>
</section>
`;

let seconds = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const timerEl = document.querySelector<HTMLSpanElement>("#timer")!;
const startBtn = document.querySelector<HTMLButtonElement>("#start-btn")!;
const resetBtn = document.querySelector<HTMLButtonElement>("#reset-btn")!;

startBtn.addEventListener("click", () => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    startBtn.textContent = "Start Timer";
  } else {
    intervalId = setInterval(() => {
      seconds++;
      timerEl.textContent = String(seconds);
    }, 1000);
    startBtn.textContent = "Pause Timer";
  }
});

resetBtn.addEventListener("click", () => {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  seconds = 0;
  timerEl.textContent = "0";
  startBtn.textContent = "Start Timer";
});
