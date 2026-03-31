export interface MIDIManagerOptions {
  onMessage?: (event: MIDIMessageEvent) => void;
  onConnectionChange?: (connected: boolean, deviceName: string) => void;
}

export class MIDIManager {
  private onMessage: (event: MIDIMessageEvent) => void;
  private onConnectionChange: (connected: boolean, deviceName: string) => void;
  private midiAccess: MIDIAccess | null = null;
  private prevConnected = false;

  constructor(options: MIDIManagerOptions = {}) {
    this.onMessage = options.onMessage ?? (() => {});
    this.onConnectionChange = options.onConnectionChange ?? (() => {});
  }

  async initialize(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.error("Web MIDI API not supported");
      this.updateConnectionState();
      return false;
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess();
      this.setupHandlers();
      this.updateConnectionState();
      return true;
    } catch (error) {
      console.error("Could not access MIDI devices", error);
      this.updateConnectionState();
      return false;
    }
  }

  private setupHandlers(): void {
    if (!this.midiAccess) return;

    for (const input of this.midiAccess.inputs.values()) {
      input.onmidimessage = (event) => this.onMessage(event);
    }

    this.midiAccess.onstatechange = (event) => {
      const port = (event as MIDIConnectionEvent).port;
      if (port && port.type === "input" && port.state === "connected") {
        (port as MIDIInput).onmidimessage = (e) => this.onMessage(e);
      }
      this.updateConnectionState();
    };
  }

  private updateConnectionState(): void {
    let connected = false;
    let deviceName = "none";

    if (this.midiAccess) {
      const connectedInputs = Array.from(this.midiAccess.inputs.values()).filter(
        (input) => input.state === "connected",
      );
      connected = connectedInputs.length > 0;
      deviceName = connected ? connectedInputs[0].name || "Unknown Device" : "none";
    }

    if (this.prevConnected !== connected) {
      this.prevConnected = connected;
      this.onConnectionChange(connected, deviceName);
    }
  }
}
