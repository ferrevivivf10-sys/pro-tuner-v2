// Testes da estabilidade do modo microfone (sem Android): confirmacao de
// nota nova, pulo de oitava, dobra de oitava, tempo de espera e fim da nota.
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
  ATTACK_WINDOW_MS,
} from "../src/audio/stability.ts";

const STANDARD = [82.41, 110.0, 146.83, 196.0, 246.94, 329.63];
const A2 = 110.0;
const D3 = 146.83;
const FRAME_MS = 23; // ~1024 amostras a 44,1 kHz

// Estabilizador logo apos o ataque de uma corda (silencio -> som forte em t=0)
function attacked() {
  const st = createStabilizer();
  st.observe(0.3, 0);
  return st;
}

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
  const st = attacked();
  const steps = pushN(st, A2, CONFIRM_FRAMES);
  for (const s of steps.slice(0, -1)) assert.equal(s.kind, "hold");
  assert.deepEqual(steps[0], { kind: "hold", count: 1, need: CONFIRM_FRAMES });
  assert.deepEqual(steps.at(-1), { kind: "accept", frequency: A2 });
  assert.equal(st.stableFrequency(), A2);
});

test("leitura isolada de ruido nao troca a nota estavel", () => {
  const st = attacked();
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
  const st = attacked();
  let t = settle(st, A2);
  const sharp = A2 * Math.pow(2, 30 / 1200); // +30 cents
  assert.deepEqual(st.push(sharp, t, STANDARD), {
    kind: "accept",
    frequency: sharp,
  });
});

test("candidatas diferentes reiniciam a contagem", () => {
  const st = attacked();
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
  const st = attacked();
  const t = settle(st, A2);
  const steps = pushN(st, D3, CONFIRM_FRAMES, t);
  assert.equal(steps.at(-1).kind, "accept");
  assert.equal(st.stableFrequency(), D3);
});

test("pulo de oitava para baixo exige mais confirmacao", () => {
  const st = attacked();
  const t = settle(st, 220.0); // A3, nao e corda: sem dobra de oitava
  const steps = pushN(st, A2, OCTAVE_CONFIRM_FRAMES, t);
  for (const s of steps.slice(0, -1)) {
    assert.equal(s.kind, "hold");
    assert.equal(s.need, OCTAVE_CONFIRM_FRAMES);
  }
  assert.deepEqual(steps.at(-1), { kind: "accept", frequency: A2 });
});

test("dobra de oitava: harmonico 2x numa corda vira a mesma nota", () => {
  const st = attacked();
  const t = settle(st, A2);
  // fim da corda: o 2o harmonico domina e o detector le 220 Hz
  assert.deepEqual(st.push(2 * A2, t, STANDARD), {
    kind: "accept",
    frequency: A2,
  });
  assert.equal(st.stableFrequency(), A2);
});

test("sem dobra quando a nota estavel nao e corda da afinacao", () => {
  const st = attacked();
  const C3 = 130.81;
  const t = settle(st, C3);
  const step = st.push(2 * C3, t, STANDARD);
  assert.equal(step.kind, "hold");
  assert.equal(step.need, OCTAVE_CONFIRM_FRAMES);
});

test("sem afinacao informada a dobra vale para qualquer nota", () => {
  const st = attacked();
  const C3 = 130.81;
  const t = settle(st, C3, 0, []);
  assert.deepEqual(st.push(2 * C3, t, []), { kind: "accept", frequency: C3 });
});

test("release segura a nota pelo tempo de espera e depois limpa", () => {
  const st = attacked();
  const t = settle(st, A2);
  const lastAccept = t - FRAME_MS;
  assert.equal(st.release(lastAccept + HOLD_MS - 1, HOLD_MS), false);
  assert.equal(st.stableFrequency(), A2);
  assert.equal(st.release(lastAccept + HOLD_MS, HOLD_MS), true);
  assert.equal(st.stableFrequency(), 0);
});

test("com som sujo a espera e maior (HOLD_SOUND_MS)", () => {
  const st = attacked();
  const t = settle(st, A2);
  const lastAccept = t - FRAME_MS;
  assert.ok(HOLD_SOUND_MS > HOLD_MS);
  assert.equal(st.release(lastAccept + HOLD_MS, HOLD_SOUND_MS), false);
  assert.equal(st.release(lastAccept + HOLD_SOUND_MS, HOLD_SOUND_MS), true);
});

test("depois de limpar, a mesma nota precisa ser confirmada de novo", () => {
  const st = attacked();
  let t = settle(st, A2);
  t += HOLD_MS;
  assert.equal(st.release(t, HOLD_MS), true);
  assert.equal(st.push(A2, t, STANDARD).kind, "hold");
  assert.equal(st.push(A2, t + FRAME_MS, STANDARD).kind, "accept");
});

test("candidata pendente e descartada ao limpar", () => {
  const st = attacked();
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

// --- Fim da nota (testes com o celular em 14/11) ---

// Toca uma corda: silencio, ataque e queda de volume, uma leitura por frame
function pluck(st, freq, start, rmsList) {
  const steps = [];
  rmsList.forEach((rms, i) => {
    const t = start + i * FRAME_MS;
    st.observe(rms, t);
    steps.push(st.push(freq, t, STANDARD));
  });
  return steps;
}

test("fim da nota: sub-harmonico sem ataque nao troca a nota", () => {
  const st = createStabilizer();
  const E4 = 329.63;
  pluck(st, E4, 0, [0.002, 0.15, 0.12]);
  assert.equal(st.stableFrequency(), E4);
  // som caindo: o detector le f/3 (~110 Hz) varias vezes
  // queda de volume logo apos o ataque, depois a janela do ataque passa
  [0.08, 0.05, 0.03, 0.02].forEach((rms, i) =>
    st.observe(rms, (3 + i) * FRAME_MS),
  );
  let t = 10 * FRAME_MS + ATTACK_WINDOW_MS;
  for (const rms of [0.01, 0.008, 0.006, 0.005]) {
    st.observe(rms, t);
    assert.deepEqual(st.push(E4 / 3, t, STANDARD), { kind: "noAttack" });
    t += FRAME_MS;
  }
  assert.equal(st.stableFrequency(), E4);
  // a propria nota continua aceita
  assert.equal(st.push(E4, t, STANDARD).kind, "accept");
});

test("fim da nota: corda vibrando por simpatia nao aparece", () => {
  const st = createStabilizer();
  pluck(st, D3, 0, [0.002, 0.09, 0.08]);
  // queda de volume logo apos o ataque, depois a janela do ataque passa
  [0.05, 0.03, 0.02].forEach((rms, i) => st.observe(rms, (3 + i) * FRAME_MS));
  let t = 10 * FRAME_MS + ATTACK_WINDOW_MS;
  for (const rms of [0.0077, 0.0062, 0.0052]) {
    st.observe(rms, t);
    assert.equal(st.push(A2 * 1.02, t, STANDARD).kind, "noAttack");
    t += FRAME_MS;
  }
  assert.equal(st.stableFrequency(), D3);
});

test("ruido baixo sem nota anterior nao vira nota", () => {
  const st = createStabilizer();
  // inicio da gravacao: ruido de fundo com leitura periodica (~130 Hz)
  let t = 0;
  for (const rms of [0.002, 0.0025, 0.0077, 0.005, 0.0093, 0.0083]) {
    st.observe(rms, t);
    t += FRAME_MS;
  }
  assert.equal(st.push(130, t, STANDARD).kind, "noAttack");
  assert.equal(st.push(130, t + FRAME_MS, STANDARD).kind, "noAttack");
  assert.equal(st.stableFrequency(), 0);
});

test("troca de corda com ataque continua normal", () => {
  const st = createStabilizer();
  pluck(st, A2, 0, [0.002, 0.3, 0.25]);
  const t = 2000;
  // corda anterior ja fraca, nova corda tocada forte
  st.observe(0.004, t - 2 * FRAME_MS);
  st.observe(0.003, t - FRAME_MS);
  const steps = pluck(st, D3, t, [0.28, 0.27]);
  assert.equal(steps[0].kind, "hold");
  assert.equal(steps[1].kind, "accept");
  assert.equal(st.stableFrequency(), D3);
});

test("nota nova so ate ATTACK_WINDOW_MS depois do ataque", () => {
  const st = createStabilizer();
  st.observe(0.002, 0);
  st.observe(0.2, FRAME_MS); // ataque
  const late = FRAME_MS + ATTACK_WINDOW_MS + 1;
  assert.equal(st.push(A2, late, STANDARD).kind, "noAttack");
});

test("girando a tarraxa: nota deslizando nao exige ataque", () => {
  const st = createStabilizer();
  const G3 = 182.3; // corda ainda baixa
  pluck(st, G3, 0, [0.002, 0.3, 0.2]);
  // queda de volume logo apos o ataque, depois a janela do ataque passa
  [0.05, 0.02, 0.01].forEach((rms, i) => st.observe(rms, (3 + i) * FRAME_MS));
  let t = 10 * FRAME_MS + ATTACK_WINDOW_MS;
  // sobe 56 cents sem tocar de novo: confirma normalmente
  const up = 188.2;
  st.observe(0.007, t);
  assert.equal(st.push(up, t, STANDARD).kind, "hold");
  st.observe(0.007, t + FRAME_MS);
  assert.equal(st.push(up, t + FRAME_MS, STANDARD).kind, "accept");
  assert.equal(st.stableFrequency(), up);
});

test("ataque exige volume minimo, nao so salto", () => {
  const st = createStabilizer();
  // 0.001 -> 0.008: subiu 8x, mas ainda e volume de ruido
  st.observe(0.001, 0);
  st.observe(0.008, FRAME_MS);
  assert.equal(st.push(A2, FRAME_MS, STANDARD).kind, "noAttack");
});
