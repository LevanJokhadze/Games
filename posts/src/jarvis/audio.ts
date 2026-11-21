// Microphone in (16 kHz PCM for Gemini Live) and speech out (24 kHz PCM from it). Same as the Personal Dashboard's work mode.

// Runs on the audio thread: downsamples the mic to 16 kHz, posts ~64 ms chunks of 16-bit PCM plus a level.
const WORKLET = `
class MicChunker extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / 16000;
    this.phase = 0; this.acc = 0; this.count = 0;
    this.out = new Int16Array(1024); this.n = 0; this.energy = 0; this.seen = 0;
  }
  process(inputs) {
    const x = inputs[0] && inputs[0][0];
    if (!x) return true;
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      this.energy += v * v; this.seen++;
      this.acc += v; this.count++; this.phase += 1;
      if (this.phase >= this.step) {
        const s = Math.max(-1, Math.min(1, this.acc / this.count));
        this.out[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        this.phase -= this.step; this.acc = 0; this.count = 0;
        if (this.n === this.out.length) {
          this.port.postMessage({ pcm: this.out.buffer, level: Math.sqrt(this.energy / this.seen) }, [this.out.buffer]);
          this.out = new Int16Array(1024); this.n = 0; this.energy = 0; this.seen = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor("mic-chunker", MicChunker);
`;

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export class Mic {
  private constructor(
    private ctx: AudioContext,
    private stream: MediaStream,
  ) {}

  static async open(onChunk: (pcm: ArrayBuffer, level: number) => void): Promise<Mic> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ctx = new AudioContext();
    const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
    await ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    const node = new AudioWorkletNode(ctx, "mic-chunker");
    node.port.onmessage = (e) => onChunk(e.data.pcm, e.data.level);
    ctx.createMediaStreamSource(stream).connect(node);
    return new Mic(ctx, stream);
  }

  close() {
    this.stream.getTracks().forEach((t) => t.stop());
    this.ctx.close().catch(() => {});
  }
}

export class Player {
  private ctx = new AudioContext({ sampleRate: 24000 });
  private next = 0;
  private playing = new Set<AudioBufferSourceNode>();

  resume() {
    return this.ctx.resume();
  }

  play(b64: string) {
    const bin = atob(b64);
    const pcm = new Int16Array(bin.length >> 1);
    for (let i = 0; i < pcm.length; i++) {
      const v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      pcm[i] = v >= 0x8000 ? v - 0x10000 : v;
    }
    const buf = this.ctx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    const at = Math.max(this.ctx.currentTime + 0.04, this.next);
    src.start(at);
    this.next = at + buf.duration;
    this.playing.add(src);
    src.onended = () => this.playing.delete(src);
  }

  // Levan talked over it: drop what is queued.
  stop() {
    for (const s of this.playing) s.stop();
    this.playing.clear();
    this.next = 0;
  }

  get speaking() {
    return this.next > this.ctx.currentTime;
  }

  close() {
    this.stop();
    this.ctx.close().catch(() => {});
  }
}
