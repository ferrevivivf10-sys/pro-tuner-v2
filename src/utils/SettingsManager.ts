/**
 * SettingsManager - Gerencia persistência completa de configurações do Pro Tuner
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_RING_STYLE,
  isRingStyle,
  type RingStyleName,
} from "../components/TunerDial";

export interface TunerSettings {
  refA4: number;
  selectedTuning: string;
  sensitivity: number;
  noiseThreshold: number;
  ringStyle: RingStyleName;
}

const STORAGE_KEY = "@pro_tuner_settings";

const DEFAULT_SETTINGS: TunerSettings = {
  refA4: 440,
  selectedTuning: "Standard",
  sensitivity: 0.7,
  noiseThreshold: 0.005,
  ringStyle: DEFAULT_RING_STYLE,
};

export class SettingsManager {
  static async loadSettings(): Promise<TunerSettings> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }

      const parsed = JSON.parse(raw);

      return {
        refA4:
          typeof parsed.refA4 === "number"
            ? parsed.refA4
            : DEFAULT_SETTINGS.refA4,
        selectedTuning:
          typeof parsed.selectedTuning === "string"
            ? parsed.selectedTuning
            : DEFAULT_SETTINGS.selectedTuning,
        sensitivity:
          typeof parsed.sensitivity === "number"
            ? parsed.sensitivity
            : DEFAULT_SETTINGS.sensitivity,
        noiseThreshold:
          typeof parsed.noiseThreshold === "number"
            ? parsed.noiseThreshold
            : DEFAULT_SETTINGS.noiseThreshold,
        // valida o nome: um estilo removido numa versao futura nao pode
        // quebrar o mostrador de quem ja tinha escolhido ele
        ringStyle:
          typeof parsed.ringStyle === "string" && isRingStyle(parsed.ringStyle)
            ? parsed.ringStyle
            : DEFAULT_SETTINGS.ringStyle,
      };
    } catch (error) {
      console.error("SettingsManager.loadSettings error:", error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  static async saveSettings(settings: TunerSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("SettingsManager.saveSettings error:", error);
    }
  }

  private static async updateField<K extends keyof TunerSettings>(
    key: K,
    value: TunerSettings[K]
  ): Promise<void> {
    const current = await this.loadSettings();
    const updated = { ...current, [key]: value };
    await this.saveSettings(updated);
  }

  static async setRefA4(value: number): Promise<void> {
    await this.updateField("refA4", value);
  }

  static async setTuning(tuning: string): Promise<void> {
    await this.updateField("selectedTuning", tuning);
  }

  static async setSensitivity(value: number): Promise<void> {
    await this.updateField("sensitivity", value);
  }

  static async setNoiseThreshold(value: number): Promise<void> {
    await this.updateField("noiseThreshold", value);
  }

  static async setRingStyle(value: RingStyleName): Promise<void> {
    await this.updateField("ringStyle", value);
  }
}