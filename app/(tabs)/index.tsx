/**
 * TunerScreen — Tela principal do Pro Tuner (tema OLED puro)
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  AppState,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useAudioDevices } from "@siteed/audio-studio";
import { ScreenContainer } from "@/components/screen-container";
import { PitchLabDisplay } from "@/src/components/PitchLabDisplay";
import { DEFAULT_RING_STYLE } from "@/src/components/TunerDial";
import { usePitchDetectorFinal } from "@/src/hooks/usePitchDetectorFinal";
import { SettingsManager, type TunerSettings } from "@/src/utils/SettingsManager";
import { TUNINGS, TUNING_LABELS, type TuningName } from "@/src/utils/noteUtils";
import Constants from "expo-constants";
import { TestRecorder, TEST_MAX_SECONDS } from "@/src/audio/TestRecorder";

const KEEP_AWAKE_TAG = "pro-tuner";
const TUNING_OPTIONS = ["Standard", "DropD", "HalfStepDown", "FullStepDown", "OpenG"] as const;

// Modo cabo: entrada USB/fone plugada. Sem ruido ambiente, entao usa
// limites fixos medidos no violao (chiado ~0.0013 RMS / clareza <= 0.36;
// nota real >= 0.014 RMS / clareza >= 0.82).
const CABLE_TYPES = ["usb", "wired_headset"];
const MIC_NOISE_THRESHOLD = 0.0025; // silencio do mic ~0.0003; nota fraca >= 0.004
const CABLE_NOISE_THRESHOLD = 0.003;
const CABLE_SENSITIVITY = 0.5; // equivale a clareza minima de 0.6

export default function TunerScreen() {
  const [settings, setSettings] = useState<TunerSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [tuningModalVisible, setTuningModalVisible] = useState(false);
  const [testSeconds, setTestSeconds] = useState<number | null>(null);
  const [testSaving, setTestSaving] = useState(false);
  const testTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [appInForeground, setAppInForeground] = useState(AppState.currentState === "active");
  const [tabFocused, setTabFocused] = useState(true);

  const { devices, refreshDevices } = useAudioDevices();

  // Libera o microfone quando o app sai da tela. Ao voltar, rele as entradas:
  // o aviso de cabo plugado se perde com o app em segundo plano.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setAppInForeground(state === "active");
      if (state === "active") refreshDevices().catch(() => {});
    });
    return () => sub.remove();
  }, [refreshDevices]);

  // Microfone so fica ligado com a aba do afinador aberta
  useFocusEffect(
    useCallback(() => {
      setTabFocused(true);
      refreshDevices().catch(() => {});
      return () => setTabFocused(false);
    }, [refreshDevices])
  );

  const loadSettings = useCallback(async () => {
    const loaded = await SettingsManager.loadSettings();
    setSettings(loaded);
    return loaded;
  }, []);

  // Carga inicial
  useEffect(() => {
    loadSettings()
      .then(() => {
        setIsActive(true);
      })
      .catch((error) => {
        console.error("Erro ao carregar configuracoes:", error);
        Alert.alert("Erro", "Nao foi possivel carregar as configuracoes");
      })
      .finally(() => setIsLoading(false));
  }, [loadSettings]);

  // Recarrega ao voltar para a aba (as abas nao desmontam, entao mudancas
  // feitas em Settings — A4, afinacao, sensibilidade — precisam ser relidas).
  useFocusEffect(
    useCallback(() => {
      loadSettings().catch((error) =>
        console.error("Erro ao recarregar configuracoes:", error)
      );
    }, [loadSettings])
  );

  const isCable = devices.some((d) => CABLE_TYPES.includes(d.type) && d.isAvailable);
  const sensitivity = isCable ? CABLE_SENSITIVITY : settings?.sensitivity ?? 0.7;

  const testMode = settings?.testMode ?? false;
  const testLowpass = testMode && !isCable && (settings?.testLowpass ?? false);

  // Cordas da afinacao escolhida, corrigidas pelo A4
  const refA4 = settings?.refA4 ?? 440;
  const selectedTuning = settings?.selectedTuning ?? "Standard";
  const stringFreqs = useMemo(
    () => (TUNINGS[selectedTuning as TuningName] ?? TUNINGS.Standard).map((f) => (f * refA4) / 440),
    [selectedTuning, refA4]
  );

  const pitchData = usePitchDetectorFinal(
    isActive && appInForeground && tabFocused,
    refA4,
    isCable ? CABLE_NOISE_THRESHOLD : MIC_NOISE_THRESHOLD,
    sensitivity,
    !isCable, // estabilidade so no microfone
    stringFreqs,
    testLowpass
  );

  // Tela sempre ligada enquanto o afinador esta ativo e nesta aba
  useFocusEffect(
    useCallback(() => {
      if (!isActive) return;
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
      return () => {
        deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      };
    }, [isActive])
  );

  const toggleTuner = useCallback(() => setIsActive((prev) => !prev), []);

  // DIAGNOSTICO: salva audio + registro e avisa o resultado
  const finishTest = useCallback(async () => {
    if (testTimerRef.current) clearInterval(testTimerRef.current);
    testTimerRef.current = null;
    TestRecorder.stop();
    setTestSeconds(null);
    setTestSaving(true);
    try {
      const ok = await TestRecorder.save();
      Alert.alert(ok ? "Teste salvo" : "Teste não salvo", ok
        ? "Os arquivos .wav e .csv estão na pasta escolhida."
        : "Nenhuma pasta foi escolhida.");
    } catch (e) {
      Alert.alert("Erro ao salvar", e instanceof Error ? e.message : String(e));
    } finally {
      setTestSaving(false);
    }
  }, []);

  const toggleTest = useCallback(() => {
    if (TestRecorder.isRecording() || testTimerRef.current) {
      finishTest();
      return;
    }
    if (!isActive) setIsActive(true);
    TestRecorder.start(
      "versao=" + (Constants.expoConfig?.version ?? "?") +
      " modo=" + (isCable ? "cabo" : "mic") +
      " sensibilidade=" + sensitivity +
      " filtro=" + (testLowpass ? "1500" : "nao") +
      " a4=" + (settings?.refA4 ?? 440) +
      " data=" + new Date().toISOString()
    );
    setTestSeconds(0);
    testTimerRef.current = setInterval(() => {
      if (!TestRecorder.isRecording()) {
        finishTest(); // chegou no limite de tempo
        return;
      }
      setTestSeconds(TestRecorder.seconds());
    }, 500);
  }, [isActive, isCable, sensitivity, settings, testLowpass, finishTest]);

  const selectTuning = useCallback(async (tuning: string) => {
    try {
      await SettingsManager.setTuning(tuning as any);
      setSettings((prev) => (prev ? { ...prev, selectedTuning: tuning } : prev));
      setTuningModalVisible(false);
    } catch (e) {
      Alert.alert("Erro", "Nao foi possivel salvar a afinacao");
    }
  }, []);

  if (isLoading) {
    return (
      <ScreenContainer containerClassName="bg-black">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00E676" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-black">
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: isActive ? "#00E676" : "#555" }]} />
            <Text style={styles.statusText}>
              {isActive ? "Ativo" : "Pausado"}
              {isCable ? " · Cabo" : ""}
            </Text>
          </View>
          <Text style={styles.calibText}>A4 = {settings?.refA4 ?? 440} Hz</Text>
        </View>

        <View style={styles.displayArea}>
          <PitchLabDisplay
            frequency={pitchData.frequency}
            confidence={pitchData.confidence}
            sensitivity={sensitivity}
            refA4={settings?.refA4 ?? 440}
            ringStyle={settings?.ringStyle ?? DEFAULT_RING_STYLE}
            selectedTuning={settings?.selectedTuning ?? "Standard"}
            onTuningPress={() => setTuningModalVisible(true)}
          />
        </View>

        {/* Modo de teste (Ajustes): dados da captacao + gravar audio e leituras */}
        {(testMode || testSeconds !== null || testSaving) && (
          <>
            <Text style={styles.methodText}>{pitchData.detectionMethod}</Text>
            <TouchableOpacity
              style={[styles.testBtn, testSeconds !== null && styles.testBtnOn]}
              onPress={toggleTest}
              disabled={testSaving}
            >
              <Text style={[styles.testBtnText, testSeconds !== null && styles.testBtnTextOn]}>
                {testSaving
                  ? "SALVANDO..."
                  : testSeconds !== null
                    ? "■ PARAR E SALVAR  " + Math.floor(testSeconds) + "s / " + TEST_MAX_SECONDS + "s"
                    : "● GRAVAR TESTE"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Linha divisória fina antes da área de controle */}
        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.toggleBtn, isActive && styles.toggleBtnActive]}
          onPress={toggleTuner}
          activeOpacity={0.8}
        >
          <Text style={styles.toggleBtnText}>
            {isActive ? "PAUSAR" : "RETOMAR"}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={tuningModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTuningModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setTuningModalVisible(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Selecionar Afinação</Text>
            {TUNING_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[
                  styles.modalItem,
                  (settings?.selectedTuning ?? "Standard") === t && styles.modalItemActive,
                ]}
                onPress={() => selectTuning(t)}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    (settings?.selectedTuning ?? "Standard") === t && styles.modalItemTextActive,
                  ]}
                >
                  {TUNING_LABELS[t as TuningName]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", paddingTop: 16, paddingBottom: 32, paddingHorizontal: 16, backgroundColor: "#000000" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, backgroundColor: "#000000" },
  loadingText: { color: "#CCCCCC", fontSize: 14 },
  header: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { color: "#888", fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  calibText: { color: "#555", fontSize: 11, letterSpacing: 0.5 },
  displayArea: { flex: 1, justifyContent: "center", alignItems: "center" },
  testBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: "#333", marginBottom: 12 },
  testBtnOn: { borderColor: "#FF5252" },
  testBtnText: { color: "#777", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  testBtnTextOn: { color: "#FF5252" },
  methodText: { color: "#444", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 16, marginTop: 8 },
  divider: { width: "60%", height: 1, backgroundColor: "#1A1A1A", marginBottom: 20 },
  toggleBtn: { backgroundColor: "#0A0A0A", paddingHorizontal: 48, paddingVertical: 14, borderRadius: 32, borderWidth: 1.5, borderColor: "#333" },
  toggleBtnActive: { borderColor: "#00E676", backgroundColor: "#0A1A0A" },
  toggleBtnText: { color: "#FFF", fontSize: 13, fontWeight: "bold", letterSpacing: 1.5 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#0A0A0A", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, gap: 8, borderTopWidth: 1, borderColor: "#1F1F1F" },
  modalTitle: { color: "#AAAAAA", fontSize: 12, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 },
  modalItem: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#121212", borderWidth: 1, borderColor: "#1F1F1F" },
  modalItemActive: { borderColor: "#00E676", backgroundColor: "#0A1A0A" },
  modalItemText: { color: "#CCCCCC", fontSize: 15, fontWeight: "600" },
  modalItemTextActive: { color: "#00E676" },
});
