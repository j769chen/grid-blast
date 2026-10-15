import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 22050;
const OUT = join(import.meta.dirname, '..', 'assets', 'sounds');

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WAVES = {
  sine: (p) => Math.sin(2 * Math.PI * p),
  triangle: (p) => 1 - 4 * Math.abs((p % 1) - 0.5),
  square: (p) => (p % 1 < 0.5 ? 1 : -1),
  saw: (p) => 2 * (p % 1) - 1,
};

function buffer(seconds) {
  return new Float32Array(Math.round(seconds * RATE));
}

function env(t, attack, decay) {
  return t < attack ? t / attack : Math.exp(-(t - attack) / decay);
}

function tone(out, { at = 0, len, wave = 'sine', from, to = from, gain = 1, attack = 0.003, decay = len / 4 }) {
  const start = Math.round(at * RATE);
  const n = Math.round(len * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    phase += (from * Math.pow(to / from, t / len)) / RATE;
    out[start + i] += WAVES[wave](phase) * env(t, attack, decay) * gain;
  }
}

function noise(out, { at = 0, len, gain = 1, attack = 0.001, decay = len / 4, cutoff = 4000, seed = 1, gate }) {
  const rand = rng(seed);
  const start = Math.round(at * RATE);
  const n = Math.round(len * RATE);
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    y += k * (rand() * 2 - 1 - y);
    const open = gate ? gate(t, rand) : 1;
    out[start + i] += y * open * env(t, attack, decay) * gain;
  }
}

function lowpass(out, cutoff) {
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  for (let i = 0; i < out.length; i++) out[i] = y += k * (out[i] - y);
  return out;
}

function finish(out, peak) {
  const fade = Math.round(0.004 * RATE);
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  const max = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  return out.map((v) => (v / max) * peak);
}

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const head = Buffer.alloc(44);
  head.write('RIFF', 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write('WAVEfmt ', 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write('data', 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

const SOUNDS = {
  lift() {
    const out = buffer(0.07);
    tone(out, { len: 0.07, from: 520, to: 780, decay: 0.025 });
    return finish(out, 0.3);
  },
  rotate() {
    const out = buffer(0.05);
    tone(out, { len: 0.05, wave: 'triangle', from: 1400, decay: 0.012 });
    tone(out, { len: 0.05, from: 2100, gain: 0.5, decay: 0.008 });
    return finish(out, 0.28);
  },
  place() {
    const out = buffer(0.12);
    tone(out, { len: 0.12, from: 190, to: 110, decay: 0.035 });
    noise(out, { len: 0.02, cutoff: 2500, gain: 0.5, decay: 0.004 });
    return finish(out, 0.55);
  },
  spark() {
    const out = buffer(0.32);
    tone(out, { len: 0.32, wave: 'saw', from: 85, to: 120, gain: 0.35, attack: 0.01, decay: 0.2 });
    tone(out, { len: 0.32, wave: 'square', from: 1500, to: 3200, gain: 0.12, attack: 0.02, decay: 0.15 });
    noise(out, {
      len: 0.32,
      cutoff: 6000,
      decay: 0.25,
      seed: 7,
      gate: (t, rand) => (Math.sin(t * 2 * Math.PI * 23) > 0.2 && rand() > 0.35 ? 1 : 0.15),
    });
    return finish(lowpass(out, 7000), 0.42);
  },
  clear() {
    const out = buffer(0.3);
    tone(out, { len: 0.12, wave: 'square', from: 1319, gain: 0.6, decay: 0.05 });
    tone(out, { at: 0.06, len: 0.24, wave: 'square', from: 1976, gain: 0.6, decay: 0.08 });
    tone(out, { at: 0.06, len: 0.24, from: 3951, gain: 0.25, decay: 0.06 });
    return finish(lowpass(out, 5000), 0.42);
  },
  blast() {
    const out = buffer(0.55);
    tone(out, { len: 0.55, from: 120, to: 34, attack: 0.004, decay: 0.18 });
    noise(out, { len: 0.55, cutoff: 900, gain: 1.4, attack: 0.002, decay: 0.12, seed: 3 });
    noise(out, { len: 0.08, cutoff: 5000, gain: 0.5, decay: 0.02, seed: 4 });
    return finish(out, 0.8);
  },
  perfect() {
    const out = buffer(0.85);
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      tone(out, { at: i * 0.08, len: 0.45, wave: 'triangle', from: f, decay: 0.16 });
      tone(out, { at: i * 0.08, len: 0.45, wave: 'square', from: f, gain: 0.18, decay: 0.1 });
    });
    return finish(lowpass(out, 6000), 0.5);
  },
  over() {
    const out = buffer(0.75);
    tone(out, { len: 0.75, wave: 'square', from: 330, to: 70, attack: 0.01, decay: 0.3 });
    tone(out, { len: 0.75, wave: 'saw', from: 165, to: 35, gain: 0.5, attack: 0.01, decay: 0.3 });
    return finish(lowpass(out, 1800), 0.5);
  },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(SOUNDS)) writeFileSync(join(OUT, `${name}.wav`), wav(make()));
