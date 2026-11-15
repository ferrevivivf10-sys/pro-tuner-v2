/**
 * Monitor da taxa de ENTREGA de amostras (logica pura, testavel com `npm test`).
 *
 * Mede quantas amostras o app recebe por segundo de relogio. Detecta atraso,
 * perda ou interrupcao do fluxo entregue ao app. NAO mede a frequencia fisica
 * do conversor do aparelho: o Android pode reamostrar antes de entregar.
 *
 * Calculo: inclinacao (minimos quadrados) do total acumulado de amostras em
 * funcao do tempo de chegada, numa janela de alguns segundos. Usa todos os
 * blocos da janela, entao chegadas irregulares nao distorcem a media.
 */

export const EXPECTED_RATE = 44100;   // taxa pedida a biblioteca (Hz)
export const RATE_TOLERANCE = 0.02;   // 2%: valor inicial, validar em aparelho
export const RATE_WINDOW_MS = 4000;   // janela de medicao
export const RATE_MIN_SPAN_MS = 3000; // tempo minimo de dados para dar resultado
export const STALL_MS = 1000;         // sem amostras por mais que isso = captura parada
export const RATE_PERSIST_MS = 2000;  // alerta so se ficar fora do limite por esse tempo seguido

export type RateStatus = "medindo" | "ok" | "fora" | "parado";

export interface RateReport {
  status: RateStatus;
  rate: number | null; // amostras/s medidas (null enquanto mede ou parado)
  spanMs: number;      // tempo coberto pela medicao
}

export interface RateMonitor {
  push(sampleCount: number, nowMs: number): RateReport;
  check(nowMs: number): RateReport;
  reset(): void;
}

const MEASURING: RateReport = { status: "medindo", rate: null, spanMs: 0 };

export function createRateMonitor(): RateMonitor {
  let points: { t: number; total: number }[] = [];
  let total = 0;
  let lastT: number | null = null;
  let last: RateReport = MEASURING;
  let outSince: number | null = null; // desde quando a taxa esta fora do limite

  const evaluate = (): RateReport => {
    if (points.length < 3) return MEASURING;
    const spanMs = points[points.length - 1].t - points[0].t;
    if (spanMs < RATE_MIN_SPAN_MS) return { status: "medindo", rate: null, spanMs };

    // Inclinacao de total x tempo (amostras por ms)
    const n = points.length;
    let mt = 0;
    let ms = 0;
    for (const p of points) {
      mt += p.t;
      ms += p.total;
    }
    mt /= n;
    ms /= n;
    let num = 0;
    let den = 0;
    for (const p of points) {
      num += (p.t - mt) * (p.total - ms);
      den += (p.t - mt) * (p.t - mt);
    }
    if (den <= 0) return { status: "medindo", rate: null, spanMs };

    const rate = (num / den) * 1000;
    const now = points[n - 1].t;
    if (Math.abs(rate / EXPECTED_RATE - 1) <= RATE_TOLERANCE) {
      outSince = null;
      return { status: "ok", rate, spanMs };
    }
    // Fora do limite: so vira alerta se persistir (atraso passageiro nao conta)
    if (outSince === null) outSince = now;
    const status = now - outSince >= RATE_PERSIST_MS ? "fora" : "ok";
    return { status, rate, spanMs };
  };

  return {
    push(sampleCount, nowMs) {
      // Buffer vazio nao conta como audio recebido
      if (!(sampleCount > 0)) return this.check(nowMs);

      // Depois de uma interrupcao, recomeca a medicao do zero
      if (lastT !== null && nowMs - lastT > STALL_MS) {
        points = [];
        total = 0;
        outSince = null;
      }

      total += sampleCount;
      lastT = nowMs;
      points.push({ t: nowMs, total });
      while (points.length > 0 && nowMs - points[0].t > RATE_WINDOW_MS) points.shift();

      last = evaluate();
      return last;
    },

    check(nowMs) {
      if (lastT !== null && nowMs - lastT > STALL_MS) {
        return { status: "parado", rate: null, spanMs: 0 };
      }
      return last;
    },

    reset() {
      points = [];
      total = 0;
      lastT = null;
      last = MEASURING;
      outSince = null;
    },
  };
}
