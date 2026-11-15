// Testes do monitor da taxa de entrega de amostras. Rodar: npm test
// Os tempos sao simulados aqui de proposito: o teste confere a CONTA do monitor.
// A validacao real (limite de 2%) e feita no aparelho, pelo CSV do modo de teste.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRateMonitor, EXPECTED_RATE } from "../src/audio/rateMonitor.ts";

// Gerador deterministico (mesma sequencia em toda execucao)
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// Entrega `rate` amostras/s em blocos de `blockMs`, por `seconds`.
// jitterMs: atraso aleatorio de chegada de cada bloco (0..jitterMs).
function feed(m, { rate, seconds, blockMs = 100, jitterMs = 0, start = 0, seed = 1 }) {
  const r = rng(seed);
  let report;
  let sent = 0;
  for (let t = blockMs; t <= seconds * 1000; t += blockMs) {
    const due = Math.round((rate * t) / 1000) - sent; // amostras geradas ate t
    sent += due;
    report = m.push(due, start + t + r() * jitterMs);
  }
  return report;
}

const pct = (rate) => (100 * (rate / EXPECTED_RATE - 1)).toFixed(2) + "%";

test("44.100 amostras/s: dentro da referencia", () => {
  const r = feed(createRateMonitor(), { rate: 44100, seconds: 5 });
  assert.equal(r.status, "ok");
  assert.ok(Math.abs(r.rate - 44100) < 44100 * 0.002, pct(r.rate));
});

// O alerta exige 3 s de dados + 2 s seguidos fora do limite: ~5 s no minimo
test("43.000 amostras/s: alerta", () => {
  const r = feed(createRateMonitor(), { rate: 43000, seconds: 8 });
  assert.equal(r.status, "fora", pct(r.rate));
});

test("45.000 amostras/s: alerta", () => {
  const r = feed(createRateMonitor(), { rate: 45000, seconds: 8 });
  assert.equal(r.status, "fora", pct(r.rate));
});

test("intervalos irregulares e atraso de chegada: media correta", () => {
  const m = createRateMonitor();
  const r = rng(7);
  let t = 0;
  let sent = 0;
  let report;
  while (t < 6000) {
    t += 30 + r() * 220; // blocos de 30 a 250 ms
    const due = Math.round((44100 * t) / 1000) - sent;
    sent += due;
    report = m.push(due, t + r() * 60); // chega ate 60 ms atrasado
  }
  assert.equal(report.status, "ok", pct(report.rate));
  assert.ok(Math.abs(report.rate / 44100 - 1) < 0.01, pct(report.rate));
});

test("rajada (blocos atrasados chegando juntos): media correta", () => {
  const m = createRateMonitor();
  let report;
  for (let i = 1; i <= 50; i++) {
    // a cada 10 blocos, 3 chegam juntos no mesmo instante
    const t = i * 100;
    const arrival = i % 10 >= 7 && i % 10 <= 9 ? Math.ceil(i / 10) * 1000 : t;
    report = m.push(4410, arrival);
  }
  assert.equal(report.status, "ok", pct(report.rate));
});

test("desvio passageiro (menos de 2 s fora do limite) nao gera alerta", () => {
  const m = createRateMonitor();
  feed(m, { rate: 44100, seconds: 5 });
  // 1 s de entrega lenta (40.000/s) e volta ao normal
  const slow = feed(m, { rate: 40000, seconds: 1, start: 5000 });
  assert.notEqual(slow.status, "fora");
  const back = feed(m, { rate: 44100, seconds: 5, start: 6000, seed: 3 });
  assert.equal(back.status, "ok", pct(back.rate));
});

test("antes de 3 s de dados: ainda medindo, sem taxa", () => {
  const r = feed(createRateMonitor(), { rate: 44100, seconds: 2.5 });
  assert.equal(r.status, "medindo");
  assert.equal(r.rate, null);
});

test("interrupcao na captura: detectada e medicao recomeca ao voltar", () => {
  const m = createRateMonitor();
  feed(m, { rate: 44100, seconds: 5 });
  assert.equal(m.check(5000 + 500).status, "ok"); // pausa curta: normal
  assert.equal(m.check(5000 + 1500).status, "parado");

  // volta a chegar audio: recomeca do zero (nao mistura com antes da pausa)
  const back = feed(m, { rate: 44100, seconds: 1, start: 6500 });
  assert.equal(back.status, "medindo");
  const later = feed(m, { rate: 44100, seconds: 5, start: 7500 });
  assert.equal(later.status, "ok", pct(later.rate));
});

test("buffer vazio nao conta como audio recebido", () => {
  const m = createRateMonitor();
  // blocos de audio intercalados com blocos vazios: taxa nao muda
  let report;
  for (let i = 1; i <= 50; i++) {
    report = m.push(4410, i * 100);
    m.push(0, i * 100 + 50);
  }
  assert.equal(report.status, "ok", pct(report.rate));

  // so blocos vazios depois: vira captura parada
  for (let t = 5100; t <= 6600; t += 100) report = m.push(0, t);
  assert.equal(report.status, "parado");
});

test("reset volta ao estado inicial", () => {
  const m = createRateMonitor();
  feed(m, { rate: 44100, seconds: 5 });
  m.reset();
  assert.equal(m.check(99999).status, "medindo");
});
