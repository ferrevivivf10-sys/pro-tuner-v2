/**
 * PitchLabDisplay v9 - v8 + suavizacao de exibicao
 * - Fundo OLED (#000000 puro)
 * - Nota grande (100px+)
 * - Linhas das cordas atravessam a tela toda (como um violao)
 * - Cada corda tem cor cromatica fixa por posicao; so a ativa brilha
 * - Deteccao da corda ativa pela menor distancia em cents (respeita afinacao)
 * - NOVO v9: hold da nota (600ms), media movel de cents, debounce de troca de nota (180ms)
 */

import React, { useEffect, useRef, memo, useMemo } from "react";
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
const STRING_CX = STRING_AREA_WIDTH / 2;

// ===== Parametros de SUAVIZACAO (v9) =====
const NOTE_HOLD_MS = 600;        // tempo que a nota permanece apos o som sumir
const NOTE_SWITCH_MS = 180;      // nova nota precisa persistir esse tempo p/ trocar
const CENTS_SMOOTH_SIZE = 5;     // media movel das ultimas N leituras de cents

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

// Frequencias de referencia (Hz) para cada nota de corda usada nas afinacoes
const STRING_FREQUENCIES: Record<string, number> = {
  E2: 82.41,
  A2: 110.0,
  D3: 146.83,
  G3: 196.0,
  B3: 246.94,
  E4: 329.63,
  D2: 73.42,
  G2: 98.0,
  C3: 130.81,
  F3: 174.61,
  A3: 220.0,
  D4: 293.66,
  G4: 392.0,
  Eb2: 77.78,
  Ab2: 103.83,
  Db3: 138.59,
  Gb3: 185.0,
  Bb3: 233.08,
  Eb4: 311.13,
};

interface PitchLabDisplayProps {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  inTune: boolean;
  confidence: number;
  selectedTuning: string;
  onTuningPress?: () => void;
}

// ===== Hook de suavizacao (v9) =====
// Recebe os dados crus do detector e devolve dados "suaves" para exibicao.
// Nao altera a deteccao em si, apenas o que aparece na tela.
function useSmoothedPitch(
  note: string,
  octave: number,
  frequency: number,
  cents: number,
  inTune: boolean
) {
  const [display, setDisplay] = React.useState({
    note: "-",
    octave: 0,
    frequency: 0,
    cents: 0,
    inTune: false,
    hasSignal: false,
  });

  const lastSignalAtRef = useRef(0);
  const candidateRef = useRef<{ key: string; since: number } | null>(null);
  const centsBufferRef = useRef<number[]>([]);
  const currentKeyRef = useRef("");
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const now = Date.now();
    const hasRawSignal = frequency > 50;

    if (hasRawSignal) {
      lastSignalAtRef.current = now;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      const incomingKey = note + octave;

      if (incomingKey === currentKeyRef.current) {
        // Mesma nota: so suaviza cents/frequencia (media movel)
        const buf = centsBufferRef.current;
        buf.push(cents);
        if (buf.length > CENTS_SMOOTH_SIZE) buf.shift();
        const avgCents = buf.reduce((a, b) => a + b, 0) / buf.length;

        candidateRef.current = null;
        setDisplay({
          note,
          octave,
          frequency,
          cents: avgCents,
          inTune,
          hasSignal: true,
        });
      } else {
        // Nota diferente: so troca se persistir por NOTE_SWITCH_MS
        if (
          !candidateRef.current ||
          candidateRef.current.key !== incomingKey
        ) {
          candidateRef.current = { key: incomingKey, since: now };
        } else if (now - candidateRef.current.since >= NOTE_SWITCH_MS) {
          // Confirmou a troca: reseta buffer p/ nao arrastar cents da nota antiga
          currentKeyRef.current = incomingKey;
          centsBufferRef.current = [cents];
          candidateRef.current = null;
          setDisplay({
            note,
            octave,
            frequency,
            cents,
            inTune,
            hasSignal: true,
          });
        }
        // Enquanto nao confirma, mantem a nota atual na tela (nao faz nada)
      }
    } else {
      // Sinal sumiu: segura a nota atual por NOTE_HOLD_MS antes de limpar
      candidateRef.current = null;
      if (!holdTimerRef.current && currentKeyRef.current !== "") {
        holdTimerRef.current = setTimeout(() => {
          currentKeyRef.current = "";
          centsBufferRef.current = [];
          holdTimerRef.current = null;
          setDisplay({
            note: "-",
            octave: 0,
            frequency: 0,
            cents: 0,
            inTune: false,
            hasSignal: false,
          });
        }, NOTE_HOLD_MS);
      }
    }
  }, [note, octave, frequency, cents, inTune]);

  // Primeira deteccao de todas (currentKey vazio): aceita direto
  useEffect(() => {
    if (frequency > 50 && currentKeyRef.current === "") {
      currentKeyRef.current = note + octave;
      centsBufferRef.current = [cents];
      candidateRef.current = null;
      setDisplay({
        note,
        octave,
        frequency,
        cents,
        inTune,
        hasSignal: true,
      });
    }
  }, [note, octave, frequency, cents, inTune]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return display;
}

// Escolhe a corda da afinacao ativa mais proxima da frequencia detectada,
// medindo distancia em cents (nao em Hz absolutos).
function getActiveStringIndex(
  frequency: number,
  tuningNames: string[]
): number | null {
  if (frequency <= 0) return null;

  let bestIndex: number | null = null;
  let bestDistance = Infinity;

  for (let i = 0; i < tuningNames.length; i++) {
    const target = STRING_FREQUENCIES[tuningNames[i]];
    if (!target) continue;
    const distCents = Math.abs(1200 * Math.log2(frequency / target));
    if (distCents < bestDistance) {
      bestDistance = distCents;
      bestIndex = i;
    }
  }

  // Guarda: ignora sinal lixo/harmonico longe de qualquer corda
  if (bestDistance > 150) return null;

  return bestIndex;
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
  }: {
    centsValue: number;
    tuningNames: string[];
    activeStringIndex: number | null;
    hasSignal: boolean;
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
          const displayColor = isActive ? stringColor : "#3C3C3C";

          // Curvatura so na corda ativa, proporcional aos cents
          const amplitude = isActive ? Math.min(Math.abs(centsValue), 22) : 0;
          const curve = amplitude * (centsValue > 0 ? -1 : 1);

          const path = `M ${x1} ${y} C ${x1 + width * 0.25} ${y + curve} ${
            x1 + width * 0.75
          } ${y + curve} ${x2} ${y}`;

          const strokeWidth = isActive ? 3 : 1.5;
          const opacity = isActive ? 1 : 0.45;

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
                fontSize={isActive ? "13" : "11"}
                fill={isActive ? displayColor : "#666666"}
                textAnchor="start"
                fontWeight={isActive ? "700" : "600"}
                opacity={isActive ? 1 : 0.7}
              >
                {stringName}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    );
  }
);

function PitchLabDisplayComponent({
  note,
  octave,
  frequency,
  cents,
  inTune,
  confidence,
  selectedTuning,
  onTuningPress,
}: PitchLabDisplayProps) {
  // ===== v9: tudo que aparece na tela vem da versao suavizada =====
  const smooth = useSmoothedPitch(note, octave, frequency, cents, inTune);

  const [inTuneVisible, setInTuneVisible] = React.useState(false);

  useEffect(() => {
    setInTuneVisible(smooth.inTune && smooth.hasSignal);
  }, [smooth.inTune, smooth.hasSignal]);

  const tuningNames =
    TUNING_STRING_NAMES[selectedTuning] ?? TUNING_STRING_NAMES.Standard;

  const hasSignal = smooth.hasSignal;
  const activeStringIndex = useMemo(
    () => getActiveStringIndex(smooth.frequency, tuningNames),
    [smooth.frequency, tuningNames]
  );

  const activeColor =
    activeStringIndex !== null ? STRING_COLORS[activeStringIndex] : "#FFFFFF";

  return (
    <View style={styles.wrapper}>
      {/* Nota + oitava (GRANDE) */}
      <View style={styles.noteRow}>
        <Text
          style={[
            styles.noteChar,
            { color: smooth.inTune && hasSignal ? "#00E676" : "#FFFFFF" },
          ]}
        >
          {hasSignal ? smooth.note : "-"}
        </Text>
        {hasSignal && smooth.octave > 0 && (
          <Text
            style={[
              styles.octaveChar,
              { color: smooth.inTune ? "#00C853" : "#00BCD4" },
            ]}
          >
            {smooth.octave}
          </Text>
        )}
        <Text style={styles.freqTop}>
          {hasSignal ? `${smooth.frequency.toFixed(1)} Hz` : ""}
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
            centsValue={hasSignal ? smooth.cents : 0}
            tuningNames={tuningNames}
            activeStringIndex={activeStringIndex}
            hasSignal={hasSignal}
          />
        </View>

        {/* IN TUNE */}
        {inTuneVisible && (
          <View style={styles.inTuneBadge} pointerEvents="none">
            <Text style={styles.inTuneText}>IN TUNE!</Text>
          </View>
        )}

        {/* Cents */}
        {hasSignal && (
          <View style={styles.centsCorner} pointerEvents="none">
            <Text
              style={[
                styles.centsCornerText,
                { color: smooth.inTune ? "#00E676" : "#FF5252" },
              ]}
            >
              {smooth.cents > 0 ? "+" : ""}
              {smooth.cents.toFixed(1)}
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
        <Text style={styles.tuningArrow}>{"\u25BC"}</Text>
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
  inTuneBadge: {
    position: "absolute",
    top: RING_CY - 20,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  inTuneText: {
    color: "#00E676",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 2.5,
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