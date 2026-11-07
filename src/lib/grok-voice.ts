/**
 * Browser-side Grok Voice playback.
 * The API key never reaches this file. The server mints a short-lived client secret.
 * Spoken lines are the vision copilot's already-filtered text, sent with force_message
 * so the voice model does not invent its own wiring advice.
 */

type TokenResponse = {
  ok?: boolean;
  value?: string;
  model?: string;
  error?: string;
};

export class GrokSpeaker {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private nextTime = 0;
  private connectPromise: Promise<boolean> | null = null;

  async ensure(): Promise<boolean> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return true;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  speak(text: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "force_message",
          role: "assistant",
          interruptible: true,
          content: [{ type: "output_text", text }],
        },
      }),
    );
    return true;
  }

  stop() {
    this.ws?.close();
    this.ws = null;
    this.nextTime = 0;
  }

  private async connect(): Promise<boolean> {
    const response = await fetch("/api/voice/token", { method: "POST" });
    const data = (await response.json()) as TokenResponse;
    if (!response.ok || !data.value) {
      throw new Error(data.error || "Grok Voice is unavailable.");
    }
    const model = encodeURIComponent(data.model || "grok-voice-latest");
    const ws = new WebSocket(`wss://api.x.ai/v1/realtime?model=${model}`, [`xai-client-secret.${data.value}`]);
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Grok Voice timed out. Using browser speech.")), 8000);
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: "session.update",
            session: {
              voice: "eve",
              instructions:
                "You are the speaking voice of Nobi Vision. Say only the scripted force_message lines. Do not add electrical advice.",
              turn_detection: null,
              audio: {
                input: { format: { type: "audio/pcm", rate: 24000 } },
                output: { format: { type: "audio/pcm", rate: 24000 } },
              },
            },
          }),
        );
        window.clearTimeout(timer);
        resolve();
      };
      ws.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("Grok Voice connection failed. Using browser speech."));
      };
    });

    ws.onmessage = (event) => {
      if (typeof event.data !== "string") return;
      let payload: { type?: string; delta?: string };
      try {
        payload = JSON.parse(event.data) as { type?: string; delta?: string };
      } catch {
        return;
      }
      if (
        (payload.type === "response.output_audio.delta" || payload.type === "response.audio.delta") &&
        payload.delta
      ) {
        this.playPcm(payload.delta);
      }
    };
    return true;
  }

  private playPcm(b64: string) {
    const ctx = this.audio();
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const samples = Math.floor(bytes.length / 2);
    if (!samples) return;
    const buffer = ctx.createBuffer(1, samples, 24000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples; i += 1) channel[i] = view.getInt16(i * 2, true) / 32768;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const start = Math.max(ctx.currentTime + 0.04, this.nextTime);
    source.start(start);
    this.nextTime = start + buffer.duration;
  }

  private audio(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }
}
