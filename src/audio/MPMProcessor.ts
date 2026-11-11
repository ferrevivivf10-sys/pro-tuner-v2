/**
 * MPMProcessor - McLeod Pitch Method para deteccao de pitch de instrumentos de corda
 * Usa a NSDF (Normalized Square Difference Function) e escolhe o PRIMEIRO pico
 * (menor lag) acima de um limiar relativo ao maior pico - isso evita o erro
 * classico de "cair" numa subharmonica (oitava abaixo), ponto fraco do YIN.
 * Retorna tambem a "clareza" (0-1): o quao periodico e o sinal, usada como
 * confidence real (nao um proxy de volume).
 *
 * PERFORMANCE: a NSDF e O(n^2). Rodar a faixa inteira de lags na taxa cheia
 * custava ~1.2M iteracoes por janela, o que saturava a thread JS (Hermes nao
 * tem JIT) e travava a UI. Por isso a busca e feita em DOIS ESTAGIOS:
 *   1. grosseiro: sinal decimado (44.1k -> 11k), varre todos os lags e escolhe
 *      o pico (e onde a decisao de oitava acontece);
 *   2. refino: NSDF na taxa CHEIA so numa janela estreita ao redor do lag
 *      escolhido + interpolacao parabolica, preservando a precisao em cents.
 * Custo total ~100k iteracoes: ~11x mais barato, mesma precisao.
 */
const MIN_FREQ = 60;    // abaixo do E2 (~82Hz) com margem
const MAX_FREQ = 1200;  // acima do E4 (~330Hz) e harmonicos
const CLARITY_THRESHOLD = 0.90; // fracao do maior pico exigida pra aceitar um pico menor (mais agudo). 0.90 medido em gravacoes reais (aco e nylon)
const LOOSE_THRESHOLD = 0.85;   // limiar frouxo do pico hibrido
const HYBRID_MIN_FREQ = 125;    // o hibrido so vale para notas a partir daqui (Hz)
const OCTAVE_CENTS = 50;        // tolerancia pra considerar "uma oitava"
const SUBHARMONIC_MARGIN = 0.05; // quanto a NSDF em 2T/3T precisa superar a de T
const MIN_CLARITY_ACCEPT = 0.3; // abaixo disso o sinal nao e periodico o suficiente, descarta
const TARGET_RMS = 0.15;        // nivel alvo apos normalizacao
const MIN_RMS = 0.0008;         // abaixo disso e silencio real, ignora
const DECIMATION = 4;           // 44.1kHz -> ~11kHz no estagio grosseiro
const REFINE_SPAN = DECIMATION * 2; // +/- amostras (taxa cheia) varridas no refino

export interface PitchResult {
  frequency: number;
  clarity: number;
}

const NO_PITCH: PitchResult = { frequency: 0, clarity: 0 };
const cents = (a: number, b: number) => 1200 * Math.log2(a / b);

export class MPMProcessor {
  private static normalize(signal: Float32Array): Float32Array | null {
    let sum = 0;
    for (let i = 0; i < signal.length; i++) {
      sum += signal[i] * signal[i];
    }
    const rms = Math.sqrt(sum / signal.length);
    if (rms < MIN_RMS) return null; // silencio, nao processa
    if (rms >= TARGET_RMS) return signal; // ja esta forte, nao mexe
    const gain = Math.min(TARGET_RMS / rms, 20); // limita ganho a 20x
    const out = new Float32Array(signal.length);
    for (let i = 0; i < signal.length; i++) {
      out[i] = signal[i] * gain;
    }
    return out;
  }

  // Decimacao com media movel de `factor` amostras (anti-aliasing simples).
  // A faixa de interesse (60-1200 Hz) fica muito abaixo do novo Nyquist
  // (~5.5 kHz), entao a media basta para o estagio grosseiro.
  private static decimate(signal: Float32Array, factor: number): Float32Array {
    const outLen = Math.floor(signal.length / factor);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const base = i * factor;
      let s = 0;
      for (let j = 0; j < factor; j++) s += signal[base + j];
      out[i] = s / factor;
    }
    return out;
  }

  // NSDF(tau) = 2 * autocorrelacao(tau) / energia(tau), varia de -1 a 1.
  // Quanto mais proximo de 1, mais periodico o sinal naquele lag.
  private static computeNSDF(
    signal: Float32Array,
    minLag: number,
    maxLag: number
  ): Float32Array {
    const nsdf = new Float32Array(maxLag + 1);
    for (let tau = minLag; tau <= maxLag; tau++) {
      let acf = 0;
      let energy = 0;
      const limit = signal.length - tau;
      for (let i = 0; i < limit; i++) {
        const a = signal[i];
        const b = signal[i + tau];
        acf += a * b;
        energy += a * a + b * b;
      }
      nsdf[tau] = energy > 0 ? (2 * acf) / energy : 0;
    }
    return nsdf;
  }

  // Interpolacao parabolica ao redor de um pico discreto, pra precisao sub-amostra.
  private static parabolicInterpolate(nsdf: Float32Array, x: number): number {
    if (x <= 0 || x >= nsdf.length - 1) return x;
    const y1 = nsdf[x - 1];
    const y2 = nsdf[x];
    const y3 = nsdf[x + 1];
    const a = (y1 - 2 * y2 + y3) / 2;
    const b = (y3 - y1) / 2;
    if (Math.abs(a) < 1e-10) return x;
    return x - b / (2 * a);
  }

  static detectPitch(rawSignal: Float32Array, sampleRate: number): PitchResult {
    const signal = this.normalize(rawSignal);
    if (!signal) return NO_PITCH; // silencio real

    // ===== Estagio 1: busca grosseira no sinal decimado =====
    const coarse = this.decimate(signal, DECIMATION);
    const coarseRate = sampleRate / DECIMATION;

    const cMinLag = Math.max(2, Math.floor(coarseRate / MAX_FREQ));
    const cMaxLag = Math.min(
      Math.floor(coarse.length / 2),
      Math.floor(coarseRate / MIN_FREQ)
    );
    if (cMaxLag <= cMinLag + 1) return NO_PITCH;

    const cNsdf = this.computeNSDF(coarse, cMinLag, cMaxLag);

    // Picos locais: pontos onde a NSDF sobe e depois desce.
    const peakLags: number[] = [];
    for (let i = cMinLag + 1; i < cMaxLag; i++) {
      if (cNsdf[i - 1] < cNsdf[i] && cNsdf[i] >= cNsdf[i + 1]) {
        peakLags.push(i);
      }
    }
    if (peakLags.length === 0) return NO_PITCH;

    let maxValue = -Infinity;
    for (const lag of peakLags) {
      if (cNsdf[lag] > maxValue) maxValue = cNsdf[lag];
    }
    if (maxValue < MIN_CLARITY_ACCEPT) return NO_PITCH; // nao periodico o suficiente

    // Escolhe o PRIMEIRO pico (menor lag = maior frequencia) que seja "bom o
    // suficiente" perto do maior pico - evita cair na subharmonica (oitava abaixo).
    const pick = (fraction: number): number => {
      const threshold = maxValue * fraction;
      for (const lag of peakLags) {
        if (cNsdf[lag] >= threshold) return lag;
      }
      return peakLags[0];
    };

    // ===== Estagio 2: refino em taxa cheia ao redor do lag escolhido =====
    let result = this.refine(signal, pick(CLARITY_THRESHOLD), sampleRate);
    if (result.frequency <= 0) return NO_PITCH;

    // Pico hibrido: se o limiar mais frouxo aponta exatamente uma oitava acima
    // de uma nota aguda, a leitura certa e a de cima (caso do Mi agudo).
    const looseLag = pick(LOOSE_THRESHOLD);
    if (result.frequency >= HYBRID_MIN_FREQ && looseLag !== pick(CLARITY_THRESHOLD)) {
      const loose = this.refine(signal, looseLag, sampleRate);
      if (loose.frequency > 0 && Math.abs(cents(loose.frequency, result.frequency) - 1200) < OCTAVE_CENTS) {
        result = loose;
      }
    }

    // Sub-harmonico: se o sinal se repete bem melhor em 2x ou 3x o periodo,
    // a nota real e f/2 ou f/3 (ataque das cordas graves, comum no nylon).
    const f = result.frequency;
    const base = this.nsdfAt(signal, sampleRate / f);
    let bestK = 0;
    let bestV = 0;
    for (const k of [2, 3]) {
      const lag = (k * sampleRate) / f;
      if (f / k < MIN_FREQ || lag > signal.length / 2) continue;
      const v = this.nsdfAt(signal, lag);
      if (v - base >= SUBHARMONIC_MARGIN && v > bestV) {
        bestK = k;
        bestV = v;
      }
    }
    if (bestK > 0) return { frequency: f / bestK, clarity: Math.min(1, bestV) };

    return result;
  }

  // NSDF num unico lag (arredondado), na taxa cheia.
  private static nsdfAt(signal: Float32Array, lag: number): number {
    const tau = Math.round(lag);
    let acf = 0;
    let energy = 0;
    for (let i = 0; i + tau < signal.length; i++) {
      const a = signal[i];
      const b = signal[i + tau];
      acf += a * b;
      energy += a * a + b * b;
    }
    return energy > 0 ? (2 * acf) / energy : 0;
  }

  // Refino: NSDF na taxa cheia numa janela estreita + interpolacao parabolica.
  private static refine(signal: Float32Array, coarseLag: number, sampleRate: number): PitchResult {
    const center = coarseLag * DECIMATION;
    const half = Math.floor(signal.length / 2);
    // +1 de folga de cada lado pra interpolacao ter vizinhos validos
    const fLo = Math.max(2, center - REFINE_SPAN - 1);
    const fHi = Math.min(half, center + REFINE_SPAN + 1);
    if (fHi <= fLo + 1) return NO_PITCH;

    const fNsdf = this.computeNSDF(signal, fLo, fHi);

    // Melhor lag no interior do intervalo (garante vizinhos calculados)
    let bestLag = -1;
    let bestVal = -Infinity;
    for (let tau = fLo + 1; tau <= fHi - 1; tau++) {
      if (fNsdf[tau] > bestVal) {
        bestVal = fNsdf[tau];
        bestLag = tau;
      }
    }
    if (bestLag < 0) return NO_PITCH;

    const refinedLag = this.parabolicInterpolate(fNsdf, bestLag);
    if (refinedLag <= 0) return NO_PITCH;

    return {
      frequency: sampleRate / refinedLag,
      clarity: Math.max(0, Math.min(1, bestVal)),
    };
  }
}
