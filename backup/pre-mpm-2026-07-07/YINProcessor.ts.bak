/**
 * YINProcessor - Algoritmo YIN otimizado para deteccao de pitch de guitarra
 * v2: normalizacao de sinal + fallback para minimo global (melhor captacao ambiente)
 */
const MIN_FREQ = 60;   // abaixo do E2 (~82Hz) com margem
const MAX_FREQ = 1200; // acima do E4 (~330Hz) e harmonicos
const YIN_THRESHOLD = 0.15;
const FALLBACK_MAX_CMND = 0.35; // aceita minimo global se for confiavel o suficiente
const TARGET_RMS = 0.15;        // nivel alvo apos normalizacao
const MIN_RMS = 0.0008;         // abaixo disso e silencio real, ignora

export class YINProcessor {
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

  private static calculateDifferenceFunction(
    signal: Float32Array,
    minLag: number,
    maxLag: number
  ): Float32Array {
    const df = new Float32Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let sum = 0;
      const limit = signal.length - lag;
      for (let i = 0; i < limit; i++) {
        const delta = signal[i] - signal[i + lag];
        sum += delta * delta;
      }
      df[lag] = sum;
    }
    return df;
  }

  private static cumulativeMeanNormalized(
    df: Float32Array,
    minLag: number,
    maxLag: number
  ): Float32Array {
    const cmnd = new Float32Array(maxLag + 1);
    cmnd[minLag] = 1;
    let runningSum = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      runningSum += df[lag];
      cmnd[lag] = (df[lag] * (lag - minLag + 1)) / (runningSum || 1);
    }
    return cmnd;
  }

  static detectPitch(rawSignal: Float32Array, sampleRate: number): number {
    const signal = this.normalize(rawSignal);
    if (!signal) return 0; // silencio real

    const minLag = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
    const maxLag = Math.min(
      Math.floor(signal.length / 2),
      Math.floor(sampleRate / MIN_FREQ)
    );
    if (maxLag <= minLag) return 0;

    const df = this.calculateDifferenceFunction(signal, minLag, maxLag);
    const cmnd = this.cumulativeMeanNormalized(df, minLag, maxLag);

    let period = -1;
    let globalMinLag = minLag;
    let globalMinVal = Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
      if (cmnd[lag] < globalMinVal) {
        globalMinVal = cmnd[lag];
        globalMinLag = lag;
      }
      if (period < 0 && cmnd[lag] < YIN_THRESHOLD) {
        // refina ate achar o minimo local
        while (lag + 1 <= maxLag && cmnd[lag + 1] < cmnd[lag]) {
          lag++;
        }
        period = lag;
        break;
      }
    }

    // fallback: sinal fraco que nao cruzou o threshold, mas tem um minimo confiavel
    if (period <= 0 && globalMinVal < FALLBACK_MAX_CMND) {
      period = globalMinLag;
    }

    if (period <= 0) return 0;

    // interpolacao parabolica para refinar
    if (period > minLag && period < maxLag) {
      const y1 = cmnd[period - 1];
      const y2 = cmnd[period];
      const y3 = cmnd[period + 1];
      const a = (y3 - 2 * y2 + y1) / 2;
      const b = (y3 - y1) / 2;
      if (Math.abs(a) > 1e-10) {
        period = period - b / (2 * a);
      }
    }

    return period > 0 ? sampleRate / period : 0;
  }

  static periodToFrequency(period: number, sampleRate: number): number {
    if (period <= 0) return 0;
    return sampleRate / period;
  }
}