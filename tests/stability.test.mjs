// Testes da estabilidade do modo microfone (sem Android): confirmacao de
// nota nova, pulo de oitava, dobra de oitava e tempo de espera.
// Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createStabilizer,
  isMicReadingRejected,
  micMinClarity,
  CONFIRM_FRAMES,
  OCTAVE_CONFIRM_FRAMES,
  HOLD_MS,
  HOLD_SOUND_MS,
  MIC_MAX_FREQ,
} from "../src/audio/stability.ts";

const STANDARD = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
const A2 = 110.0;
const D3 = 146.83;
const FRAME_MS = 23; // ~1024 amostras a 44,1 kHz

// Empurra a mesma frequencia n vezes e devolve os passos
function pushN(st, freq, n, start = 0, strings = STANDARD) {
  const steps = [];
  for (let i = 0; i < n; i++)
    steps.push(st.push(freq, start + i * FRAME_MS, strings));
  return steps;
}

// Confirma uma nota (segura CONFIRM_FRAMES - 1 leituras, aceita a seguinte)
function settle(st, freq, start = 0, strings = STANDARD) {
  const steps = pushN(st, freq, CONFIRM_FRAMES, start, strings);
  assert.equal(steps.at(-1).kind, "accept");
  return start + CONFIRM_FRAMES * FRAME_MS;
}

test("nota nova so aparece depois de se repetir", () => {
  const st = createStabilizer();
  const steps = pushN(st, A2, CONFIRM_FRAMES);
  for (const s of steps.slice(0, -1)) assert.equal(s.kind, "hold");
  assert.deepEqual(steps[0], { kind: "hold", count: 1, need: CONFIRM_FRAMES });
  assert.deepEqual(steps.at(-1), { kind: "accept", frequency: A2 });
  assert.equal(st.stableFrequency(), A2);
});

test("leitura isolada de ruido nao troca a nota estavel", () => {
  const st = createStabilizer();
  let t = settle(st, A2);
  assert.equal(st.push(523.25, t, STANDARD).kind, "hold"); // pico isolado
  t += FRAME_MS;
  // volta a nota certa: aceita direto, sem confirmar de novo
  assert.deepEqual(st.push(A2 * 1.002, t, STANDARD), {
    kind: "accept",
    frequency: A2 * 1.002,
  });
  assert.equal(st.stableFrequency(), A2 * 1.002);
});

test("variacao de afinacao dentro de 50 cents segue a mesma nota", () => {
  const st = createStabilizer();
  let t = settle(st, A2);
  const sharp = A2 * Math.pow(2, 30 / 1200); // +30 cents
  assert.deepEqual(st.push(sharp, t, STANDARD), {
    kind: "accept",
    frequency: sharp,
  });
});

test("candidatas diferentes reiniciam a contagem", () => {
  const st = createStabilizer();
  assert.equal(st.push(A2, 0, STANDARD).kind, "hold");
  assert.deepEqual(st.push(D3, FRAME_MS, STANDARD), {
    kind: "hold",
    count: 1,
    need: CONFIRM_FRAMES,
  });
  assert.equal(st.push(D3, 2 * FRAME_MS, STANDARD).kind, "accept");
  assert.equal(st.stableFrequency(), D3);
});

test("troca de corda: nota nova confirma com CONFIRM_FRAMES leituras", () => {
  const st = createStabilizer();
  const t = settle(st, A2);
  const steps = pushN(st, D3, CONFIRM_FRAMES, t);
  assert.equal(steps.at(-1).kind, "accept");
  assert.equal(st.stableFrequency(), D3);
});

test("pulo de oitava para baixo exige mais confirmacao", () => {
  const st = createStabilizer();
  const t = settle(st, 220.0); // A3, nao e corda: sem dobra de oitava
  const steps = pushN(st, A2, OCTAVE_CONFIRM_FRAMES, t);
  for (const s of steps.slice(0, -1)) {
    assert.equal(s.kind, "hold");
    assert.equal(s.need, OCTAVE_CONFIRM_FRAMES);
  }
  assert.deepEqual(steps.at(-1), { kind: "accept", frequency: A2 });
});

test("dobra de oitava: harmonico 2x numa corda vira a mesma nota", () => {
  const st = createStabilizer();
  const t = settle(st, A2);
  // fim da corda: o 2o harmonico domina e o detector le 220 Hz
  assert.deepEqual(st.push(2 * A2, t, STANDARD), {
    kind: "accept",
    frequency: A2,
  });
  assert.equal(st.stableFrequency(), A2);
});

test("sem dobra quando a nota estavel nao e corda da afinacao", () => {
  const st = createStabilizer();
  const C3 = 130.81;
  const t = settle(st, C3);
  const step = st.push(2 * C3, t, STANDARD);
  assert.equal(step.kind, "hold");
  assert.equal(step.need, OCTAVE_CONFIRM_FRAMES);
});

test("sem afinacao informada a dobra vale para qualquer nota", () => {
  const st = createStabilizer();
  const C3 = 130.81;
  const t = settle(st, C3, 0, []);
  assert.deepEqual(st.push(2 * C3, t, []), { kind: "accept", frequency: C3 });
});

test("release segura a nota pelo tempo de espera e depois limpa", () => {
  const st = createStabilizer();
  const t = settle(st, A2);
  const lastAccept = t - FRAME_MS;
  assert.equal(st.release(lastAccept + HOLD_MS - 1, HOLD_MS), false);
  assert.equal(st.stableFrequency(), A2);
  assert.equal(st.release(lastAccept + HOLD_MS, HOLD_MS), true);
  assert.equal(st.stableFrequency(), 0);
});

test("com som sujo a espera e maior (HOLD_SOUND_MS)", () => {
  const st = createStabilizer();
  const t = settle(st, A2);
  const lastAccept = t - FRAME_MS;
  assert.ok(HOLD_SOUND_MS > HOLD_MS);
  assert.equal(st.release(lastAccept + HOLD_MS, HOLD_SOUND_MS), false);
  assert.equal(st.release(lastAccept + HOLD_SOUND_MS, HOLD_SOUND_MS), true);
});

test("depois de limpar, a mesma nota precisa ser confirmada de novo", () => {
  const st = createStabilizer();
  let t = settle(st, A2);
  t += HOLD_MS;
  assert.equal(st.release(t, HOLD_MS), true);
  assert.equal(st.push(A2, t, STANDARD).kind, "hold");
  assert.equal(st.push(A2, t + FRAME_MS, STANDARD).kind, "accept");
});

test("candidata pendente e descartada ao limpar", () => {
  const st = createStabilizer();
  assert.equal(st.push(A2, 0, STANDARD).kind, "hold");
  assert.equal(st.release(HOLD_MS, HOLD_MS), true);
  // a contagem recomeca do zero
  assert.deepEqual(st.push(A2, HOLD_MS + FRAME_MS, STANDARD), {
    kind: "hold",
    count: 1,
    need: CONFIRM_FRAMES,
  });
});

test("clareza minima pela sensibilidade (Alta, Media, Baixa)", () => {
  assert.equal(micMinClarity(0.9), 0.65);
  assert.equal(micMinClarity(0.85), 0.65);
  assert.equal(micMinClarity(0.7), 0.75);
  assert.equal(micMinClarity(0.55), 0.75);
  assert.equal(micMinClarity(0.3), 0.85);
});

test("leitura do mic: descarta pouco periodica ou aguda demais", () => {
  assert.equal(isMicReadingRejected(A2, 0.9, 0.7), false);
  assert.equal(isMicReadingRejected(A2, 0.7, 0.7), true); // Media exige 0.75
  assert.equal(isMicReadingRejected(A2, 0.7, 0.9), false); // Alta aceita 0.65
  assert.equal(isMicReadingRejected(659.26, 0.95, 0.7), false); // Mi agudo na 12a casa
  assert.equal(isMicReadingRejected(MIC_MAX_FREQ + 1, 0.95, 0.7), true);
});
