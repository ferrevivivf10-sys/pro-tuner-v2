/**
 * Utilitários para conversão entre frequência e notas musicais
 */

export const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export interface NoteInfo {
  noteName: string;
  octave: number;
  cents: number;
  midi: number;
  frequency: number;
}

/**
 * Converte frequência em Hz para informações de nota musical
 * @param frequency - Frequência em Hz
 * @param referenceA4 - Frequência de referência A4 (padrão: 440 Hz)
 * @returns Informações da nota ou null se frequência inválida
 */
export const getNoteFromFreq = (
  frequency: number,
  referenceA4: number = 440
): NoteInfo | null => {
  if (!frequency || frequency <= 0) return null;

  // Fórmula MIDI: n = 12 * log2(f / 440) + 69
  const n = 12 * Math.log2(frequency / referenceA4) + 69;
  const midi = Math.round(n);
  const noteName = NOTES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  const cents = Math.floor((n - midi) * 100);

  return {
    noteName,
    octave,
    cents,
    midi,
    frequency,
  };
};

/**
 * Converte MIDI note number para frequência em Hz
 */
export const getFreqFromMidi = (midi: number, referenceA4: number = 440): number => {
  return referenceA4 * Math.pow(2, (midi - 69) / 12);
};

/**
 * Afinações predefinidas para guitarra
 * Frequências em Hz das cordas abertas
 */
export const TUNINGS = {
  Standard: [82.41, 110.0, 146.83, 196.0, 246.94, 329.63], // E2 A2 D3 G3 B3 E4
  DropD: [73.42, 110.0, 146.83, 196.0, 246.94, 329.63], // D2 A2 D3 G3 B3 E4
  HalfStepDown: [77.78, 103.83, 138.59, 185.0, 233.08, 311.13], // D#2 G#2 C#3 F#3 A#3 D#4
  FullStepDown: [73.42, 98.0, 130.81, 174.61, 220.0, 293.66], // D2 G2 C3 F3 A3 D4
  OpenG: [82.41, 98.0, 146.83, 196.0, 246.94, 392.0], // E2 G2 D3 G3 B3 G4
};

export type TuningName = keyof typeof TUNINGS;

/**
 * Encontra a nota mais próxima em uma afinação
 */
export const findClosestStringInTuning = (
  frequency: number,
  tuning: number[]
): { stringIndex: number; targetFreq: number; cents: number } | null => {
  let closest = { stringIndex: -1, distance: Infinity, targetFreq: 0 };

  for (let i = 0; i < tuning.length; i++) {
    const targetFreq = tuning[i];
    const noteInfo = getNoteFromFreq(frequency, 440);
    const targetNote = getNoteFromFreq(targetFreq, 440);

    if (noteInfo && targetNote) {
      // Calcular distância em cents
      const distance = Math.abs(noteInfo.cents - targetNote.cents);
      if (distance < closest.distance) {
        closest = { stringIndex: i, distance, targetFreq };
      }
    }
  }

  if (closest.stringIndex === -1) return null;

  const noteInfo = getNoteFromFreq(frequency, 440);
  return {
    stringIndex: closest.stringIndex,
    targetFreq: closest.targetFreq,
    cents: noteInfo?.cents ?? 0,
  };
};
