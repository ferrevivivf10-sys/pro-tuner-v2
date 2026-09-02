/**
 * PitchLabDisplay v10 - afinador por corda (com calibracao A4 correta)
 * - Fundo OLED (#000000 puro)
 * - A nota grande e a da CORDA ativa da afinacao (nao a cromatica mais proxima)
 * - Cents medidos contra a frequencia da corda, ja corrigida pela referencia A4
 * - Indicador de acao no centro: AFROUXAR (agudo) / APERTAR (grave) / AFINADO
 * - Linhas das cordas atravessam a tela toda; so a ativa brilha
 * - Trava manual: tocar no nome de uma corda fixa a leitura nela
 * - Suavizacao: hold da nota (600ms) e media movel de cents
 */

import React, { useEffect, useRef, memo, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import Svg, {
  Circle,
  Line,
  Rect,
  Path,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Filter,
  FeGaussianBlur,
} from "react-native-svg";

const SCREEN_WIDTH = Dimensions.get("window").width;

const RING_SIZE = 380;
const RING_CX = RING_SIZE / 2;
const RING_CY = RING_SIZE / 2;
const RING_R = 160;
const RING_R_INNER = 130;

const CHORD_COUNT = 6;
const CHORD_SPACING = (RING_R_INNER * 2) / (CHORD_COUNT + 1);
const BASE_Y = RING_CY - ((CHORD_COUNT - 1) * CHORD_SPACING) / 2;

// Largura das linhas das cordas: ocupa a tela toda (ponta a ponta)
const STRING_AREA_WIDTH = SCREEN_WIDTH;

// ===== Parametros de SUAVIZACAO =====
const NOTE_HOLD_MS = 600;        // tempo que a nota permanece apos o som sumir
const CENTS_SMOOTH_SIZE = 5;     // media movel das ultimas N leituras de cents
const LOCK_HIT_HEIGHT = 40;      // altura da area de toque de cada corda (modo manual)
const STRING_GUARD_CENTS = 250;  // ~metade da distancia entre cordas; acima disso o sinal esta longe de qualquer corda
const IN_TUNE_CENTS = 5;         // |cents| < isso => afinado
// Clareza minima (0-1) do MPM para considerar que ha uma NOTA real, e nao ruido
// ambiente. Ajustavel: menor = mais sensivel (pega notas fracas, mas trava mais
// em ruido); maior = so notas bem definidas.
const CONFIDENCE_MIN = 0.6;

// Cores cromaticas fixas por POSICAO da corda (0 = mais grave ... 5 = mais aguda)
const STRING_COLORS = [
  "#1565FF", // corda 1 (grave) - azul
  "#FF3B3B", // corda 2 - vermelho
  "#27D86B", // corda 3 - verde
  "#FFB300", // corda 4 - ouro
  "#B14CFF", // corda 5 - roxo
  "#FF7A00", // corda 6 (aguda) - laranja
];

const TUNING_STRING_NAMES: Record<string, string[]> = {
  Standard: ["E2", "A2", "D3", "G3", "B3", "E4"],
  DropD: ["D2", "A2", "D3", "G3", "B3", "E4"],
  HalfStepDown: ["Eb2", "Ab2", "Db3", "Gb3", "Bb3", "Eb4"],
  FullStepDown: ["D2", "G2", "C3", "F3", "A3", "D4"],
  OpenG: ["E2", "G2", "D3", "G3", "B3", "G4"],
};

// Numero MIDI de cada nota de corda usada nas afinacoes. A frequencia e
// derivada em runtime a partir da referencia A4 (calibracao), para que 432 Hz,
// 440 Hz etc. produzam alvos corretos.
const STRING_MIDI: Record<string, number> = {
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

function stringFreq(name: string, refA4: number): number {
  const midi = STRING_MIDI[name];
  if (midi == null) return 0;
  return refA4 * Math.pow(2, (midi - 69) / 12);
}

interface PitchLabDisplayProps {
  frequency: number;
  confidence: number;
  refA4: number;
  selectedTuning: string;
  onTuningPress?: () => void;
}

// Extrai nota + oitava de um rotulo de corda, ex: "Eb2" -> { note: "Eb", octave: 2 }
function parseStringLabel(label: string): { note: string; octave: number } {
  const match = label.match(/^([A-G][b#]?)(\d)$/);
  if (!match) return { note: label, octave: 0 };
  return { note: match[1], octave: parseInt(match[2], 10) };
}

// ===== Hook do afinador por corda =====
// A partir da frequencia crua, escolhe a corda alvo (a travada manualmente ou a
// mais proxima em cents) e devolve os cents suavizados contra ela. Nao altera a
// deteccao, so o que aparece na tela. Segura o ultimo valor por NOTE_HOLD_MS
// depois que o som some, para nao piscar.
function useStringTuner(
  frequency: number,
  confidence: number,
  calStringFreqs: number[],
  lockedIndex: number | null
) {
  const [display, setDisplay] = useState<{
    index: number | null;
    cents: number;
    hasSignal: boolean;
  }>({ index: lockedIndex, cents: 0, hasSignal: false });

  const centsBufferRef = useRef<number[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndexRef = useRef<number | null>(null);

  // Troca de corda travada / afinacao: zera a suavizacao
  useEffect(() => {
    centsBufferRef.current = [];
  }, [lockedIndex]);

  useEffect(() => {
    // So conta como sinal se houver uma nota CLARA (evita travar em ruido ambiente)
    const hasRawSignal = frequency > 50 && confidence >= CONFIDENCE_MIN;

    if (hasRawSignal) {
      // Corda alvo: a travada, ou a mais proxima dentro da tolerancia
      let idx: number | null = lockedIndex;
      if (idx == null) {
        let best: number | null = null;
        let bestDist = Infinity;
        for (let i = 0; i < calStringFreqs.length; i++) {
          const t = calStringFreqs[i];
          if (!t) continue;
          const d = Math.abs(1200 * Math.log2(frequency / t));
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        }
        if (best != null && bestDist <= STRING_GUARD_CENTS) idx = best;
      }

      if (idx != null) {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        if (idx !== currentIndexRef.current) {
          currentIndexRef.current = idx;
          centsBufferRef.current = [];
        }
        const target = calStringFreqs[idx];
        const rawCents = 1200 * Math.log2(frequency / target);
        const buf = centsBufferRef.current;
        buf.push(rawCents);
        if (buf.length > CENTS_SMOOTH_SIZE) buf.shift();
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setDisplay({ index: idx, cents: avg, hasSignal: true });
        return;
      }
      // Sinal presente mas longe de qualquer corda: cai para o hold abaixo
    }

    // Sem sinal (ou longe de tudo): segura por NOTE_HOLD_MS e entao limpa
    if (!holdTimerRef.current && currentIndexRef.current != null) {
      holdTimerRef.current = setTimeout(() => {
        currentIndexRef.current = null;
        centsBufferRef.current = [];
        holdTimerRef.current = null;
        setDisplay({ index: lockedIndex, cents: 0, hasSignal: false });
      }, NOTE_HOLD_MS);
    }
  }, [frequency, confidence, calStringFreqs, lockedIndex]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return display;
}

function RingTicks() {
  const ticks = [];
  const total = 60;
  for (let i = 0; i < total; i++) {
    const angleDeg = (i / total) * 360 - 90;
    const rad = (angleDeg * Math.PI) / 180;
    const isCenter = i === 0;
    const isQuarter = i % 5 === 0;
    const len = isCenter ? 18 : isQuarter ? 13 : 8;
    const strokeW = isCenter ? 3 : isQuarter ? 2 : 1;
    const color = isCenter ? "#00E676" : isQuarter ? "#AAAAAA" : "#3A3A3A";
    const x1 = RING_CX + RING_R * Math.cos(rad);
    const y1 = RING_CY + RING_R * Math.sin(rad);
    const x2 = RING_CX + (RING_R - len) * Math.cos(rad);
    const y2 = RING_CY + (RING_R - len) * Math.sin(rad);
    ticks.push(
      <Line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeW}
      />
    );
  }
  return <>{ticks}</>;
}

// Linhas das cordas atravessando a tela toda
const StringLinesFullWidth = memo(
  ({
    centsValue,
    tuningNames,
    activeStringIndex,
    hasSignal,
    lockedStringIndex,
  }: {
    centsValue: number;
    tuningNames: string[];
    activeStringIndex: number | null;
    hasSignal: boolean;
    lockedStringIndex: number | null;
  }) => {
    const x1 = 0;
    const x2 = STRING_AREA_WIDTH;
    const width = STRING_AREA_WIDTH;

    return (
      <Svg width={STRING_AREA_WIDTH} height={RING_SIZE}>
        <Defs>
          <Filter id="glowActive" x="-20%" y="-50%" width="140%" height="200%">
            <FeGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </Filter>
        </Defs>

        {Array.from({ length: CHORD_COUNT }).map((_, i) => {
          const y = BASE_Y + i * CHORD_SPACING;
          const stringName = tuningNames[i] || "";
          const stringColor = STRING_COLORS[i] || "#666666";
          const isActive = activeStringIndex === i && hasSignal;
          // "Alvo": corda travada manualmente, exibida com destaque mesmo sem sinal
          const isTargeted = lockedStringIndex === i;
          const displayColor = isActive || isTargeted ? stringColor : "#3C3C3C";

          // Curvatura so na corda ativa, proporcional aos cents
          const amplitude = isActive ? Math.min(Math.abs(centsValue), 22) : 0;
          const curve = amplitude * (centsValue > 0 ? -1 : 1);

          const path = `M ${x1} ${y} C ${x1 + width * 0.25} ${y + curve} ${
            x1 + width * 0.75
          } ${y + curve} ${x2} ${y}`;

          const strokeWidth = isActive ? 3 : isTargeted ? 2 : 1.5;
          const opacity = isActive ? 1 : isTargeted ? 0.7 : 0.45;

          return (
            <React.Fragment key={i}>
              {isActive && (
                <Path
                  d={path}
                  stroke={displayColor}
                  strokeWidth={strokeWidth + 3}
                  fill="none"
                  opacity={0.35}
                  filter="url(#glowActive)"
                />
              )}
              <Path
                d={path}
                stroke={displayColor}
                strokeWidth={strokeWidth}
                fill="none"
                opacity={opacity}
              />
              {/* Label da corda na margem esquerda */}
              <SvgText
                x={10}
                y={y - 6}
                fontSize={isActive ? "13" : isTargeted ? "12" : "11"}
                fill={isActive ? displayColor : isTargeted ? stringColor : "#666666"}
                textAnchor="start"
                fontWeight={isActive || isTargeted ? "700" : "600"}
                opacity={isActive ? 1 : isTargeted ? 0.9 : 0.7}
              >
                {stringName}
                {isTargeted && !isActive ? " •" : ""}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    );
  }
);
StringLinesFullWidth.displayName = "StringLinesFullWidth";

// Areas de toque invisiveis sobre cada corda, para ativar o modo manual.
// Fica numa camada separada da SVG (que e pointerEvents="none").
function StringHitTargets({
  tuningNames,
  onStringPress,
}: {
  tuningNames: string[];
  onStringPress: (index: number) => void;
}) {
  return (
    <View style={styles.hitLayer} pointerEvents="box-none">
      {tuningNames.map((_, i) => {
        const y = BASE_Y + i * CHORD_SPACING;
        return (
          <TouchableOpacity
            key={i}
            style={[styles.hitRow, { top: y - LOCK_HIT_HEIGHT / 2 }]}
            activeOpacity={0.5}
            onPress={() => onStringPress(i)}
          />
        );
      })}
    </View>
  );
}

function PitchLabDisplayComponent({
  frequency,
  confidence,
  refA4,
  selectedTuning,
  onTuningPress,
}: PitchLabDisplayProps) {
  const tuningNames =
    TUNING_STRING_NAMES[selectedTuning] ?? TUNING_STRING_NAMES.Standard;

  // Frequencias das cordas ja corrigidas pela calibracao A4 escolhida.
  const calStringFreqs = useMemo(
    () => tuningNames.map((n) => stringFreq(n, refA4)),
    [tuningNames, refA4]
  );

  // ===== Modo por corda (manual) =====
  // Tocar no nome de uma corda trava a leitura naquela corda especifica;
  // tocar de novo (ou no chip "AUTO") volta para deteccao automatica.
  const [lockedStringIndex, setLockedStringIndex] = useState<number | null>(null);

  useEffect(() => {
    setLockedStringIndex(null);
  }, [selectedTuning]);

  const handleStringPress = useCallback((index: number) => {
    setLockedStringIndex((prev) => (prev === index ? null : index));
  }, []);

  const isLocked = lockedStringIndex !== null;

  const tuner = useStringTuner(frequency, confidence, calStringFreqs, lockedStringIndex);

  const activeStringIndex = tuner.index;
  const hasSignal = tuner.hasSignal;
  const displayCents = tuner.cents;
  const displayInTune = hasSignal && Math.abs(displayCents) < IN_TUNE_CENTS;

  // Nota exibida = a da corda ativa (ou travada)
  const label =
    activeStringIndex != null
      ? parseStringLabel(tuningNames[activeStringIndex])
      : null;
  const displayNote = label ? label.note : "-";
  const displayOctave = label ? label.octave : 0;
  const displayFrequency = hasSignal ? frequency : 0;

  // Indicador de acao no centro do anel
  // agudo (cents > 0) => AFROUXAR (baixa o tom) ; grave => APERTAR (sobe o tom)
  const action = !hasSignal
    ? null
    : displayInTune
      ? { text: "AFINADO", color: "#00E676", arrow: "" }
      : displayCents > 0
        ? { text: "AFROUXAR", color: "#FFB300", arrow: " ▼" }
        : { text: "APERTAR", color: "#FFB300", arrow: " ▲" };

  return (
    <View style={styles.wrapper}>
      {/* Nota + oitava (GRANDE) */}
      <View style={styles.noteRow}>
        <Text
          style={[
            styles.noteChar,
            {
              color: !hasSignal && !isLocked
                ? "#2A2A2A"
                : displayInTune
                  ? "#00E676"
                  : "#FFFFFF",
            },
          ]}
        >
          {hasSignal || isLocked ? displayNote : "–"}
        </Text>
        {(hasSignal || isLocked) && displayOctave > 0 && (
          <Text
            style={[
              styles.octaveChar,
              { color: displayInTune ? "#00C853" : "#00BCD4" },
            ]}
          >
            {displayOctave}
          </Text>
        )}
        <Text style={styles.freqTop}>
          {hasSignal ? `${displayFrequency.toFixed(1)} Hz` : ""}
        </Text>
      </View>

      {/* Area das cordas (ponta a ponta) + anel no fundo */}
      <View style={styles.stringArea}>
        {/* Anel central no FUNDO */}
        <View style={styles.ringLayer} pointerEvents="none">
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Defs>
              <LinearGradient id="ringGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0A0A0A" stopOpacity="0.85" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.85" />
              </LinearGradient>
            </Defs>
            <Circle
              cx={RING_CX}
              cy={RING_CY}
              r={RING_R}
              fill="url(#ringGrad)"
              stroke="#1F1F1F"
              strokeWidth={2}
            />
            <RingTicks />
            <Rect
              x={RING_CX - 2.5}
              y={RING_CY - RING_R - 2}
              width={5}
              height={20}
              rx={2.5}
              fill="#00E676"
            />
          </Svg>
        </View>

        {/* Cordas atravessam a tela toda, POR CIMA do anel */}
        <View style={styles.stringsLayer} pointerEvents="none">
          <StringLinesFullWidth
            centsValue={hasSignal ? displayCents : 0}
            tuningNames={tuningNames}
            activeStringIndex={activeStringIndex}
            hasSignal={hasSignal}
            lockedStringIndex={lockedStringIndex}
          />
        </View>

        {/* Toque no nome de uma corda para travar nela (modo manual) */}
        <StringHitTargets tuningNames={tuningNames} onStringPress={handleStringPress} />

        {/* Chip para voltar ao modo automatico */}
        {isLocked && (
          <TouchableOpacity
            style={styles.modeBadge}
            onPress={() => setLockedStringIndex(null)}
            activeOpacity={0.7}
          >
            <Text style={styles.modeBadgeText}>{"⤴"} AUTO</Text>
          </TouchableOpacity>
        )}

        {/* Indicador de acao (AFROUXAR / APERTAR / AFINADO) */}
        {action && (
          <View style={styles.actionWrap} pointerEvents="none">
            <Text style={[styles.actionText, { color: action.color }]}>
              {action.text}
              {action.arrow}
            </Text>
          </View>
        )}

        {/* Cents (numerico) no canto */}
        {hasSignal && (
          <View style={styles.centsCorner} pointerEvents="none">
            <Text
              style={[
                styles.centsCornerText,
                { color: displayInTune ? "#00E676" : "#FF5252" },
              ]}
            >
              {displayCents > 0 ? "+" : ""}
              {displayCents.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Seletor de afinacao */}
      <TouchableOpacity
        style={styles.tuningSelector}
        onPress={onTuningPress}
        activeOpacity={0.7}
      >
        <Text style={styles.tuningText}>{selectedTuning}</Text>
        <Text style={styles.tuningArrow}>{"▼"}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const PitchLabDisplay = memo(PitchLabDisplayComponent);

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", backgroundColor: "#000000" },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    width: RING_SIZE,
    justifyContent: "center",
  },
  noteChar: {
    fontSize: 110,
    fontWeight: "bold",
    lineHeight: 118,
    letterSpacing: -3,
  },
  octaveChar: {
    fontSize: 46,
    fontWeight: "600",
    marginTop: 16,
    marginLeft: 2,
  },
  freqTop: {
    position: "absolute",
    right: 0,
    top: 24,
    fontSize: 15,
    color: "#888888",
    letterSpacing: 0.3,
    fontWeight: "500",
  },
  stringArea: {
    width: STRING_AREA_WIDTH,
    height: RING_SIZE,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  stringsLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: STRING_AREA_WIDTH,
    height: RING_SIZE,
  },
  ringLayer: {
    position: "absolute",
    top: 0,
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  hitLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: STRING_AREA_WIDTH,
    height: RING_SIZE,
  },
  hitRow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: LOCK_HIT_HEIGHT,
  },
  modeBadge: {
    position: "absolute",
    top: 24,
    left: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#0D0D0D",
    borderWidth: 1,
    borderColor: "#333333",
  },
  modeBadgeText: {
    color: "#00E676",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  actionWrap: {
    position: "absolute",
    top: RING_CY - 16,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: 2,
  },
  centsCorner: { position: "absolute", top: 24, right: 24 },
  centsCornerText: { fontSize: 14, fontWeight: "bold", letterSpacing: 0.5 },
  tuningSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#222222",
  },
  tuningText: {
    color: "#CCCCCC",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  tuningArrow: { color: "#666666", fontSize: 11 },
});
