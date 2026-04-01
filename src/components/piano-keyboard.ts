const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const BLACK_KEY_PITCHES = new Set([1, 3, 6, 8, 10]); // C#, D#, F#, G#, A#

interface PianoKey {
  midi: number;
  pitch: number;
  isBlack: boolean;
  octave: number;
  note: string;
}

type ColorAttribute = "gray" | "yellow" | "orange" | "red" | "green";

const COLOR_ATTRIBUTES: ColorAttribute[] = ["gray", "yellow", "orange", "red", "green"];

const COLOR_CSS_MAP: Record<ColorAttribute, string> = {
  gray: "gray",
  yellow: "highlight",
  orange: "orange",
  red: "red",
  green: "green",
};

function parseCommaSeparatedNumbers(str: string | null): number[] {
  if (!str) return [];
  return str
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean)
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
}

function generateKeys(startNote: number, endNote: number): PianoKey[] {
  const keys: PianoKey[] = [];
  for (let midi = startNote; midi <= endNote; midi++) {
    const pitch = midi % 12;
    keys.push({
      midi,
      pitch,
      isBlack: BLACK_KEY_PITCHES.has(pitch),
      octave: Math.floor(midi / 12) - 1,
      note: NOTE_NAMES[pitch],
    });
  }
  return keys;
}

export class PianoKeyboardElement extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.addEventListener("click", (e) => {
      const kbd = (e.target as HTMLElement).closest("kbd");
      if (!kbd) return;
      const midi = Number(kbd.getAttribute("data-midi"));
      if (!Number.isNaN(midi)) {
        this.dispatchEvent(new CustomEvent("key-click", { detail: { midi }, bubbles: true }));
      }
    });
    this.shadowRoot!.addEventListener("mousedown", (e) => {
      const kbd = (e.target as HTMLElement).closest("kbd");
      if (!kbd) return;
      const midi = Number(kbd.getAttribute("data-midi"));
      if (!Number.isNaN(midi)) {
        this.dispatchEvent(new CustomEvent("key-down", { detail: { midi }, bubbles: true }));
      }
    });
    this.shadowRoot!.addEventListener("mouseup", (e) => {
      const kbd = (e.target as HTMLElement).closest("kbd");
      if (!kbd) return;
      const midi = Number(kbd.getAttribute("data-midi"));
      if (!Number.isNaN(midi)) {
        this.dispatchEvent(new CustomEvent("key-up", { detail: { midi }, bubbles: true }));
      }
    });
  }

  connectedCallback(): void {
    this.#render();
  }

  static get observedAttributes(): string[] {
    return COLOR_ATTRIBUTES;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if ((COLOR_ATTRIBUTES as readonly string[]).includes(name) && oldValue !== newValue) {
      this.#render();
    }
  }

  get gray(): number[] {
    return parseCommaSeparatedNumbers(this.getAttribute("gray"));
  }

  get yellow(): number[] {
    return parseCommaSeparatedNumbers(this.getAttribute("yellow"));
  }

  get orange(): number[] {
    return parseCommaSeparatedNumbers(this.getAttribute("orange"));
  }

  get red(): number[] {
    return parseCommaSeparatedNumbers(this.getAttribute("red"));
  }

  get green(): number[] {
    return parseCommaSeparatedNumbers(this.getAttribute("green"));
  }

  #getClassNames(midi: number): string {
    const classes: string[] = [];
    for (const attr of COLOR_ATTRIBUTES) {
      if (this[attr].includes(midi)) {
        classes.push(COLOR_CSS_MAP[attr]);
      }
    }
    return classes.join(" ");
  }

  #render(): void {
    const startNote = parseInt(this.getAttribute("start") ?? "48", 10); // C3
    const endNote = parseInt(this.getAttribute("end") ?? "84", 10); // C6

    const keys = generateKeys(startNote, endNote);
    const whiteKeys = keys.filter((k) => !k.isBlack);
    const blackKeys = keys.filter((k) => k.isBlack);
    const whiteCount = whiteKeys.length;

    const hostWidth = this.clientWidth;
    const keyWidth = hostWidth > 0 ? hostWidth / whiteCount : 30;
    const showOctave = keyWidth >= 25;

    const whiteHtml = whiteKeys
      .map((key) => {
        const label = key.note === "C" && showOctave ? key.note + key.octave : key.note;
        return `<kbd class="white ${this.#getClassNames(key.midi)}" data-label="${label}" data-note="${key.note}" data-octave="${key.octave}" data-midi="${key.midi}" data-pitch="${key.pitch}"></kbd>`;
      })
      .join("");

    const blackHtml = blackKeys
      .map((key) => {
        const positionIndex = whiteKeys.findIndex((w) => w.midi > key.midi);
        return `<kbd class="black ${this.#getClassNames(key.midi)}" data-note="${key.note}" data-octave="${key.octave}" data-midi="${key.midi}" data-pitch="${key.pitch}" style="left: calc(100%/${whiteCount}*${positionIndex})"></kbd>`;
      })
      .join("");

    this.shadowRoot!.innerHTML = `
      <style>
        :host {
          display: flex;
          position: relative;
          color: black;
        }

        .white {
          flex: 1;
          height: 100%;
          background: white;
          outline: 1px solid black;
          border-radius: 0 0 3px 3px;
          position: relative;
          box-sizing: border-box;
          cursor: pointer;
        }

        .white::after {
          content: attr(data-label);
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          text-align: center;
          line-height: 2;
          pointer-events: none;
        }

        .black {
          top: 0;
          width: calc(100% / ${whiteCount} * 0.6);
          height: 60%;
          background: black;
          border: 1px solid black;
          border-radius: 0 0 2px 2px;
          position: absolute;
          z-index: 1;
          box-sizing: border-box;
          transform: translateX(-50%);
          cursor: pointer;
        }

        .gray { background-color: lightgray; }
        .highlight { background-color: yellow; }
        .orange { background-color: orange; }
        .green { background: limegreen; }
        .red { background-color: tomato; }
      </style>
      ${whiteHtml}
      ${blackHtml}
    `;
  }
}

customElements.define("piano-keyboard", PianoKeyboardElement);
