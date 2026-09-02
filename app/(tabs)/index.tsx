/**
 * TunerScreen — Tela principal do Pro Tuner (tema OLED puro)
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { PitchLabDisplay } from "@/src/components/PitchLabDisplay";
import { usePitchDetectorFinal } from "@/src/hooks/usePitchDetectorFinal";
import { SettingsManager, type TunerSettings } from "@/src/utils/SettingsManager";

const TUNING_OPTIONS = ["Standard", "DropD", "HalfStepDown", "FullStepDown", "OpenG"] as const;

export default function TunerScreen() {
  const [settings, setSettings] = useState<TunerSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const [tuningModalVisible, setTuningModalVisible] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loaded = await SettingsManager.loadSettings();
        setSettings(loaded);
        setIsLoading(false);
        setIsActive(true);
      } catch (error) {
        console.error("Erro ao carregar configuracoes:", error);
        Alert.alert("Erro", "Nao foi possivel carregar as configuracoes");
        setIsLoading(false);
      }
    };
    loadSettings();
  }, []);

  const pitchData = usePitchDetectorFinal(
    isActive,
    settings?.refA4 ?? 440,
    0.001,
    settings?.sensitivity ?? 0.8
  );

  const toggleTuner = useCallback(() => setIsActive((prev) => !prev), []);

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
            <Text style={styles.statusText}>{isActive ? "Ativo" : "Pausado"}</Text>
          </View>
          <Text style={styles.calibText}>A4 = {settings?.refA4 ?? 440} Hz</Text>
        </View>

        <View style={styles.displayArea}>
          <PitchLabDisplay
            frequency={pitchData.frequency}
            confidence={pitchData.confidence}
            refA4={settings?.refA4 ?? 440}
            selectedTuning={settings?.selectedTuning ?? "Standard"}
            onTuningPress={() => setTuningModalVisible(true)}
          />
        </View>

        <Text style={styles.methodText}>{pitchData.detectionMethod}</Text>

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
            <Text style={styles.modalTitle}>Selecionar Afinacao</Text>
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
                  {t}
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
