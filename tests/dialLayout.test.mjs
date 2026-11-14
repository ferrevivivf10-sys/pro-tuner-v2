// Testes das medidas do mostrador por largura de tela. Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dialLayout,
  stringY,
  BASE_RING_R,
  BASE_RING_SIZE,
  DIAL_BAND_OUT,
  LABEL_ROOM,
  LOCK_HIT_HEIGHT,
  STRING_COUNT,
} from "../src/components/dialLayout.ts";

const WIDTHS = [280, 320, 340, 360, 393, 412, 480, 800];

test("tela larga: mostrador no tamanho original", () => {
  for (const w of [412, 480, 800]) {
    const l = dialLayout(w);
    assert.equal(l.scale, 1, `largura ${w}`);
    assert.equal(l.ringR, BASE_RING_R);
    assert.equal(l.ringSize, BASE_RING_SIZE);
  }
});

test("o desenho do aro (com brilho) sempre cabe na tela", () => {
  for (const w of WIDTHS) {
    const box = (dialLayout(w).ringR / DIAL_BAND_OUT) * 2;
    assert.ok(box <= w + 0.001, `largura ${w}: aro de ${box.toFixed(1)}`);
  }
});

test("o aro deixa espaco para os nomes das cordas", () => {
  for (const w of WIDTHS) {
    const { ringR } = dialLayout(w);
    assert.ok(w / 2 - ringR >= LABEL_ROOM - 0.001, `largura ${w}`);
  }
});

test("tela estreita encolhe tudo na mesma proporcao", () => {
  const l = dialLayout(320);
  assert.ok(l.scale < 1 && l.scale > 0.5);
  assert.equal(l.ringSize, BASE_RING_SIZE * l.scale);
  assert.equal(l.ringCy, l.ringSize / 2);
  assert.ok(l.noteRowWidth <= 320);
});

test("encolhe aos poucos: tela menor nunca tem mostrador maior", () => {
  let prev = 0;
  for (let w = 200; w <= 500; w += 5) {
    const { ringR } = dialLayout(w);
    assert.ok(ringR >= prev, `largura ${w}`);
    prev = ringR;
  }
});

test("cordas centradas, dentro do aro e na ordem", () => {
  for (const w of WIDTHS) {
    const l = dialLayout(w);
    const ys = Array.from({ length: STRING_COUNT }, (_, i) => stringY(l, i));
    const mid = (ys[0] + ys.at(-1)) / 2;
    assert.ok(Math.abs(mid - l.ringCy) < 0.001, `largura ${w}: centro`);
    assert.ok(ys[0] > l.ringCy - l.ringR && ys.at(-1) < l.ringCy + l.ringR);
    ys.forEach((y, i) => i && assert.ok(y > ys[i - 1]));
  }
});

test("areas de toque das cordas nao se sobrepoem", () => {
  for (const w of WIDTHS) {
    const l = dialLayout(w);
    assert.ok(l.hitHeight <= l.stringSpacing + 0.001, `largura ${w}`);
    assert.ok(l.hitHeight <= LOCK_HIT_HEIGHT);
  }
});

test("largura invalida nao quebra", () => {
  const l = dialLayout(-10);
  assert.equal(l.ringR, 0);
  assert.equal(l.screenWidth, 0);
});
