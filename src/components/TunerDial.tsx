/**
 * TunerDial - o mostrador do afinador, em qualquer tamanho.
 *
 * Existem dois tipos de aro:
 *   - "minimalista": desenhado em SVG (anel fino + 60 marcacoes + indicador)
 *   - os demais: a arte em PNG, com um arco desenhado por cima
 *
 * Em ambos a COR vem do estado da afinacao, nunca de uma escolha do usuario:
 * apagado sem sinal, vermelho desafinado, verde afinado. Manter o arco em SVG
 * (e nao embutido na arte) e o que permite uma imagem por estilo servir todos
 * os estados.
 *
 * O mesmo componente desenha o mostrador da tela e as miniaturas do seletor,
 * entao as duas nunca saem de sincronia.
 */
import React, { memo } from "react";
import { View, Image, StyleSheet } from "react-native";
import Svg, { Path, Line, Circle } from "react-native-svg";

export type RingStyleName =
  | "minimalista"
  | "aco"
  | "ouro"
  | "grafite"
  | "aco-escala"
  | "ouro-escala"
  | "grafite-escala";

interface RingStyleDef {
  label: string;
  /** null = desenhado em SVG */
  image: number | null;
  /**
   * Onde o arco de estado assenta, em fracao do meio-lado da imagem.
   * E por estilo porque as artes tem estruturas diferentes: nas de faixa
   * cheia o metal vai de 0.655 a 0.79, enquanto as "escala" sao aro duplo
   * (aro 0.655-0.70, canal de marcacoes 0.70-0.75, aro 0.75-0.79).
   * Usar um numero unico fazia o arco transbordar o canal e cobrir os dois
   * aros das "escala".
   */
  arcR: number;
  arcW: number;
}

// Faixa cheia: o arco cobre o metal
const BAND_ARC = { arcR: 0.725, arcW: 0.098 };
// Aro duplo: o arco corre DENTRO do canal, sem encostar nos aros
const CHANNEL_ARC = { arcR: 0.725, arcW: 0.044 };

export const RING_STYLES: Record<RingStyleName, RingStyleDef> = {
  minimalista: { label: "Minimalista", image: null, ...BAND_ARC },
  aco: { label: "Aço", image: require("../../assets/images/rings/aco.png"), ...BAND_ARC },
  ouro: { label: "Ouro", image: require("../../assets/images/rings/ouro.png"), ...BAND_ARC },
  grafite: { label: "Grafite", image: require("../../assets/images/rings/grafite.png"), ...BAND_ARC },
  "aco-escala": { label: "Aço escala", image: require("../../assets/images/rings/aco-escala.png"), ...CHANNEL_ARC },
  "ouro-escala": { label: "Ouro escala", image: require("../../assets/images/rings/ouro-escala.png"), ...CHANNEL_ARC },
  "grafite-escala": { label: "Grafite escala", image: require("../../assets/images/rings/grafite-escala.png"), ...CHANNEL_ARC },
};

export const RING_STYLE_ORDER: RingStyleName[] = [
  "minimalista",
  "aco",
  "ouro",
  "grafite",
  "aco-escala",
  "ouro-escala",
  "grafite-escala",
];

export const DEFAULT_RING_STYLE: RingStyleName = "minimalista";

export function isRingStyle(value: string): value is RingStyleName {
  return Object.prototype.hasOwnProperty.call(RING_STYLES, value);
}

// ===== Cor por estado =====
// Sem sinal fica PRATEADO, nao cinza escuro: qualquer tom mais escuro que o
// metal e lido como mancha/sombra no aro, em vez de indicador apagado.
export const RING_IDLE = { color: "#B9C0C6", highlight: "#E1E6EA" };
export const RING_IN_TUNE = { color: "#00E676", highlight: "#7BFFB4" };
export const RING_OUT = { color: "#FF5252", highlight: "#FF9E9E" };
export type RingAccent = typeof RING_IDLE;

export function ringAccent(hasSignal: boolean, inTune: boolean): RingAccent {
  if (!hasSignal) return RING_IDLE;
  return inTune ? RING_IN_TUNE : RING_OUT;
}

// ===== Geometria =====
// Medido na arte: a faixa metalica ocupa r=0.655..0.795 do meio-lado da imagem.
// A caixa e dimensionada para a borda EXTERNA da faixa cair no raio pedido.
// Borda externa do metal na arte: usada para dimensionar a caixa de modo que
// o aro caia exatamente no raio pedido.
const BAND_OUT = 0.795;
const ARC_FROM = -125; // graus; -90 e o topo
const ARC_TO = -55;
// O minimalista foi desenhado para um raio de 160; as medidas escalam a partir dai.
const MINIMAL_REF_R = 160;

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
}

interface TunerDialProps {
  /** raio externo do mostrador */
  outerR: number;
  style: RingStyleName;
  accent: RingAccent;
}

function TunerDialComponent({ outerR, style, accent }: TunerDialProps) {
  const def = RING_STYLES[style] ?? RING_STYLES[DEFAULT_RING_STYLE];
  const box = (outerR / BAND_OUT) * 2;
  const c = box / 2;

  // --- Minimalista: anel fino + 60 marcacoes + indicador pequeno no topo ---
  if (def.image == null) {
    const k = outerR / MINIMAL_REF_R;
    const ticks = [];
    for (let i = 0; i < 60; i++) {
      const rad = ((i * 6 - 90) * Math.PI) / 180;
      const isCenter = i === 0;
      const isQuarter = i % 5 === 0;
      const len = (isCenter ? 18 : isQuarter ? 13 : 8) * k;
      const w = (isCenter ? 3 : isQuarter ? 2 : 1) * k;
      ticks.push(
        <Line
          key={i}
          x1={c + outerR * Math.cos(rad)}
          y1={c + outerR * Math.sin(rad)}
          x2={c + (outerR - len) * Math.cos(rad)}
          y2={c + (outerR - len) * Math.sin(rad)}
          stroke={isCenter ? accent.color : isQuarter ? "#AAAAAA" : "#3A3A3A"}
          strokeWidth={Math.max(w, 0.5)}
        />
      );
    }
    return (
      <View style={{ width: box, height: box }} pointerEvents="none">
        <Svg width={box} height={box}>
          <Circle
            cx={c}
            cy={c}
            r={outerR}
            fill="#000000"
            stroke="#1F1F1F"
            strokeWidth={2 * k}
          />
          {ticks}
          {/* indicador do topo, como no mostrador original */}
          <Path
            d={`M ${c} ${c - outerR - 2 * k} L ${c} ${c - outerR + 18 * k}`}
            stroke={accent.color}
            strokeWidth={5 * k}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }

  // --- Aros com arte: imagem + arco de estado por cima ---
  const arcR = def.arcR * c;
  const arcW = def.arcW * c;
  const d = arcPath(c, c, arcR, ARC_FROM, ARC_TO);
  return (
    <View style={{ width: box, height: box }} pointerEvents="none">
      <Image
        source={def.image}
        style={{ width: box, height: box }}
        resizeMode="contain"
      />
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        {/* halo */}
        <Path
          d={d}
          stroke={accent.color}
          strokeWidth={arcW * 1.9}
          fill="none"
          opacity={0.18}
          strokeLinecap="round"
        />
        {/* nucleo */}
        <Path
          d={d}
          stroke={accent.color}
          strokeWidth={arcW}
          fill="none"
          strokeLinecap="round"
        />
        {/* faixa clara: aspecto de vidro */}
        <Path
          d={d}
          stroke={accent.highlight}
          strokeWidth={arcW * 0.3}
          fill="none"
          opacity={0.9}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

export const TunerDial = memo(TunerDialComponent);
