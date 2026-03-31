/**
 * Session lifecycle and timer management.
 * Manages practice session timing, inactivity tracking, and progress display.
 */

export interface SessionOptions {
  /** Total session duration in ms (default: 180 000 = 3 min). */
  totalDuration?: number;
  /** Inactivity timeout in ms (default: 30 000 = 30 s). */
  inactivityTimeout?: number;
  /** Called when the session ends (time up or inactivity). */
  onEnd?: () => void;
  /** Native `<progress>` element to update. */
  progressElement?: HTMLProgressElement | null;
}

export class Session {
  readonly totalDuration: number;
  readonly inactivityTimeout: number;

  #onEnd: () => void;
  #progressEl: HTMLProgressElement | null;

  #started = false;
  #active = true;
  #startTime: number | null = null;
  #inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  #progressInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: SessionOptions = {}) {
    this.totalDuration = options.totalDuration ?? 180_000;
    this.inactivityTimeout = options.inactivityTimeout ?? 30_000;
    this.#onEnd = options.onEnd ?? (() => {});
    this.#progressEl = options.progressElement ?? null;
  }

  get started(): boolean {
    return this.#started;
  }

  get active(): boolean {
    return this.#active;
  }

  get elapsed(): number {
    return this.#startTime ? Date.now() - this.#startTime : 0;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  start(): void {
    if (this.#started) return;

    this.#started = true;
    this.#active = true;
    this.#startTime = Date.now();

    this.#resetInactivityTimer();
    this.#startProgressUpdates();
  }

  pause(): void {
    this.#clearInactivityTimer();
  }

  resume(): void {
    if (this.#started && this.#active) {
      this.#resetInactivityTimer();
    }
  }

  end(): void {
    if (!this.#active) return;
    this.#active = false;

    this.#clearInactivityTimer();
    this.#clearProgressInterval();
    this.#updateProgress(100);
    this.#onEnd();
  }

  reset(): void {
    this.#started = false;
    this.#active = true;
    this.#startTime = null;

    this.#clearInactivityTimer();
    this.#clearProgressInterval();
    this.#updateProgress(0);
  }

  /** Call on every user activity (note played, button pressed, etc.). */
  activity(): void {
    this.#resetInactivityTimer();
  }

  destroy(): void {
    this.reset();
  }

  // ── Private ──────────────────────────────────────────────────────

  #resetInactivityTimer(): void {
    if (!this.#active || !this.#started) return;

    this.#clearInactivityTimer();
    this.#inactivityTimer = setTimeout(() => this.end(), this.inactivityTimeout);
  }

  #clearInactivityTimer(): void {
    if (this.#inactivityTimer) {
      clearTimeout(this.#inactivityTimer);
      this.#inactivityTimer = null;
    }
  }

  #startProgressUpdates(): void {
    this.#progressInterval = setInterval(() => {
      if (!this.#active || !this.#startTime) return;

      const progress = Math.min((this.elapsed / this.totalDuration) * 100, 100);
      this.#updateProgress(progress);

      if (this.elapsed >= this.totalDuration) {
        this.end();
      }
    }, 100);
  }

  #clearProgressInterval(): void {
    if (this.#progressInterval) {
      clearInterval(this.#progressInterval);
      this.#progressInterval = null;
    }
  }

  #updateProgress(percent: number): void {
    if (this.#progressEl) {
      this.#progressEl.value = percent;
    }
  }
}
