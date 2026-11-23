// Voice audio through the game server: the fallback for when a direct WebRTC link between two
// people can't be made (phones on mobile data, strict NATs, no TURN relay configured).
// The mic is downsampled to 16 kHz mono, mu-law encoded (8 bits a sample, 16 KB/s) and sent in
// ~85 ms chunks over the room's WebSocket, only while push-to-talk is held. Incoming chunks are
// played back through Web Audio with a small jitter buffer per speaker.

const RATE = 16000;
const CHUNK = 1360; // samples per message, ~85 ms; stays well under the server's 4 KB message cap
const JITTER = 0.12; // seconds of buffer before the first chunk plays
const MAX_AHEAD = 0.8; // if playback falls this far behind, skip ahead to keep latency low

function muLawEncode(x: number): number {
  const BIAS = 0x84;
  let s = Math.max(-1, Math.min(1, x)) * 32767;
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  s = Math.floor(Math.min(32635, s)) + BIAS;
  let exp = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exp > 0; mask >>= 1) exp--;
  const mant = (s >> (exp + 3)) & 0x0f;
  return ~(sign | (exp << 4) | mant) & 0xff;
}

const MU_DECODE = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const u = ~i & 0xff;
    const sign = u & 0x80;
    const exp = (u >> 4) & 0x07;
    const mant = u & 0x0f;
    const s = (((mant << 3) + 0x84) << exp) - 0x84;
    t[i] = (sign ? -s : s) / 32768;
  }
  return t;
})();

function toBase64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
}

export class AudioRelay {
  readonly ctx: AudioContext;
  private source: MediaStreamAudioSourceNode | null = null;
  private proc: ScriptProcessorNode | null = null;
  private sink: GainNode;
  private out: GainNode;
  private active = false;
  private buf = new Uint8Array(CHUNK);
  private n = 0;
  private acc = 0;
  private accN = 0;
  private pos = 0;
  private next = new Map<string, number>();

  constructor(private sendChunk: (b64: string) => void) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.sink = this.ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(this.ctx.destination);
    this.out = this.ctx.createGain();
    this.out.connect(this.ctx.destination);
  }

  /** Phones only run audio after a tap. */
  resume(): void {
    if (this.ctx.state !== "running") this.ctx.resume().catch(() => {});
  }

  /** Start reading the mic (it only sends while active). */
  attach(stream: MediaStream): void {
    this.source = this.ctx.createMediaStreamSource(stream);
    this.proc = this.ctx.createScriptProcessor(2048, 1, 1);
    const ratio = this.ctx.sampleRate / RATE;
    this.proc.onaudioprocess = (e) => {
      if (!this.active) return;
      const input = e.inputBuffer.getChannelData(0);
      for (let i = 0; i < input.length; i++) {
        this.acc += input[i];
        this.accN++;
        this.pos += 1;
        if (this.pos >= ratio) {
          this.pos -= ratio;
          this.buf[this.n++] = muLawEncode(this.acc / this.accN);
          this.acc = 0;
          this.accN = 0;
          if (this.n === CHUNK) this.flush();
        }
      }
    };
    this.source.connect(this.proc);
    this.proc.connect(this.sink);
  }

  private flush(): void {
    if (this.n) this.sendChunk(toBase64(this.buf.subarray(0, this.n)));
    this.n = 0;
  }

  setActive(on: boolean): void {
    if (on === this.active) return;
    this.active = on;
    if (on) this.resume();
    else this.flush();
    this.acc = this.accN = this.pos = 0;
  }

  /** Play a chunk someone else sent. */
  play(from: string, b64: string): void {
    let u8: Uint8Array;
    try {
      u8 = fromBase64(b64);
    } catch {
      return;
    }
    if (!u8.length) return;
    const ctx = this.ctx;
    // Upsample to the context's rate (old Safari can't make 16 kHz buffers).
    const ratio = ctx.sampleRate / RATE;
    const len = Math.floor(u8.length * ratio);
    const ab = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = ab.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const p = i / ratio;
      const j = Math.floor(p);
      const a = MU_DECODE[u8[j]];
      const b = MU_DECODE[u8[Math.min(j + 1, u8.length - 1)]];
      data[i] = a + (b - a) * (p - j);
    }
    const node = ctx.createBufferSource();
    node.buffer = ab;
    node.connect(this.out);
    const now = ctx.currentTime;
    let at = this.next.get(from) ?? 0;
    if (at < now || at > now + MAX_AHEAD) at = now + JITTER;
    node.start(at);
    this.next.set(from, at + ab.duration);
  }

  close(): void {
    this.active = false;
    this.proc?.disconnect();
    this.source?.disconnect();
    if (this.proc) this.proc.onaudioprocess = null;
    this.ctx.close().catch(() => {});
  }
}
