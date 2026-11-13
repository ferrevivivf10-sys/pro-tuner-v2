// Testes da logica do modo cabo (sem Android): deteccao de cabo e releitura
// periodica das entradas. Rodar: npm test
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { hasCable, createDevicePoller } from "../src/audio/cableMode.ts";

const MIC = { type: "builtin_mic", isAvailable: true };
const USB = { type: "usb", isAvailable: true };
const HEADSET = { type: "wired_headset", isAvailable: true };

const INTERVAL = 2500;
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("hasCable: so microfone ou lista vazia nao e cabo", () => {
  assert.equal(hasCable([]), false);
  assert.equal(hasCable([MIC]), false);
});

test("hasCable: USB e fone com fio disponiveis sao cabo", () => {
  assert.equal(hasCable([MIC, USB]), true);
  assert.equal(hasCable([MIC, HEADSET]), true);
});

test("hasCable: entrada USB indisponivel nao conta", () => {
  assert.equal(hasCable([MIC, { ...USB, isAvailable: false }]), false);
});

test("plugar e desplugar com o app aberto muda o modo na releitura seguinte", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    let sistema = [MIC]; // o que o Android informaria
    let devices = []; // o que o app conhece
    const poller = createDevicePoller(async () => {
      devices = sistema;
    }, INTERVAL);
    poller.start();

    mock.timers.tick(INTERVAL);
    await flush();
    assert.equal(hasCable(devices), false);

    sistema = [MIC, USB]; // cabo plugado
    mock.timers.tick(INTERVAL);
    await flush();
    assert.equal(hasCable(devices), true);

    sistema = [MIC]; // cabo removido
    mock.timers.tick(INTERVAL);
    await flush();
    assert.equal(hasCable(devices), false);

    poller.stop();
  } finally {
    mock.timers.reset();
  }
});

test("nao rele antes do intervalo", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    let chamadas = 0;
    const poller = createDevicePoller(async () => {
      chamadas++;
    }, INTERVAL);
    poller.start();
    mock.timers.tick(INTERVAL - 1);
    await flush();
    assert.equal(chamadas, 0);
    mock.timers.tick(1);
    await flush();
    assert.equal(chamadas, 1);
    poller.stop();
  } finally {
    mock.timers.reset();
  }
});

test("nao sobrepoe leituras: espera a anterior terminar", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    let chamadas = 0;
    let terminar;
    const poller = createDevicePoller(() => {
      chamadas++;
      return new Promise((resolve) => {
        terminar = resolve;
      });
    }, INTERVAL);
    poller.start();

    mock.timers.tick(INTERVAL * 3); // 3 ciclos com a primeira leitura pendente
    await flush();
    assert.equal(chamadas, 1);

    terminar();
    await flush();
    mock.timers.tick(INTERVAL);
    await flush();
    assert.equal(chamadas, 2);
    poller.stop();
  } finally {
    mock.timers.reset();
  }
});

test("leitura que falha (rejeita ou lanca) nao para a releitura", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    let chamadas = 0;
    const poller = createDevicePoller(() => {
      chamadas++;
      if (chamadas === 1) return Promise.reject(new Error("falhou"));
      if (chamadas === 2) throw new Error("lancou");
      return Promise.resolve();
    }, INTERVAL);
    poller.start();

    for (let i = 0; i < 3; i++) {
      mock.timers.tick(INTERVAL);
      await flush();
    }
    assert.equal(chamadas, 3);
    poller.stop();
  } finally {
    mock.timers.reset();
  }
});

test("stop encerra a releitura e start duplo nao cria dois relogios", async () => {
  mock.timers.enable({ apis: ["setInterval"] });
  try {
    let chamadas = 0;
    const poller = createDevicePoller(async () => {
      chamadas++;
    }, INTERVAL);
    poller.start();
    poller.start(); // segundo start e ignorado

    mock.timers.tick(INTERVAL);
    await flush();
    assert.equal(chamadas, 1);

    poller.stop();
    mock.timers.tick(INTERVAL * 4);
    await flush();
    assert.equal(chamadas, 1);

    poller.start(); // pode religar depois de parar
    mock.timers.tick(INTERVAL);
    await flush();
    assert.equal(chamadas, 2);
    poller.stop();
  } finally {
    mock.timers.reset();
  }
});
