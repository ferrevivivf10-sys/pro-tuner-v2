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
import Svg, {
  LinearGradient,
  Path,
  Line,
  Circle,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
import { DIAL_BAND_OUT } from "./dialLayout";

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
  grafite: {
    label: "Grafite",
    image: require("../../assets/images/rings/grafite.png"),
  },
  "aco-escala": {
    label: "Aço escala",
    image: require("../../assets/images/rings/aco-escala.png"),
  },
  "ouro-escala": {
    label: "Ouro escala",
    image: require("../../assets/images/rings/ouro-escala.png"),
  },
  "grafite-escala": {
    label: "Grafite escala",
    image: require("../../assets/images/rings/grafite-escala.png"),
  },
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
export const RING_IN_TUNE = {
  color: "#00E676",
  highlight: "#7BFFB4",
  glow: 0.9,
};
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
const BAND_OUT = DIAL_BAND_OUT; // mesma medida usada em dialLayout.ts
// O minimalista foi desenhado para um raio de 160; as medidas escalam a partir dai.
const MINIMAL_REF_R = 160;
// Bordas do metal na arte (fracao do meio-lado): a luz nasce rente a elas.
const EDGE_IN = 0.655;
const EDGE_OUT = BAND_OUT;
const BAND_MID = (EDGE_IN + EDGE_OUT) / 2;

/** Mistura uma cor #RRGGBB com branco (w = 0..1). */
function towardWhite(hex: string, w: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * w);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const pt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  const [x0, y0] = pt(a0);
  const [x1, y1] = pt(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`;
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

  // --- Minimalista: anel fino + 60 marcacoes; o proprio anel acende (neon discreto) ---
  if (def.image == null) {
    const k = outerR / MINIMAL_REF_R;
    const lit = accent.glow;
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
          stroke={isCenter ? "#B9C0C6" : isQuarter ? "#AAAAAA" : "#3A3A3A"}
          strokeWidth={Math.max(w, 0.5)}
        />,
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
          {lit > 0 && (
            <>
              {/* halo curto em volta da linha */}
              <Circle
                cx={c}
                cy={c}
                r={outerR}
                fill="none"
                stroke={accent.color}
                strokeWidth={7 * k}
                strokeOpacity={0.1 * lit}
              />
              <Circle
                cx={c}
                cy={c}
                r={outerR}
                fill="none"
                stroke={accent.color}
                strokeWidth={3.5 * k}
                strokeOpacity={0.25 * lit}
              />
              {/* a linha acesa */}
              <Circle
                cx={c}
                cy={c}
                r={outerR}
                fill="none"
                stroke={towardWhite(accent.color, 0.2)}
                strokeWidth={1.6 * k}
                strokeOpacity={0.55 + 0.45 * lit}
              />
            </>
          )}
          {ticks}
        </Svg>
      </View>
    );
  }

  // --- Aros com arte: luz por tras + imagem + acabamento por cima ---
  // Atras: luz que nasce rente as bordas do metal (quase branca ali) e se
  // espalha para fora e para o miolo. Por cima: bordas acesas, um leve
  // reflexo da cor no metal e um brilho no topo, como metal polido.
  const g = accent.glow;
  const id = `${style}-${Math.round(outerR)}`; // ids unicos por mostrador
  const col = accent.color;
  const hot = towardWhite(col, 0.6);
  const rim = towardWhite(col, 0.55);
  const spec = towardWhite(col, 0.85);
  const specR = BAND_MID * c;
  const specX = specR * Math.SQRT1_2; // pontas do arco do brilho (-135..-45 graus)
  return (
    <View style={{ width: box, height: box }} pointerEvents="none">
      {g > 0 && (
        <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient
              id={`luz-${id}`}
              cx={c}
              cy={c}
              r={c}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0.45" stopColor={col} stopOpacity={0} />
              <Stop offset="0.6" stopColor={col} stopOpacity={0.35 * g} />
              <Stop offset={EDGE_IN - 0.007} stopColor={hot} stopOpacity={g} />
              <Stop
                offset={EDGE_IN + 0.01}
                stopColor={col}
                stopOpacity={0.9 * g}
              />
              <Stop
                offset={EDGE_OUT - 0.01}
                stopColor={col}
                stopOpacity={0.9 * g}
              />
              <Stop offset={EDGE_OUT + 0.01} stopColor={hot} stopOpacity={g} />
              <Stop offset="0.84" stopColor={col} stopOpacity={0.55 * g} />
              <Stop offset="0.9" stopColor={col} stopOpacity={0.25 * g} />
              <Stop offset="0.96" stopColor={col} stopOpacity={0.08 * g} />
              <Stop offset="1" stopColor={col} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c} fill={`url(#luz-${id})`} />
        </Svg>
      )}
      <Image
        source={def.image}
        style={{ width: box, height: box }}
        resizeMode="contain"
      />
      {g > 0 && (
        <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient
              id={`brilho-${id}`}
              x1={c - specX}
              y1={0}
              x2={c + specX}
              y2={0}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor={spec} stopOpacity={0} />
              <Stop offset="0.5" stopColor={spec} stopOpacity={0.7 * g} />
              <Stop offset="1" stopColor={spec} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {/* metal contra a luz: um pouco mais escuro, com reflexo da cor */}
          <Circle
            cx={c}
            cy={c}
            r={BAND_MID * c}
            fill="none"
            stroke="#000000"
            strokeWidth={(EDGE_OUT - EDGE_IN) * c}
            strokeOpacity={0.15 * g}
          />
          <Circle
            cx={c}
            cy={c}
            r={BAND_MID * c}
            fill="none"
            stroke={col}
            strokeWidth={(EDGE_OUT - EDGE_IN) * c}
            strokeOpacity={0.12 * g}
          />
          {/* bordas acesas: luz vazando por cima das quinas */}
          {[EDGE_IN, EDGE_OUT].map((e) => (
            <React.Fragment key={e}>
              <Circle
                cx={c}
                cy={c}
                r={e * c}
                fill="none"
                stroke={col}
                strokeWidth={0.035 * c}
                strokeOpacity={0.22 * g}
              />
              <Circle
                cx={c}
                cy={c}
                r={e * c}
                fill="none"
                stroke={rim}
                strokeWidth={0.012 * c}
                strokeOpacity={0.9 * g}
              />
            </React.Fragment>
          ))}
          {/* brilho no topo do metal */}
          <Path
            d={arcPath(c, c, specR, -135, -45)}
            stroke={`url(#brilho-${id})`}
            strokeWidth={0.06 * c}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      )}
    </View>
  );
}

export const TunerDial = memo(TunerDialComponent);
