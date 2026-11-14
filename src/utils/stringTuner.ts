/**
 * Afinador por corda — logica pura, sem React (testavel com `npm test`).
 *
 * A partir da frequencia detectada escolhe a corda alvo da afinacao (a
 * travada pelo usuario ou a mais proxima) e suaviza os cents mostrados.
 * Nao altera a deteccao, so o que aparece na tela.
 */

export const CENTS_SMOOTH_SIZE = 5; // media movel das ultimas N leituras de cents

export const STRING_GUARD_CENTS = 250; // ~metade da distancia entre cordas; acima disso o sinal esta longe de qualquer corda

export const IN_TUNE_CENTS = 5; // |cents| < isso => afinado

// Limiar de clareza (0-1) do MPM para considerar que ha uma NOTA real, e nao
// ruido ambiente. E derivado da "sensibilidade" (0-1) escolhida nas Config.:
// sensibilidade ALTA => limiar BAIXO (pega notas fracas, mas trava mais em ruido)
// sensibilidade BAIXA => limiar ALTO (so notas bem definidas)
const CONFIDENCE_MIN_AT_ZERO = 0.85; // sensibilidade 0
const CONFIDENCE_SENS_RANGE = 0.5; // quanto a sensibilidade abaixa o limiar

export function confidenceThreshold(sensitivity: number): number {
  const s = Math.max(0, Math.min(1, sensitivity));
  return CONFIDENCE_MIN_AT_ZERO - CONFIDENCE_SENS_RANGE * s;
}

export const TUNING_STRING_NAMES: Record<string, string[]> = {
  Standard: ["E2", "A2", "D3", "G3", "B3", "E4"],
  DropD: ["D2", "A2", "D3", "G3", "B3", "E4"],
  HalfStepDown: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"],
  FullStepDown: ["D2", "G2", "C3", "F3", "A3", "D4"],
  OpenG: ["D2", "G2", "D3", "G3", "B3", "D4"],
};

// Numero MIDI de cada nota de corda usada nas afinacoes. A frequencia e
// derivada em runtime a partir da referencia A4 (calibracao), para que 432 Hz,
// 440 Hz etc. produzam alvos corretos.
export const STRING_MIDI: Record<string, number> = {
  D2: 38,
  Eb2: 39,
  E2: 40,
  F2: 41,
  Gb2: 42,
  G2: 43,
  Ab2: 44,
  A2: 45,
  Bb2: 46,
  B2: 47,
  C3: 48,
  Db3: 49,
  D3: 50,
  Eb3: 51,
  E3: 52,
  F3: 53,
  Gb3: 54,
  G3: 55,
  Ab3: 56,
  A3: 57,
  Bb3: 58,
  B3: 59,
  C4: 60,
  Db4: 61,
  D4: 62,
  Eb4: 63,
  E4: 64,
  G4: 67,
};

export function stringFreq(name: string, refA4: number): number {
  const midi = STRING_MIDI[name];
  if (midi == null) return 0;
  return refA4 * Math.pow(2, (midi - 69) / 12);
}

// Extrai nota + oitava de um rotulo de corda, ex: "Eb2" -> { note: "Eb", octave: 2 }
export function parseStringLabel(label: string): {
  note: string;
  octave: number;
} {
  const match = label.match(/^([A-G][b#]?)(\d)$/);
  if (!match) return { note: label, octave: 0 };
  return { note: match[1], octave: parseInt(match[2], 10) };
}

// Nome falado da nota para o leitor de tela, ex: "Eb2" -> "Mi bemol 2"
const SPOKEN_NOTES: Record<string, string> = {
  C: "Dó",
  D: "Ré",
  E: "Mi",
  F: "Fá",
  G: "Sol",
  A: "Lá",
  B: "Si",
};

export function spokenStringName(label: string): string {
  const { note, octave } = parseStringLabel(label);
  const base = SPOKEN_NOTES[note[0]] ?? note;
  const accidental =
    note[1] === "b" ? " bemol" : note[1] === "#" ? " sustenido" : "";
  return base + accidental + (octave > 0 ? " " + octave : "");
}

export const centsBetween = (a: number, b: number) => 1200 * Math.log2(a / b);

/**
 * Corda alvo: a travada pelo usuario ou a mais proxima em cents, desde que
 * dentro de STRING_GUARD_CENTS. Retorna null se o som estiver longe de todas.
 */
export function pickTargetString(
  frequency: number,
  calStringFreqs: number[],
  lockedIndex: number | null,
): number | null {
  if (lockedIndex != null) return lockedIndex;
  let best: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < calStringFreqs.length; i++) {
    const t = calStringFreqs[i];
    if (!t) continue;
    const d = Math.abs(centsBetween(frequency, t));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best != null && bestDist <= STRING_GUARD_CENTS ? best : null;
}

/** Media movel das ultimas `size` leituras de cents. */
export function createCentsSmoother(size: number = CENTS_SMOOTH_SIZE) {
  let buf: number[] = [];
  return {
    push(cents: number): number {
      buf.push(cents);
      if (buf.length > size) buf.shift();
      return buf.reduce((a, b) => a + b, 0) / buf.length;
    },
    reset() {
      buf = [];
    },
  };
}

export type TuneAction = "AFINADO" | "AFROUXAR" | "APERTAR";

/** Agudo (cents > 0) => afrouxar; grave => apertar. */
export function tuneAction(cents: number): TuneAction {
  if (Math.abs(cents) < IN_TUNE_CENTS) return "AFINADO";
  return cents > 0 ? "AFROUXAR" : "APERTAR";
}
