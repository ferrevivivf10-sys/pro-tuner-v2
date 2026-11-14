/**
 * Progresso da afinacao ("X de 6 cordas afinadas") — logica pura, sem React
 * (testavel com `npm test`).
 *
 * - Uma corda conta como afinada depois de ficar em "AFINADO" por
 *   CONFIRM_MS seguidos (passar pelo centro girando a tarraxa nao conta).
 * - Perde a marca se voltar a soar desafinada (|cents| > LOSE_CENTS) por
 *   LOSE_MS: afinar uma corda mexe na tensao do braco e pode desafinar outras.
 * - Avisa uma vez quando todas ficam afinadas.
 */
export const CONFIRM_MS = 400;
export const LOSE_CENTS = 10;
export const LOSE_MS = 800;

export type ProgressReading = {
  index: number | null; // corda tocada
  inTune: boolean;
  cents: number;
  hasSignal: boolean;
};

export type ProgressEvents = {
  stringTuned: number | null; // corda que acabou de ser marcada
  allTuned: boolean; // acabou de completar todas
  changed: boolean; // a lista de cordas afinadas mudou
};

export function createTuningProgress(stringCount: number) {
  let tuned = new Set<number>();
  let inTuneSince = new Map<number, number>();
  let outSince = new Map<number, number>();
  let complete = false;

  return {
    update(r: ProgressReading, now: number): ProgressEvents {
      const ev: ProgressEvents = {
        stringTuned: null,
        allTuned: false,
        changed: false,
      };
      if (!r.hasSignal || r.index == null) {
        // sem som: comecar de novo a contagem do "afinado"
        inTuneSince.clear();
        outSince.clear();
        return ev;
      }
      const i = r.index;

      if (r.inTune) {
        outSince.delete(i);
        if (!inTuneSince.has(i)) inTuneSince.set(i, now);
        if (!tuned.has(i) && now - inTuneSince.get(i)! >= CONFIRM_MS) {
          tuned.add(i);
          ev.stringTuned = i;
          ev.changed = true;
          if (tuned.size === stringCount && !complete) {
            complete = true;
            ev.allTuned = true;
          }
        }
        return ev;
      }

      inTuneSince.delete(i);
      if (Math.abs(r.cents) > LOSE_CENTS) {
        if (!outSince.has(i)) outSince.set(i, now);
        if (tuned.has(i) && now - outSince.get(i)! >= LOSE_MS) {
          tuned.delete(i);
          complete = false;
          ev.changed = true;
        }
      } else {
        outSince.delete(i);
      }
      return ev;
    },

    tuned: (): ReadonlySet<number> => tuned,
    count: () => tuned.size,
    isComplete: () => complete,

    reset() {
      tuned = new Set();
      inTuneSince = new Map();
      outSince = new Map();
      complete = false;
    },
  };
}
