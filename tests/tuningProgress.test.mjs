// Testes do progresso "X de 6 cordas afinadas". Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createTuningProgress,
  CONFIRM_MS,
  LOSE_CENTS,
  LOSE_MS,
} from "../src/utils/tuningProgress.ts";

const afinada = (index) => ({ index, inTune: true, cents: 1, hasSignal: true });
const fora = (index, cents = 20) => ({
  index,
  inTune: false,
  cents,
  hasSignal: true,
});
const silencio = { index: null, inTune: false, cents: 0, hasSignal: false };

// Mantem a corda afinada pelo tempo de confirmacao; devolve o ultimo evento
function segura(p, index, start) {
  let ev;
  for (let t = start; t <= start + CONFIRM_MS; t += 50)
    ev = p.update(afinada(index), t);
  return ev;
}

test("corda so conta depois de ficar afinada por CONFIRM_MS", () => {
  const p = createTuningProgress(6);
  assert.equal(p.update(afinada(0), 0).stringTuned, null);
  assert.equal(p.update(afinada(0), CONFIRM_MS - 1).stringTuned, null);
  const ev = p.update(afinada(0), CONFIRM_MS);
  assert.equal(ev.stringTuned, 0);
  assert.equal(ev.changed, true);
  assert.equal(p.count(), 1);
});

test("passar pelo centro girando a tarraxa nao conta", () => {
  const p = createTuningProgress(6);
  p.update(afinada(2), 0);
  p.update(fora(2, 8), 100); // saiu antes do tempo
  p.update(afinada(2), 200);
  assert.equal(p.update(afinada(2), 200 + CONFIRM_MS - 1).stringTuned, null);
  assert.equal(p.count(), 0);
});

test("silencio zera a contagem do tempo afinado", () => {
  const p = createTuningProgress(6);
  p.update(afinada(1), 0);
  p.update(silencio, 200);
  assert.equal(p.update(afinada(1), CONFIRM_MS).stringTuned, null);
});

test("avisa uma vez por corda e uma vez ao completar as 6", () => {
  const p = createTuningProgress(6);
  let t = 0;
  const avisos = [];
  for (let i = 0; i < 6; i++) {
    const ev = segura(p, i, t);
    avisos.push(ev.stringTuned);
    assert.equal(ev.allTuned, i === 5, `corda ${i}`);
    t += 1000;
    p.update(silencio, t);
  }
  assert.deepEqual(avisos, [0, 1, 2, 3, 4, 5]);
  assert.equal(p.isComplete(), true);
  // tocar de novo uma corda afinada nao repete o aviso
  const ev = segura(p, 3, t + 1000);
  assert.equal(ev.stringTuned, null);
  assert.equal(ev.allTuned, false);
});

test("corda perde a marca se ficar desafinada por LOSE_MS", () => {
  const p = createTuningProgress(6);
  segura(p, 4, 0);
  assert.equal(p.tuned().has(4), true);
  p.update(fora(4, LOSE_CENTS + 5), 1000);
  assert.equal(
    p.update(fora(4, LOSE_CENTS + 5), 1000 + LOSE_MS - 1).changed,
    false,
  );
  const ev = p.update(fora(4, LOSE_CENTS + 5), 1000 + LOSE_MS);
  assert.equal(ev.changed, true);
  assert.equal(p.tuned().has(4), false);
});

test("desvio pequeno (ate LOSE_CENTS) nao tira a marca", () => {
  const p = createTuningProgress(6);
  segura(p, 0, 0);
  for (let t = 1000; t < 1000 + 3 * LOSE_MS; t += 50)
    p.update(fora(0, LOSE_CENTS - 1), t);
  assert.equal(p.tuned().has(0), true);
});

test("perder uma corda depois de completar permite avisar de novo", () => {
  const p = createTuningProgress(2);
  segura(p, 0, 0);
  assert.equal(segura(p, 1, 1000).allTuned, true);
  p.update(fora(1), 2000);
  p.update(fora(1), 2000 + LOSE_MS);
  assert.equal(p.isComplete(), false);
  assert.equal(segura(p, 1, 4000).allTuned, true);
});

test("reset limpa tudo", () => {
  const p = createTuningProgress(6);
  segura(p, 0, 0);
  p.reset();
  assert.equal(p.count(), 0);
  assert.equal(p.isComplete(), false);
});
