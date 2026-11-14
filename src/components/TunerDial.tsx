/**
 * TunerDial - o mostrador do afinador, em qualquer tamanho.
 *
 * Existem dois tipos de aro:
 *   - "minimalista": desenhado em SVG (anel fino + 60 marcacoes + indicador)
 *   - os demais: a arte em PNG, com uma luz desenhada ATRAS do aro
 *
 * Em ambos a COR vem do estado da afinacao, nunca de uma escolha do usuario:
 * apagado sem sinal, vermelho desafinado, verde afinado. Manter a luz em SVG
 * (e nao embutida na arte) e o que permite uma imagem por estilo servir todos
 * os estados.
 *
 * O mesmo componente desenha o mostrador da tela e as miniaturas do seletor,
 * entao as duas nunca saem de sincronia.
 */
import React, { memo } from "react";
import { View, Image, StyleSheet } from "react-native";
import Svg, { Path, Line, Circle, Defs, RadialGradient, Stop } from "react-native-svg";

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
  /** arte do aro; null = minimalista desenhado em SVG */
  image: number | null;
}

export const RING_STYLES: Record<RingStyleName, RingStyleDef> = {
  minimalista: { label: "Minimalista", image: null },
  aco: { label: "Aço", image: require("../../assets/images/rings/aco.png") },
  ouro: { label: "Ouro", image: require("../../assets/images/rings/ouro.png") },
  grafite: { label: "Grafite", image: require("../../assets/images/rings/grafite.png") },
  "aco-escala": { label: "Aço escala", image: require("../../assets/images/rings/aco-escala.png") },
  "ouro-escala": { label: "Ouro escala", image: require("../../assets/images/rings/ouro-escala.png") },
  "grafite-escala": { label: "Grafite escala", image: require("../../assets/images/rings/grafite-escala.png") },
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
// glow: intensidade da luz atras do aro (0 = apagada)
export const RING_IDLE = { color: "#B9C0C6", highlight: "#E1E6EA", glow: 0 };
export const RING_IN_TUNE = { color: "#00E676", highlight: "#7BFFB4", glow: 0.9 };
export const RING_OUT = { color: "#FF5252", highlight: "#FF9E9E", glow: 0.55 };
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
// O minimalista foi desenhado para um raio de 160; as medidas escalam a partir dai.
const MINIMAL_REF_R = 160;

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

  // --- Aros com arte: luz por tras + imagem por cima ---
  // A luz e um anel radial centrado na faixa do metal (r 0.655..0.795): vaza
  // por fora e pelo miolo transparente da arte, como se estivesse atras do aro.
  const g = accent.glow;
  const gid = `luz-${style}-${Math.round(outerR)}`; // id unico por mostrador
  return (
    <View style={{ width: box, height: box }} pointerEvents="none">
      {g > 0 && (
        <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={gid} cx={c} cy={c} r={c} gradientUnits="userSpaceOnUse">
              <Stop offset="0.52" stopColor={accent.color} stopOpacity={0} />
              <Stop offset="0.64" stopColor={accent.color} stopOpacity={g * 0.75} />
              <Stop offset="0.725" stopColor={accent.color} stopOpacity={g} />
              <Stop offset="0.82" stopColor={accent.color} stopOpacity={g * 0.6} />
              <Stop offset="0.98" stopColor={accent.color} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill={`url(#${gid})`} />
        </Svg>
      )}
      <Image
        source={def.image}
        style={{ width: box, height: box }}
        resizeMode="contain"
      />
    </View>
  );
}

export const TunerDial = memo(TunerDialComponent);
