/**
 * Estabilidade do modo microfone — logica pura, sem React nem Android
 * (testavel com `npm test`). Descarta leituras isoladas de ruido, o ataque
 * da corda e pulos de oitava antes de a nota aparecer na tela.
 *
 * Valores medidos nos testes com ruido.
 */
export const SAME_NOTE_CENTS = 50; // leituras dentro disso contam como a mesma nota
export const CONFIRM_FRAMES = 2; // leituras seguidas para trocar de nota
export const OCTAVE_CONFIRM_FRAMES = 3; // pulo de oitava exige mais confirmacao
export const HOLD_MS = 200; // segura a nota exibida apos o som sumir
export const HOLD_SOUND_MS = 600; // segura mais se ainda ha som (leitura suja por ruido)
export const FOLD_STRING_CENTS = 150; // a dobra de oitava so vale se a nota estavel for uma corda da afinacao
export const MIC_MAX_FREQ = 700; // acima disso e ruido do ambiente (Mi agudo na 12a casa = 659 Hz)

// Fim da nota: com o som caindo, o mic pega cordas vibrando por simpatia,
// sub-harmonicos (f/2, f/3) e ruido. Nota nova so entra logo apos um ataque
// (salto de volume); leituras perto da nota atual seguem aceitas.
export const ATTACK_RATIO = 3; // volume subiu 3x sobre o minimo recente
export const ATTACK_MIN_RMS = 0.01; // e chegou a esse volume (ruido medido fica abaixo)
export const ATTACK_LOOKBACK = 3; // leituras usadas para o minimo recente (~330 ms)
export const ATTACK_WINDOW_MS = 600; // nota nova pode ser confirmada ate 600 ms apos o ataque
export const GLIDE_CENTS = 150; // girando a tarraxa a nota desliza: perto da atual nao exige ataque

export function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}

export function isOctaveJump(a: number, b: number): boolean {
  return Math.abs(Math.abs(centsBetween(a, b)) - 1200) < SAME_NOTE_CENTS;
}

// Clareza minima no mic conforme a sensibilidade escolhida.
// Ruido/voz medidos ficam abaixo de ~0.75.
export function micMinClarity(sensitivity: number): number {
  if (sensitivity >= 0.85) return 0.65; // Alta: pega notas fracas (ambiente silencioso)
  if (sensitivity >= 0.55) return 0.75; // Media: equilibrio
  return 0.85; // Baixa: so notas bem limpas (muito ruido)
}

// A leitura do mic e descartada se for pouco periodica ou aguda demais.
export function isMicReadingRejected(
  frequency: number,
  clarity: number,
  sensitivity: number,
): boolean {
  return clarity < micMinClarity(sensitivity) || frequency > MIC_MAX_FREQ;
}

export type StabilizerStep =
  | { kind: "accept"; frequency: number }
  | { kind: "hold"; count: number; need: number }
  | { kind: "noAttack" }; // nota nova sem ataque recente: descartada

export type Stabilizer = {
  /** Volume de cada leitura (inclusive silencio). Detecta o ataque da corda. */
  observe: (rms: number, now: number) => void;
  /** Uma leitura com nota. Diz se ela aparece (ja dobrada de oitava) ou fica segurando. */
  push: (
    frequency: number,
    now: number,
    stringFreqs: number[],
  ) => StabilizerStep;
  /**
   * Sem nota nesta leitura. Se a ultima nota aceita foi ha `holdMs` ou mais,
   * esquece a nota estavel e retorna true (a tela deve limpar).
   */
  release: (now: number, holdMs: number) => boolean;
  /** Ultima nota aceita (Hz), 0 se nenhuma. */
  stableFrequency: () => number;
};

export function createStabilizer(): Stabilizer {
  let stable = 0; // ultima nota aceita (Hz)
  let candidate = 0; // candidata a nova nota (Hz)
  let candCount = 0; // leituras seguidas da candidata
  let lastAccept = 0; // quando a ultima leitura foi aceita
  let lastAttack = -Infinity; // quando houve o ultimo ataque
  const recent: number[] = []; // volumes das ultimas leituras

  return {
    observe(rms, now) {
      // sem historico (inicio da captacao) o minimo e 0: som forte ja e ataque
      const floor = recent.length > 0 ? Math.min(...recent) : 0;
      if (rms >= ATTACK_MIN_RMS && rms >= ATTACK_RATIO * floor)
        lastAttack = now;
      recent.push(rms);
      if (recent.length > ATTACK_LOOKBACK) recent.shift();
    },

    push(frequency, now, stringFreqs) {
      let freq = frequency;
      // Dobra de oitava: no fim da corda o harmonico (2x) domina; com nota
      // ja confirmada, trata como a mesma nota. So vale se a nota estavel
      // for uma corda da afinacao (senao um erro de oitava no ataque ficaria
      // preso).
      const stableIsString =
        stringFreqs.length === 0 ||
        stringFreqs.some(
          (s) => s > 0 && Math.abs(centsBetween(stable, s)) < FOLD_STRING_CENTS,
        );
      if (
        stable > 0 &&
        stableIsString &&
        Math.abs(centsBetween(freq, stable) - 1200) < SAME_NOTE_CENTS
      ) {
        freq = freq / 2;
      }

      if (
        stable > 0 &&
        Math.abs(centsBetween(freq, stable)) < SAME_NOTE_CENTS
      ) {
        // mesma nota: aceita direto
        stable = freq;
        candCount = 0;
      } else {
        // nota nova longe da atual e sem ataque recente: fim de nota ou ruido
        const glide =
          stable > 0 && Math.abs(centsBetween(freq, stable)) < GLIDE_CENTS;
        if (!glide && now - lastAttack > ATTACK_WINDOW_MS) {
          candCount = 0;
          return { kind: "noAttack" };
        }
        // nota nova: precisa se repetir antes de aparecer
        const sameCand =
          candCount > 0 &&
          Math.abs(centsBetween(freq, candidate)) < SAME_NOTE_CENTS;
        candidate = freq;
        candCount = sameCand ? candCount + 1 : 1;
        const need =
          stable > 0 && isOctaveJump(freq, stable)
            ? OCTAVE_CONFIRM_FRAMES
            : CONFIRM_FRAMES;
        if (candCount < need) return { kind: "hold", count: candCount, need };
        stable = freq;
        candCount = 0;
      }
      lastAccept = now;
      return { kind: "accept", frequency: freq };
    },

    release(now, holdMs) {
      if (now - lastAccept < holdMs) return false;
      stable = 0;
      candCount = 0;
      return true;
    },

    stableFrequency: () => stable,
  };
}
