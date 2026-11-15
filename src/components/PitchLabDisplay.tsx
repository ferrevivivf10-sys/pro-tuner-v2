/**
 * PitchLabDisplay v10 - afinador por corda (com calibracao A4 correta)
 * - Fundo OLED (#000000 puro)
 * - A nota grande e a da CORDA ativa da afinacao (nao a cromatica mais proxima)
 * - Cents medidos contra a frequencia da corda, ja corrigida pela referencia A4
 * - Indicador de acao no centro: AFROUXAR (agudo) / APERTAR (grave) / AFINADO
 * - Linhas das cordas atravessam a tela toda; so a ativa brilha
 * - Trava manual: tocar no nome de uma corda fixa a leitura nela
 * - Suavizacao: hold da nota (400ms) e media movel de cents
 */

import React, {
  useEffect,
  useRef,
  memo,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import {
  dialLayout,
  stringY,
  BASE_RING_SIZE,
  STRING_COUNT,
  type DialLayout,
} from "./dialLayout";
import {
  TunerDial,
  ringAccent,
  DEFAULT_RING_STYLE,
  type RingStyleName,
} from "./TunerDial";
import { TUNING_LABELS, type TuningName } from "../utils/noteUtils";
import {
  centsBetween,
  confidenceThreshold,
  createCentsSmoother,
  parseStringLabel,
  pickTargetString,
  spokenStringName,
  stringFreq,
  isInTune,
  TUNING_STRING_NAMES,
} from "../utils/stringTuner";
import {
  createTuningProgress,
  type ProgressReading,
} from "../utils/tuningProgress";
import * as Haptics from "expo-haptics";
import Svg, {
  Path,
  Text as SvgText,
  Defs,
  Filter,
  FeGaussianBlur,
} from "react-native-svg";

// Medidas do aro e das cordas: calculadas pela largura da tela (dialLayout.ts)
const CHORD_COUNT = STRING_COUNT;

// ===== Parametros de SUAVIZACAO =====
const NOTE_HOLD_MS = 400; // tempo que a nota permanece apos o som sumir
const PROGRESS_TICK_MS = 100; // reavaliacao do progresso com nota firme

// Cor do aro: e FUNCIONAL, nao decorativa. Sem sinal fica apagado (nao faz
// sentido gritar "desafinado" com o app parado), vermelho enquanto desafinado
// e verde quando afina.

// Cores cromaticas fixas por POSICAO da corda (0 = mais grave ... 5 = mais aguda)
const STRING_COLORS = [
  "#1565FF", // corda 1 (grave) - azul
  "#FF3B3B", // corda 2 - vermelho
  "#27D86B", // corda 3 - verde
  "#FFB300", // corda 4 - ouro
  "#B14CFF", // corda 5 - roxo
  "#FF7A00", // corda 6 (aguda) - laranja
];

interface PitchLabDisplayProps {
  frequency: number;
  confidence: number;
  sensitivity: number;
  refA4: number;
  ringStyle: RingStyleName;
  selectedTuning: string;
  onTuningPress?: () => void;
  captureInvalid?: boolean; // captura irregular ou parada: limpa na hora, sem hold
}

// Numero da corda como o violonista conta: 6a = mais grave, 1a = mais aguda
function stringOrdinal(index: number): string {
  return CHORD_COUNT - index + "ª corda";
}

// ===== Hook do afinador por corda =====
// A partir da frequencia crua, escolhe a corda alvo (a travada manualmente ou a
// mais proxima em cents) e devolve os cents suavizados contra ela. Nao altera a
// deteccao, so o que aparece na tela. Segura o ultimo valor por NOTE_HOLD_MS
// depois que o som some, para nao piscar.
function useStringTuner(
  frequency: number,
  confidence: number,
  confidenceMin: number,
  calStringFreqs: number[],
  lockedIndex: number | null,
  captureInvalid: boolean,
) {
  const [display, setDisplay] = useState<{
    index: number | null;
    cents: number;
    hasSignal: boolean;
    inTune: boolean;
    tuned: number[]; // cordas ja afinadas (progresso "X de 6")
    allTuned: boolean;
    progressFor: number[]; // afinacao a que o progresso se refere
  }>({
    index: lockedIndex,
    cents: 0,
    hasSignal: false,
    inTune: false,
    tuned: [],
    allTuned: false,
    progressFor: calStringFreqs,
  });

  const smootherRef = useRef(createCentsSmoother());
  const inTuneRef = useRef(false);
  const progressRef = useRef(createTuningProgress(calStringFreqs.length));
  const progressForRef = useRef(calStringFreqs);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentIndexRef = useRef<number | null>(null);
  // Ultima leitura com nota: reavaliada a cada PROGRESS_TICK_MS, porque uma
  // nota firme pode repetir o mesmo valor e nao disparar o efeito abaixo
  const lastReadingRef = useRef<ProgressReading | null>(null);

  // Atualiza o progresso; vibra e redesenha so quando ele muda
  const applyProgress = useCallback((r: ProgressReading, now: number) => {
    const progress = progressRef.current;
    const ev = progress.update(r, now);
    if (ev.allTuned) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } else if (ev.stringTuned != null) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    return ev;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const r = lastReadingRef.current;
      if (!r) return;
      const ev = applyProgress(r, Date.now());
      if (ev.changed) {
        const progress = progressRef.current;
        setDisplay((d) => ({
          ...d,
          tuned: [...progress.tuned()],
          allTuned: progress.isComplete(),
          progressFor: progressForRef.current,
        }));
      }
    }, PROGRESS_TICK_MS);
    return () => clearInterval(id);
  }, [applyProgress]);

  // Troca de corda travada / afinacao: zera a suavizacao
  useEffect(() => {
    smootherRef.current.reset();
  }, [lockedIndex]);

  useEffect(() => {
    // Captura invalida: limpa na hora (o hold de NOTE_HOLD_MS e so para captura normal)
    if (captureInvalid) {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      currentIndexRef.current = null;
      lastReadingRef.current = null;
      smootherRef.current.reset();
      inTuneRef.current = false;
      setDisplay((d) => ({
        ...d,
        index: lockedIndex,
        cents: 0,
        hasSignal: false,
        inTune: false,
      }));
      return;
    }

    // Trocou a afinacao ou o A4: o progresso recomeca
    if (progressForRef.current !== calStringFreqs) {
      progressForRef.current = calStringFreqs;
      progressRef.current = createTuningProgress(calStringFreqs.length);
    }
    const progress = progressRef.current;
    const now = Date.now();

    // So conta como sinal se houver uma nota CLARA (evita travar em ruido ambiente)
    const hasRawSignal = frequency > 50 && confidence >= confidenceMin;

    if (hasRawSignal) {
      // Corda alvo: a travada, ou a mais proxima dentro da tolerancia
      const idx = pickTargetString(frequency, calStringFreqs, lockedIndex);

      if (idx != null) {
        if (holdTimerRef.current) {
          clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
        }
        if (idx !== currentIndexRef.current) {
          currentIndexRef.current = idx;
          smootherRef.current.reset();
          inTuneRef.current = false;
        }
        const avg = smootherRef.current.push(
          centsBetween(frequency, calStringFreqs[idx]),
        );
        const inTune = isInTune(avg, inTuneRef.current);
        inTuneRef.current = inTune;

        const reading: ProgressReading = {
          index: idx,
          inTune,
          cents: avg,
          hasSignal: true,
        };
        lastReadingRef.current = reading;
        // Vibra a cada corda afinada e mais forte ao completar todas
        applyProgress(reading, now);

        setDisplay({
          index: idx,
          cents: avg,
          hasSignal: true,
          inTune,
          tuned: [...progress.tuned()],
          allTuned: progress.isComplete(),
          progressFor: calStringFreqs,
        });
        return;
      }
      // Sinal presente mas longe de qualquer corda: cai para o hold abaixo
    }

    // Sem sinal (ou longe de tudo): segura por NOTE_HOLD_MS e entao limpa
    lastReadingRef.current = null;
    applyProgress(
      { index: null, inTune: false, cents: 0, hasSignal: false },
      now,
    );
    if (!holdTimerRef.current && currentIndexRef.current != null) {
      holdTimerRef.current = setTimeout(() => {
        currentIndexRef.current = null;
        smootherRef.current.reset();
        inTuneRef.current = false;
        holdTimerRef.current = null;
        setDisplay((d) => ({
          ...d,
          index: lockedIndex,
          cents: 0,
          hasSignal: false,
          inTune: false,
        }));
      }, NOTE_HOLD_MS);
    }
  }, [
    frequency,
    confidence,
    confidenceMin,
    calStringFreqs,
    lockedIndex,
    applyProgress,
    captureInvalid,
  ]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  return display;
}

// Linhas das cordas atravessando a tela toda
const StringLinesFullWidth = memo(
  ({
    centsValue,
    tuningNames,
    activeStringIndex,
    hasSignal,
    lockedStringIndex,
    layout,
    tunedStrings,
  }: {
    layout: DialLayout;
    tunedStrings: number[];
    centsValue: number;
    tuningNames: string[];
    activeStringIndex: number | null;
    hasSignal: boolean;
    lockedStringIndex: number | null;
  }) => {
    const x1 = 0;
    const x2 = layout.screenWidth;
    const width = layout.screenWidth;

    return (
      <Svg width={layout.screenWidth} height={layout.ringSize}>
        <Defs>
          <Filter id="glowActive" x="-20%" y="-50%" width="140%" height="200%">
            <FeGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </Filter>
        </Defs>

        {Array.from({ length: CHORD_COUNT }).map((_, i) => {
          const y = stringY(layout, i);
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
                fill={
                  isActive ? displayColor : isTargeted ? stringColor : "#666666"
                }
                textAnchor="start"
                fontWeight={isActive || isTargeted ? "700" : "600"}
                opacity={isActive ? 1 : isTargeted ? 0.9 : 0.7}
              >
                {stringName}
                {isTargeted && !isActive ? " •" : ""}
                {tunedStrings.includes(i) ? " ✓" : ""}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    );
  },
);
StringLinesFullWidth.displayName = "StringLinesFullWidth";

// Areas de toque invisiveis sobre cada corda, para ativar o modo manual.
// Fica numa camada separada da SVG (que e pointerEvents="none").
function StringHitTargets({
  tuningNames,
  lockedStringIndex,
  onStringPress,
  layout,
  tunedStrings,
}: {
  layout: DialLayout;
  tunedStrings: number[];
  tuningNames: string[];
  lockedStringIndex: number | null;
  onStringPress: (index: number) => void;
}) {
  return (
    <View
      style={[
        styles.hitLayer,
        { width: layout.screenWidth, height: layout.ringSize },
      ]}
      pointerEvents="box-none"
    >
      {tuningNames.map((name, i) => {
        const y = stringY(layout, i);
        const locked = lockedStringIndex === i;
        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.hitRow,
              { top: y - layout.hitHeight / 2, height: layout.hitHeight },
            ]}
            activeOpacity={0.5}
            onPress={() => onStringPress(i)}
            accessibilityRole="button"
            accessibilityLabel={
              stringOrdinal(i) +
              ", " +
              spokenStringName(name) +
              (tunedStrings.includes(i) ? ", afinada" : "")
            }
            accessibilityHint={
              locked
                ? "Toque para voltar à detecção automática"
                : "Toque para afinar só esta corda"
            }
            accessibilityState={{ selected: locked }}
          />
        );
      })}
    </View>
  );
}

function PitchLabDisplayComponent({
  frequency,
  confidence,
  sensitivity,
  refA4,
  ringStyle,
  selectedTuning,
  onTuningPress,
  captureInvalid = false,
}: PitchLabDisplayProps) {
  const tuningNames =
    TUNING_STRING_NAMES[selectedTuning] ?? TUNING_STRING_NAMES.Standard;

  // Encolhe o mostrador em telas estreitas (ver dialLayout.ts)
  const { width: windowWidth } = useWindowDimensions();
  const layout = useMemo(() => dialLayout(windowWidth), [windowWidth]);

  const confidenceMin = useMemo(
    () => confidenceThreshold(sensitivity),
    [sensitivity],
  );

  // Frequencias das cordas ja corrigidas pela calibracao A4 escolhida.
  const calStringFreqs = useMemo(
    () => tuningNames.map((n) => stringFreq(n, refA4)),
    [tuningNames, refA4],
  );

  // ===== Modo por corda (manual) =====
  // Tocar no nome de uma corda trava a leitura naquela corda especifica;
  // tocar de novo (ou no chip "AUTO") volta para deteccao automatica.
  // A trava vale so para a afinacao em que foi feita: trocar de afinacao
  // volta para o automatico (derivado no render, sem efeito)
  const [lock, setLock] = useState<{ tuning: string; index: number | null }>({
    tuning: selectedTuning,
    index: null,
  });
  const lockedStringIndex = lock.tuning === selectedTuning ? lock.index : null;

  const handleStringPress = useCallback(
    (index: number) => {
      setLock((prev) => ({
        tuning: selectedTuning,
        index:
          prev.tuning === selectedTuning && prev.index === index ? null : index,
      }));
    },
    [selectedTuning],
  );

  const isLocked = lockedStringIndex !== null;

  const tuner = useStringTuner(
    frequency,
    confidence,
    confidenceMin,
    calStringFreqs,
    lockedStringIndex,
    captureInvalid,
  );

  const activeStringIndex = tuner.index;
  const hasSignal = tuner.hasSignal;
  const displayCents = tuner.cents;
  const displayInTune = hasSignal && tuner.inTune;
  // Progresso so vale para a afinacao atual (some ao trocar, mesmo sem som)
  const progressValid = tuner.progressFor === calStringFreqs;
  const tunedStrings = progressValid ? tuner.tuned : [];
  const allTuned = progressValid && tuner.allTuned;

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
  const ACTION_STYLE = {
    AFINADO: { color: "#00E676", arrow: "" },
    AFROUXAR: { color: "#FFB300", arrow: " ▼" },
    APERTAR: { color: "#FFB300", arrow: " ▲" },
  } as const;
  const actionName = !hasSignal
    ? null
    : displayInTune
      ? "AFINADO"
      : displayCents > 0
        ? "AFROUXAR"
        : "APERTAR";
  const action = actionName
    ? { text: actionName, ...ACTION_STYLE[actionName] }
    : null;

  // Resumo para o leitor de tela. So muda quando muda a corda ou a acao (nao
  // a cada leitura de cents), para o TalkBack nao falar sem parar.
  const activeName =
    activeStringIndex != null
      ? spokenStringName(tuningNames[activeStringIndex])
      : "";
  const spokenSummary = hasSignal
    ? activeName + ", " + (action?.text.toLowerCase() ?? "")
    : isLocked
      ? "Corda travada: " + activeName + ". Toque a corda"
      : "Sem nota. Toque uma corda";
  const centsRounded = Math.round(displayCents);
  const spokenCents =
    centsRounded === 0
      ? "0 cents"
      : Math.abs(centsRounded) +
        (Math.abs(centsRounded) === 1 ? " cent " : " cents ") +
        (centsRounded > 0 ? "acima" : "abaixo");

  return (
    <View style={styles.wrapper}>
      {/* Nota + oitava (GRANDE). Para o leitor de tela vira um resumo falado
          que se anuncia sozinho quando muda (live region). */}
      <View
        style={[styles.noteRow, { width: layout.noteRowWidth }]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={spokenSummary}
        accessibilityLiveRegion="polite"
      >
        <Text
          maxFontSizeMultiplier={1}
          style={[
            styles.noteChar,
            {
              color:
                !hasSignal && !isLocked
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
            maxFontSizeMultiplier={1}
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
      <View
        style={[
          styles.stringArea,
          { width: layout.screenWidth, height: layout.ringSize },
        ]}
      >
        {/* Anel central no FUNDO (estatico, memoizado) */}
        <View
          style={[
            styles.ringLayer,
            { width: layout.ringSize, height: layout.ringSize },
          ]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <TunerDial
            outerR={layout.ringR}
            style={ringStyle ?? DEFAULT_RING_STYLE}
            accent={ringAccent(hasSignal, displayInTune)}
          />
        </View>

        {/* Cordas atravessam a tela toda, POR CIMA do anel */}
        <View
          style={[
            styles.stringsLayer,
            { width: layout.screenWidth, height: layout.ringSize },
          ]}
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <StringLinesFullWidth
            centsValue={hasSignal ? displayCents : 0}
            tuningNames={tuningNames}
            activeStringIndex={activeStringIndex}
            hasSignal={hasSignal}
            lockedStringIndex={lockedStringIndex}
            layout={layout}
            tunedStrings={tunedStrings}
          />
        </View>

        {/* Toque no nome de uma corda para travar nela (modo manual) */}
        <StringHitTargets
          tuningNames={tuningNames}
          lockedStringIndex={lockedStringIndex}
          onStringPress={handleStringPress}
          layout={layout}
          tunedStrings={tunedStrings}
        />

        {/* Chip para voltar ao modo automatico */}
        {isLocked && (
          <TouchableOpacity
            style={styles.modeBadge}
            onPress={() => setLock({ tuning: selectedTuning, index: null })}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Voltar à detecção automática da corda"
          >
            <Text style={styles.modeBadgeText}>{"⤴"} AUTO</Text>
          </TouchableOpacity>
        )}

        {/* Indicador de acao (AFROUXAR / APERTAR / AFINADO) */}
        {action && (
          <View
            style={[styles.actionWrap, { top: layout.ringCy - 16 }]}
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
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
              accessibilityLabel={spokenCents}
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

      {/* Progresso: X de 6 cordas afinadas */}
      <Text
        style={[styles.progressText, allTuned && styles.progressDone]}
        accessibilityLiveRegion="polite"
      >
        {allTuned
          ? "✓ Violão afinado!"
          : tunedStrings.length > 0
            ? tunedStrings.length + " de " + tuningNames.length + " afinadas"
            : " "}
      </Text>

      {/* Seletor de afinacao */}
      <TouchableOpacity
        style={styles.tuningSelector}
        onPress={onTuningPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          "Afinação: " +
          (TUNING_LABELS[selectedTuning as TuningName] ?? selectedTuning)
        }
        accessibilityHint="Abre a lista de afinações"
      >
        <Text style={styles.tuningText}>
          {TUNING_LABELS[selectedTuning as TuningName] ?? selectedTuning}
        </Text>
        <Text style={styles.tuningArrow}>{"▼"}</Text>
      </TouchableOpacity>
    </View>
  );
}

export const PitchLabDisplay = memo(PitchLabDisplayComponent);

const styles = StyleSheet.create({
  progressText: {
    color: "#8A8A8A",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 8,
    minHeight: 18,
  },
  progressDone: { color: "#00E676" },
  wrapper: { alignItems: "center", backgroundColor: "#000000" },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
    width: BASE_RING_SIZE,
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
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  stringsLayer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  ringLayer: {
    position: "absolute",
    top: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  hitLayer: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  hitRow: {
    position: "absolute",
    left: 0,
    right: 0,
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
