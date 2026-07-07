/**
 * SettingsScreen - Tela de configurações do Pro Tuner
 * Permite calibração A4 e seleção de afinações predefinidas
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { TUNINGS, type TuningName } from "@/src/utils/noteUtils";
import { SettingsManager } from "@/src/utils/SettingsManager";

const CALIBRATIONS = [432, 438, 440, 442, 444];

export default function SettingsScreen() {
  const [selectedCalib, setSelectedCalib] = useState(440);
  const [selectedTuning, setSelectedTuning] = useState<TuningName>("Standard");
  const [sensitivity, setSensitivity] = useState(0.8);
  const [noiseThreshold, setNoiseThreshold] = useState(0.02);

  // Carregar configurações salvas
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await SettingsManager.loadSettings();
        setSelectedCalib(settings.refA4);
        setSelectedTuning(settings.selectedTuning as TuningName);
        setSensitivity(settings.sensitivity);
        setNoiseThreshold(settings.noiseThreshold);
      } catch (error) {
        console.error("Erro ao carregar configurações:", error);
      }
    };

    loadSettings();
  }, []);

  // Salvar calibração
  const saveCalibration = async (value: number) => {
    try {
      await SettingsManager.setRefA4(value);
      setSelectedCalib(value);
      Alert.alert("✓ Calibração Salva", `Referência A4 definida para ${value} Hz`);
    } catch (error) {
      console.error("Erro ao salvar calibração:", error);
      Alert.alert("Erro", "Não foi possível salvar a calibração");
    }
  };

  // Salvar afinação
  const saveTuning = async (tuning: TuningName) => {
    try {
      await SettingsManager.setTuning(tuning);
      setSelectedTuning(tuning);
      Alert.alert("✓ Afinação Salva", `Modo: ${tuning}`);
    } catch (error) {
      console.error("Erro ao salvar afinação:", error);
      Alert.alert("Erro", "Não foi possível salvar a afinação");
    }
  };

  // Salvar sensibilidade
  const saveSensitivity = async (value: number) => {
    try {
      await SettingsManager.setSensitivity(value);
      setSensitivity(value);
    } catch (error) {
      console.error("Erro ao salvar sensibilidade:", error);
    }
  };

  // Salvar limiar de ruído
  const saveNoiseThreshold = async (value: number) => {
    try {
      await SettingsManager.setNoiseThreshold(value);
      setNoiseThreshold(value);
    } catch (error) {
      console.error("Erro ao salvar limiar de ruído:", error);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>⚙️ CONFIGURAÇÕES</Text>
        </View>

        {/* Seção de Calibração */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calibração A4</Text>
          <Text style={styles.sectionDescription}>
            Selecione a frequência de referência para o A4
          </Text>

          <View style={styles.optionsContainer}>
            {CALIBRATIONS.map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.optionButton,
                  selectedCalib === value && styles.optionButtonActive,
                ]}
                onPress={() => saveCalibration(value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedCalib === value && styles.optionTextActive,
                  ]}
                >
                  {value} Hz
                </Text>
                {selectedCalib === value && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Seção de Afinações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modo de Afinação</Text>
          <Text style={styles.sectionDescription}>
            Escolha o padrão de afinação para sua guitarra
          </Text>

          <View style={styles.tuningsContainer}>
            {(Object.keys(TUNINGS) as TuningName[]).map((tuningName) => (
              <TouchableOpacity
                key={tuningName}
                style={[
                  styles.tuningCard,
                  selectedTuning === tuningName && styles.tuningCardActive,
                ]}
                onPress={() => saveTuning(tuningName)}
              >
                <View style={styles.tuningHeader}>
                  <Text
                    style={[
                      styles.tuningName,
                      selectedTuning === tuningName &&
                        styles.tuningNameActive,
                    ]}
                  >
                    {tuningName}
                  </Text>
                  {selectedTuning === tuningName && (
                    <Text style={styles.tuningCheckmark}>✓</Text>
                  )}
                </View>

                {/* Frequências das cordas */}
                <View style={styles.stringFrequencies}>
                  {TUNINGS[tuningName].map((freq, idx) => (
                    <View key={idx} style={styles.stringFreq}>
                      <Text style={styles.stringLabel}>
                        {idx + 1}
                      </Text>
                      <Text style={styles.stringFreqValue}>
                        {freq.toFixed(1)}
                      </Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Informações */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>ℹ️ Informações</Text>
          <Text style={styles.infoText}>
            • A calibração padrão é 440 Hz (A4){"\n"}
            • Afinação padrão para guitarra é Standard{"\n"}
            • Altere conforme necessário para seu instrumento
          </Text>
        </View>

        {/* Versão */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Pro Tuner v1.0.0</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#00E676",
    letterSpacing: 2,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    letterSpacing: 1,
  },
  sectionDescription: {
    fontSize: 12,
    color: "#888888",
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionButton: {
    flex: 1,
    minWidth: "45%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  optionButtonActive: {
    borderColor: "#00E676",
    backgroundColor: "#0D1A0D",
  },
  optionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#CCCCCC",
  },
  optionTextActive: {
    color: "#00E676",
  },
  checkmark: {
    fontSize: 16,
    color: "#00E676",
  },
  tuningsContainer: {
    gap: 12,
  },
  tuningCard: {
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333333",
  },
  tuningCardActive: {
    borderColor: "#00E676",
    backgroundColor: "#0D1A0D",
  },
  tuningHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tuningName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#CCCCCC",
  },
  tuningNameActive: {
    color: "#00E676",
  },
  tuningCheckmark: {
    fontSize: 18,
    color: "#00E676",
  },
  stringFrequencies: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  stringFreq: {
    alignItems: "center",
    flex: 1,
  },
  stringLabel: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 4,
  },
  stringFreqValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#00E676",
  },
  infoSection: {
    backgroundColor: "#1A1A1A",
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#FF9800",
    marginTop: 24,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: "#CCCCCC",
    lineHeight: 18,
  },
  footer: {
    alignItems: "center",
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  versionText: {
    fontSize: 11,
    color: "#666666",
  },
});
