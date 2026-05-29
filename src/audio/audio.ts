/* ============================================================
   Generated Web Audio engine — crowd ambience + SFX.
   Safe to call before init; respects the sound setting; never throws.
   ============================================================ */
import { clamp } from "../core/utils";
import { S } from "../state/save";

interface AudioEngine {
  ctx: AudioContext | null;
  master: GainNode | null;
  crowd: AudioBufferSourceNode | null;
  crowdGain: GainNode | null;
  ready: boolean;
  intensity: number;
}
export const Audio: AudioEngine = { ctx: null, master: null, crowd: null, crowdGain: null, ready: false, intensity: 0 };

export function initAudio() {
  if (Audio.ready) return;
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    Audio.ctx = new AC();
    Audio.master = Audio.ctx.createGain();
    Audio.master.gain.value = S.sound ? 0.9 : 0.0;
    Audio.master.connect(Audio.ctx.destination);
    // crowd ambience: filtered noise loop
    const len = Audio.ctx.sampleRate * 2;
    const buf = Audio.ctx.createBuffer(1, len, Audio.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = Audio.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = Audio.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 620; bp.Q.value = 0.7;
    const lp = Audio.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1100;
    Audio.crowdGain = Audio.ctx.createGain(); Audio.crowdGain.gain.value = 0.0;
    src.connect(bp); bp.connect(lp); lp.connect(Audio.crowdGain); Audio.crowdGain.connect(Audio.master);
    src.start();
    Audio.crowd = src;
    Audio.ready = true;
  } catch (e) { Audio.ready = false; }
}
export function setMasterVolume() { if (Audio.ready && Audio.master) Audio.master.gain.value = S.sound ? 0.9 : 0.0; }
export function setCrowd(level: number) {
  if (!Audio.ready || !Audio.crowdGain || !Audio.ctx) return;
  Audio.intensity = level;
  const g = clamp(level, 0, 1) * 0.16;
  Audio.crowdGain.gain.setTargetAtTime(S.sound ? g : 0, Audio.ctx.currentTime, 0.4);
}
function beep(freq: number, dur: number, type?: OscillatorType, vol?: number, slideTo?: number) {
  if (!Audio.ready || !S.sound || !Audio.ctx || !Audio.master) return;
  const t = Audio.ctx.currentTime;
  const o = Audio.ctx.createOscillator(), g = Audio.ctx.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(Audio.master); o.start(t); o.stop(t + dur + 0.02);
}
function noiseBurst(dur: number, vol?: number, freq?: number) {
  if (!Audio.ready || !S.sound || !Audio.ctx || !Audio.master) return;
  const t = Audio.ctx.currentTime, len = Audio.ctx.sampleRate * dur;
  const buf = Audio.ctx.createBuffer(1, len, Audio.ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = Audio.ctx.createBufferSource(); s.buffer = buf;
  const f = Audio.ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq || 1800; f.Q.value = 0.8;
  const g = Audio.ctx.createGain(); g.gain.value = vol || 0.2;
  s.connect(f); f.connect(g); g.connect(Audio.master); s.start();
}

export const SFX = {
  tap: () => beep(330, 0.05, "square", 0.07, 420),
  pass: () => { noiseBurst(0.06, 0.12, 1500); beep(360, 0.07, "triangle", 0.10, 300); },
  through: () => { beep(520, 0.09, "triangle", 0.12, 760); beep(300, 0.08, "sine", 0.07); },
  shot: () => { noiseBurst(0.08, 0.22, 900); beep(200, 0.12, "sawtooth", 0.14, 90); },
  power: () => { noiseBurst(0.12, 0.3, 700); beep(150, 0.18, "sawtooth", 0.18, 70); },
  finesse: () => { beep(700, 0.16, "sine", 0.13, 1100); beep(440, 0.12, "triangle", 0.09); },
  chip: () => { beep(500, 0.14, "sine", 0.1, 820); },
  tackle: () => { noiseBurst(0.07, 0.22, 500); beep(120, 0.08, "square", 0.12, 80); },
  slide: () => { noiseBurst(0.12, 0.24, 420); beep(140, 0.12, "sawtooth", 0.13, 70); },
  intercept: () => { beep(620, 0.09, "square", 0.12, 880); },
  save: () => { noiseBurst(0.1, 0.22, 650); beep(300, 0.1, "square", 0.12, 180); },
  post: () => { beep(900, 0.18, "square", 0.2, 560); beep(1300, 0.08, "square", 0.1); },
  goal: () => { beep(523, 0.12, "square", 0.18, 784); setTimeout(() => beep(784, 0.16, "square", 0.18, 1046), 100); setTimeout(() => beep(1046, 0.24, "square", 0.16), 230); noiseBurst(0.5, 0.18, 1400); },
  perfect: () => { beep(880, 0.08, "square", 0.14, 1320); beep(1320, 0.1, "sine", 0.1, 1760); },
  whistle: () => { beep(2100, 0.16, "square", 0.14, 2300); setTimeout(() => beep(2100, 0.22, "square", 0.14, 1900), 150); },
  whistleShort: () => beep(2200, 0.1, "square", 0.12, 2000),
  upgrade: () => { beep(440, 0.1, "triangle", 0.14, 660); setTimeout(() => beep(880, 0.16, "triangle", 0.14), 90); },
  win: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => beep(f, 0.2, "square", 0.15, f * 1.05), i * 120)); },
  loss: () => { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.26, "sawtooth", 0.13, f * 0.95), i * 150)); },
  promote: () => { [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => setTimeout(() => beep(f, 0.22, "triangle", 0.15), i * 110)); noiseBurst(0.6, 0.2, 1600); },
  reveal: () => { beep(660, 0.1, "sine", 0.12, 990); setTimeout(() => beep(990, 0.14, "sine", 0.12, 1320), 110); setTimeout(() => beep(1320, 0.18, "triangle", 0.12), 230); },
  click: () => beep(420, 0.04, "square", 0.06, 500),
  tension: () => beep(180, 0.5, "sine", 0.05, 150),
};
