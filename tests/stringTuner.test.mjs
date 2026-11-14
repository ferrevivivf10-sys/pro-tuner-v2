// Testes do afinador por corda (sem React): escolha da corda alvo, media dos
// cents, acao mostrada e nomes falados. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  centsBetween,
  confidenceThreshold,
  createCentsSmoother,
  parseStringLabel,
  pickTargetString,
  spokenStringName,
  stringFreq,
  tuneAction,
  isInTune,
  median,
  TUNING_STRING_NAMES,
  STRING_GUARD_CENTS,
  CENTS_SMOOTH_SIZE,
} from "../src/utils/stringTuner.ts";

const freqs = (tuning, a4 = 440) =>
  TUNING_STRING_NAMES[tuning].map((n) => stringFreq(n, a4));
const STD = freqs("Standard");
const near = (a, b, tol = 0.01) =>
  assert.ok(Math.abs(a - b) < tol, `${a} != ${b}`);

test("frequencias das cordas da afinacao padrao (A4 = 440)", () => {
  [82.41, 110.0, 146.83, 196.0, 246.94, 329.63].forEach((f, i) =>
    near(STD[i], f),
  );
});

test("calibracao muda o alvo: A2 com A4 = 432 Hz", () => {
  near(stringFreq("A2", 432), 108.0);
  assert.equal(stringFreq("X9", 440), 0); // nota desconhecida
});

test("todas as afinacoes tem 6 cordas conhecidas, da grave para a aguda", () => {
  for (const [name, notes] of Object.entries(TUNING_STRING_NAMES)) {
    const f = freqs(name);
    assert.equal(f.length, 6, name);
    f.forEach((x, i) => {
      assert.ok(x > 0, `${name}: ${notes[i]}`);
      if (i > 0) assert.ok(x > f[i - 1], `${name} fora de ordem`);
    });
  }
});

test("corda alvo: a mais proxima de cada corda solta", () => {
  STD.forEach((f, i) => assert.equal(pickTargetString(f * 1.01, STD, null), i));
});

test("corda alvo: desafinada ate quase meio caminho ainda e a mesma corda", () => {
  // Mi grave 40 cents abaixo continua sendo o Mi grave
  assert.equal(pickTargetString(82.41 * Math.pow(2, -40 / 1200), STD, null), 0);
  // Drop D: o Re grave e a corda 0
  assert.equal(pickTargetString(73.42, freqs("DropD"), null), 0);
});

test("corda alvo: longe de todas (alem da tolerancia) nao escolhe nenhuma", () => {
  const far = 82.41 * Math.pow(2, -(STRING_GUARD_CENTS + 50) / 1200);
  assert.equal(pickTargetString(far, STD, null), null);
  assert.equal(pickTargetString(1000, STD, null), null);
});

test("corda travada ganha mesmo com outra nota mais proxima", () => {
  assert.equal(pickTargetString(110, STD, 0), 0);
  assert.equal(pickTargetString(2000, STD, 5), 5);
});

test("frequencia zerada na lista e ignorada", () => {
  assert.equal(pickTargetString(110, [0, 110, 0], null), 1);
});

test("media dos cents: suaviza e esquece leituras antigas", () => {
  const sm = createCentsSmoother(3);
  assert.equal(sm.push(10), 10);
  assert.equal(sm.push(20), 15);
  assert.equal(sm.push(30), 20);
  assert.equal(sm.push(40), 30); // o 10 saiu
  sm.reset();
  assert.equal(sm.push(-6), -6);
});

test("mediana dos cents usa CENTS_SMOOTH_SIZE leituras por padrao", () => {
  const sm = createCentsSmoother();
  for (let i = 0; i < CENTS_SMOOTH_SIZE; i++) sm.push(0);
  assert.equal(sm.push(50), 0); // uma leitura torta nao move a mediana
});

test("mediana ignora leituras tortas do fim da nota (caso real)", () => {
  // La 2 do teste de 14/11: fim da nota com leitura de -52 cents
  const sm = createCentsSmoother();
  [-2, -1, 0, -2, -52].forEach((c) => sm.push(c));
  assert.equal(sm.push(-1), -1);
  assert.equal(median([3, 1, 2, 10]), 2.5);
});

test("afinado com folga: entra abaixo de 5, so sai acima de 7", () => {
  assert.equal(isInTune(4.9, false), true);
  assert.equal(isInTune(5, false), false);
  assert.equal(isInTune(6, false), false); // nao entra com 6
  assert.equal(isInTune(6, true), true); // mas continua afinado com 6
  assert.equal(isInTune(-6.9, true), true);
  assert.equal(isInTune(7, true), false);
  assert.equal(tuneAction(6, true), "AFINADO");
  assert.equal(tuneAction(6, false), "AFROUXAR");
  assert.equal(tuneAction(-8, true), "APERTAR");
});

test("folga reduz o pisca-pisca do afinado em volta de 5 cents", () => {
  const leituras = [4, 5.5, 4.5, 6, 4.8, 5.2, 4.9, 6.5, 4.2];
  const conta = (folga) => {
    let estado = false,
      trocas = 0;
    for (const c of leituras) {
      const novo = folga ? isInTune(c, estado) : isInTune(c, false);
      if (novo !== estado) trocas++;
      estado = novo;
    }
    return trocas;
  };
  assert.ok(conta(true) < conta(false));
  assert.equal(conta(true), 1); // so a entrada
});

test("acao: afinado, afrouxar (agudo) e apertar (grave)", () => {
  assert.equal(tuneAction(0), "AFINADO");
  assert.equal(tuneAction(4.9), "AFINADO");
  assert.equal(tuneAction(-4.9), "AFINADO");
  assert.equal(tuneAction(5), "AFROUXAR");
  assert.equal(tuneAction(-5), "APERTAR");
  assert.equal(tuneAction(centsBetween(115, 110)), "AFROUXAR");
});

test("limiar de clareza pela sensibilidade, limitado entre 0 e 1", () => {
  near(confidenceThreshold(0), 0.85);
  near(confidenceThreshold(1), 0.35);
  near(confidenceThreshold(2), 0.35);
  near(confidenceThreshold(-1), 0.85);
  assert.ok(confidenceThreshold(0.9) < confidenceThreshold(0.3));
});

test("rotulos e nomes falados das cordas", () => {
  assert.deepEqual(parseStringLabel("Eb2"), { note: "Eb", octave: 2 });
  assert.deepEqual(parseStringLabel("?"), { note: "?", octave: 0 });
  assert.equal(spokenStringName("E2"), "Mi 2");
  assert.equal(spokenStringName("A2"), "Lá 2");
  assert.equal(spokenStringName("Eb4"), "Mi bemol 4");
  assert.equal(spokenStringName("Gb3"), "Sol bemol 3");
  assert.equal(spokenStringName("C3"), "Dó 3");
});
