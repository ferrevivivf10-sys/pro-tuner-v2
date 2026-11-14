/**
 * Medidas do mostrador conforme a largura da tela — logica pura, sem React
 * (testavel com `npm test`).
 *
 * O desenho foi feito para telas de ~412 px. Em telas mais estreitas (celular
 * compacto ou "Tamanho da exibicao" aumentado no Android) o aro passava das
 * bordas e cobria os nomes das cordas. Aqui tudo encolhe na mesma proporcao;
 * em telas largas nada muda.
 */

// Medidas de referencia (escala 1)
export const BASE_RING_R = 160; // raio do aro
export const BASE_RING_SIZE = 380; // altura da area do mostrador
export const BASE_RING_R_INNER = 130; // as cordas ficam dentro deste raio
export const STRING_COUNT = 6;
export const LOCK_HIT_HEIGHT = 40; // altura maxima da area de toque de cada corda

// O desenho do aro (com o brilho) ocupa outerR / BAND_OUT de cada lado.
// Mesmo valor de BAND_OUT em TunerDial.tsx.
export const DIAL_BAND_OUT = 0.795;
// Espaco reservado de cada lado para os nomes das cordas (E2, A2...)
export const LABEL_ROOM = 36;

export type DialLayout = {
  scale: number;
  screenWidth: number;
  ringR: number;
  ringSize: number;
  ringCy: number;
  stringSpacing: number;
  firstStringY: number;
  hitHeight: number;
  noteRowWidth: number;
};

export function dialLayout(screenWidth: number): DialLayout {
  const width = Math.max(0, screenWidth);
  // 1) o desenho do aro inteiro cabe na tela
  const rByBox = (width / 2) * DIAL_BAND_OUT;
  // 2) o circulo do aro deixa espaco para os nomes das cordas
  const rByLabels = width / 2 - LABEL_ROOM;
  const ringR = Math.max(0, Math.min(BASE_RING_R, rByBox, rByLabels));
  const scale = ringR / BASE_RING_R;

  const ringSize = BASE_RING_SIZE * scale;
  const ringCy = ringSize / 2;
  const stringSpacing = (BASE_RING_R_INNER * 2 * scale) / (STRING_COUNT + 1);
  const firstStringY = ringCy - ((STRING_COUNT - 1) * stringSpacing) / 2;

  return {
    scale,
    screenWidth: width,
    ringR,
    ringSize,
    ringCy,
    stringSpacing,
    firstStringY,
    // areas de toque nao se sobrepoem (antes 40 px para 37 px entre cordas)
    hitHeight: Math.min(LOCK_HIT_HEIGHT, stringSpacing),
    noteRowWidth: Math.min(BASE_RING_SIZE, width),
  };
}

export function stringY(layout: DialLayout, index: number): number {
  return layout.firstStringY + index * layout.stringSpacing;
}
