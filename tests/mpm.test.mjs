// Testes do detector MPM com sinais sinteticos de frequencia conhecida.
// Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { MPMProcessor } from "../src/audio/MPMProcessor.ts";

const SR = 44100;
const N = 2048;
const STANDARD = { E2: 82.41, A2: 110.0, D3: 146.83, G3: 196.0, B3: 246.94, E4: 329.63 };

// Soma de harmonicos: amps[0] = fundamental, amps[1] = 2o harmonico...
function tone(freq, amps = [1, 0.5, 0.3], level = 0.1) {
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let v = 0;
    amps.forEach((a, h) => { v += a * Math.sin(2 * Math.PI * freq * (h + 1) * i / SR); });
    x[i] = level * v;
  }
  return x;
}

function noise(level, seed = 1) {
  let s = seed;
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    x[i] = level * ((s / 4294967296) * 2 - 1);
  }
  return x;
}

const cents = (a, b) => 1200 * Math.log2(a / b);

test("detecta as 6 cordas da afinacao padrao com erro menor que 2 cents", () => {
  for (const [name, f] of Object.entries(STANDARD)) {
    const { frequency, clarity } = MPMProcessor.detectPitch(tone(f), SR);
    assert.ok(Math.abs(cents(frequency, f)) < 2, `${name}: ${frequency.toFixed(2)} Hz`);
    assert.ok(clarity > 0.9, `${name}: clareza ${clarity.toFixed(2)}`);
  }
});

test("mantem a oitava certa com fundamental fraca (mic de celular)", () => {
  for (const [name, f] of Object.entries(STANDARD)) {
    const { frequency } = MPMProcessor.detectPitch(tone(f, [0.3, 1, 0.6, 0.3]), SR);
    assert.ok(Math.abs(cents(frequency, f)) < 50, `${name}: ${frequency.toFixed(2)} Hz`);
  }
});

test("precisao fina no A4 em 440 e 432 Hz (calibracao)", () => {
  for (const f of [440, 432]) {
    const { frequency } = MPMProcessor.detectPitch(tone(f), SR);
    assert.ok(Math.abs(cents(frequency, f)) < 1, `${f}: ${frequency.toFixed(3)} Hz`);
  }
});

test("funciona com sinal fraco (normalizacao por RMS)", () => {
  const { frequency } = MPMProcessor.detectPitch(tone(110, [1, 0.5, 0.3], 0.003), SR);
  assert.ok(Math.abs(cents(frequency, 110)) < 2, `${frequency.toFixed(2)} Hz`);
});

test("silencio nao gera nota", () => {
  const { frequency } = MPMProcessor.detectPitch(new Float32Array(N), SR);
  assert.equal(frequency, 0);
});

test("ruido branco tem clareza baixa", () => {
  for (const seed of [1, 2, 3]) {
    const { frequency, clarity } = MPMProcessor.detectPitch(noise(0.05, seed), SR);
    assert.ok(frequency === 0 || clarity < 0.75, `seed ${seed}: clareza ${clarity.toFixed(2)}`);
  }
});

test("nota com ruido moderado continua correta", () => {
  const x = tone(146.83);
  const n = noise(0.02, 7);
  for (let i = 0; i < N; i++) x[i] += n[i];
  const { frequency } = MPMProcessor.detectPitch(x, SR);
  assert.ok(Math.abs(cents(frequency, 146.83)) < 5, `${frequency.toFixed(2)} Hz`);
});

// Trechos reais (2048 amostras) gravados pelo modo de teste do app.
import { readFileSync } from "node:fs";

function fixture(name) {
  const { pcm16 } = JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
  const buf = Buffer.from(pcm16, "base64");
  const x = new Float32Array(buf.length / 2);
  for (let i = 0; i < x.length; i++) x[i] = buf.readInt16LE(i * 2) / 32768;
  return x;
}

test("Mi agudo real nao cai uma oitava abaixo (pico hibrido)", () => {
  const { frequency } = MPMProcessor.detectPitch(fixture("mi-agudo-aco"), SR);
  assert.ok(Math.abs(cents(frequency, STANDARD.E4)) < 50, `${frequency.toFixed(2)} Hz`);
});

test("ataque real do La e do Mi grave no nylon nao sobe de oitava (sub-harmonico)", () => {
  const la = MPMProcessor.detectPitch(fixture("la-ataque-nylon"), SR).frequency;
  assert.ok(Math.abs(cents(la, STANDARD.A2)) < 50, `La: ${la.toFixed(2)} Hz`);
  const mi = MPMProcessor.detectPitch(fixture("mi-grave-ataque-nylon"), SR).frequency;
  assert.ok(Math.abs(cents(mi, STANDARD.E2)) < 50, `Mi grave: ${mi.toFixed(2)} Hz`);
});
