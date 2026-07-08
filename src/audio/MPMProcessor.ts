/**
 * MPMProcessor - McLeod Pitch Method para deteccao de pitch de guitarra
 * Substitui o YIN puro: usa a NSDF (Normalized Square Difference Function) e
 * escolhe o PRIMEIRO pico (menor lag) acima de um limiar relativo ao maior
 * pico encontrado - isso evita o erro classico de "cair" numa subharmonica
 * (oitava abaixo), que e o principal ponto fraco do YIN simples.
 * Retorna tambem a "clareza" (0-1): o quao periodico e o sinal, usada como
 * confidence real (nao um proxy de volume).
 */
const MIN_FREQ = 60;    // abaixo do E2 (~82Hz) com margem
const MAX_FREQ = 1200;  // acima do E4 (~330Hz) e harmonicos
const CLARITY_THRESHOLD = 0.85; // fracao do maior pico exigida pra aceitar um pico menor (mais agudo)
const MIN_CLARITY_ACCEPT = 0.3; // abaixo disso o sinal nao e periodico o suficiente, descarta
const TARGET_RMS = 0.15;        // nivel alvo apos normalizacao
const MIN_RMS = 0.0008;         // abaixo disso e silencio real, ignora

export interface PitchResult {
  frequency: number;
  clarity: number;
}

const NO_PITCH: PitchResult = { frequency: 0, clarity: 0 };

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

    const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
    const maxLag = Math.min(
      Math.floor(signal.length / 2),
      Math.floor(sampleRate / MIN_FREQ)
    );
    if (maxLag <= minLag + 1) return NO_PITCH;

    const nsdf = this.computeNSDF(signal, minLag, maxLag);

    // Picos locais: pontos onde a NSDF sobe e depois desce.
    const peakLags: number[] = [];
    for (let i = minLag + 1; i < maxLag; i++) {
      if (nsdf[i - 1] < nsdf[i] && nsdf[i] >= nsdf[i + 1]) {
        peakLags.push(i);
      }
    }
    if (peakLags.length === 0) return NO_PITCH;

    let maxValue = -Infinity;
    for (const lag of peakLags) {
      if (nsdf[lag] > maxValue) maxValue = nsdf[lag];
    }
    if (maxValue < MIN_CLARITY_ACCEPT) return NO_PITCH; // sinal nao periodico o suficiente

    // Escolhe o PRIMEIRO pico (menor lag = maior frequencia) que seja "bom o
    // suficiente" perto do maior pico - evita cair na subharmonica (oitava abaixo).
    const actualThreshold = maxValue * CLARITY_THRESHOLD;
    let chosenLag = peakLags[0];
    for (const lag of peakLags) {
      if (nsdf[lag] >= actualThreshold) {
        chosenLag = lag;
        break;
      }
    }

    const refinedLag = this.parabolicInterpolate(nsdf, chosenLag);
    if (refinedLag <= 0) return NO_PITCH;

    return {
      frequency: sampleRate / refinedLag,
      clarity: Math.max(0, Math.min(1, nsdf[chosenLag])),
    };
  }
}
