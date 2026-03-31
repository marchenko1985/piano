import "../style.css";
import { Session } from "../session.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.className = "page stack-lg";

app.innerHTML = `
  <h1>Session Module</h1>

  <section class="stack-sm">
    <h2>Progress Bar</h2>
    <p class="text-muted">Native &lt;progress&gt; element styled with design tokens.</p>
    <progress id="progress-demo" max="100" value="0"></progress>
    <div class="row-sm center">
      <input id="progress-slider" type="range" min="0" max="100" value="0" style="width: 300px; max-width: 100%" />
      <span id="progress-value" class="text-muted">0%</span>
    </div>
  </section>

  <section class="stack-sm">
    <h2>Session Timer</h2>
    <p class="text-muted">Timed session with progress bar and inactivity timeout.</p>
    <progress id="session-progress" max="100" value="0"></progress>
    <div class="row-sm center">
      <span class="text-muted">Duration</span>
      <select id="duration-select" class="select" style="width: auto">
        <option value="10000">10 sec</option>
        <option value="30000">30 sec</option>
        <option value="60000">1 min</option>
        <option value="180000" selected>3 min</option>
      </select>
      <span class="text-muted">Inactivity</span>
      <select id="inactivity-select" class="select" style="width: auto">
        <option value="5000">5 sec</option>
        <option value="10000">10 sec</option>
        <option value="30000" selected>30 sec</option>
      </select>
    </div>
    <div class="row-sm center">
      <button class="btn btn-primary" id="start-btn">Start</button>
      <button class="btn btn-secondary" id="activity-btn" disabled>Activity</button>
      <button class="btn btn-secondary" id="pause-btn" disabled>Pause</button>
      <button class="btn btn-secondary" id="resume-btn" disabled>Resume</button>
      <button class="btn btn-ghost" id="reset-btn" disabled>Reset</button>
    </div>
    <p id="session-status" class="text-muted">Not started</p>
    <p id="session-elapsed" class="text-muted"></p>
  </section>
`;

// ── Progress bar demo ────────────────────────────────────────────────

const progressDemo = document.getElementById("progress-demo") as HTMLProgressElement;
const progressSlider = document.getElementById("progress-slider") as HTMLInputElement;
const progressValue = document.getElementById("progress-value")!;

progressSlider.addEventListener("input", () => {
  const val = Number(progressSlider.value);
  progressDemo.value = val;
  progressValue.textContent = `${val}%`;
});

// ── Session timer demo ───────────────────────────────────────────────

const sessionProgress = document.getElementById("session-progress") as HTMLProgressElement;
const durationSelect = document.getElementById("duration-select") as HTMLSelectElement;
const inactivitySelect = document.getElementById("inactivity-select") as HTMLSelectElement;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const activityBtn = document.getElementById("activity-btn") as HTMLButtonElement;
const pauseBtn = document.getElementById("pause-btn") as HTMLButtonElement;
const resumeBtn = document.getElementById("resume-btn") as HTMLButtonElement;
const resetBtn = document.getElementById("reset-btn") as HTMLButtonElement;
const sessionStatus = document.getElementById("session-status")!;
const sessionElapsed = document.getElementById("session-elapsed")!;

let session: Session | null = null;
let elapsedInterval: ReturnType<typeof setInterval> | null = null;

function updateButtons(state: "idle" | "running" | "paused" | "ended"): void {
  startBtn.disabled = state !== "idle";
  activityBtn.disabled = state !== "running";
  pauseBtn.disabled = state !== "running";
  resumeBtn.disabled = state !== "paused";
  resetBtn.disabled = state === "idle";
  durationSelect.disabled = state !== "idle";
  inactivitySelect.disabled = state !== "idle";
}

function startElapsedDisplay(): void {
  elapsedInterval = setInterval(() => {
    if (session?.active && session.started) {
      const s = (session.elapsed / 1000).toFixed(1);
      sessionElapsed.textContent = `Elapsed: ${s}s / ${(session.totalDuration / 1000).toFixed(0)}s`;
    }
  }, 100);
}

function stopElapsedDisplay(): void {
  if (elapsedInterval) {
    clearInterval(elapsedInterval);
    elapsedInterval = null;
  }
}

startBtn.addEventListener("click", () => {
  session = new Session({
    totalDuration: Number(durationSelect.value),
    inactivityTimeout: Number(inactivitySelect.value),
    progressElement: sessionProgress,
    onEnd: () => {
      sessionStatus.textContent = "Session ended";
      stopElapsedDisplay();
      updateButtons("ended");
    },
  });
  session.start();
  sessionStatus.textContent = "Running";
  updateButtons("running");
  startElapsedDisplay();
});

activityBtn.addEventListener("click", () => {
  session?.activity();
  sessionStatus.textContent = "Running (activity registered)";
  setTimeout(() => {
    if (session?.active) sessionStatus.textContent = "Running";
  }, 500);
});

pauseBtn.addEventListener("click", () => {
  session?.pause();
  sessionStatus.textContent = "Paused";
  updateButtons("paused");
});

resumeBtn.addEventListener("click", () => {
  session?.resume();
  sessionStatus.textContent = "Running";
  updateButtons("running");
});

resetBtn.addEventListener("click", () => {
  session?.destroy();
  session = null;
  sessionStatus.textContent = "Not started";
  sessionElapsed.textContent = "";
  stopElapsedDisplay();
  updateButtons("idle");
});
