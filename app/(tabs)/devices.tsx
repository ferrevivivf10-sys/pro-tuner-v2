/**
 * Tela de teste (etapa 1 do cabo): lista as entradas de audio do aparelho.
 * Serve so para confirmar se o violao plugado via USB-C aparece.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useAudioDevices } from "@siteed/audio-studio";
import { ScreenContainer } from "@/components/screen-container";

export default function DevicesScreen() {
  const { devices, currentDevice, loading, error, refreshDevices } = useAudioDevices();

  return (
    <ScreenContainer containerClassName="bg-black">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Entradas de áudio</Text>
        <Text style={styles.subtitle}>
          Plugue o cabo e toque em Atualizar
        </Text>

        <Pressable style={styles.button} onPress={() => refreshDevices()}>
          <Text style={styles.buttonText}>Atualizar</Text>
        </Pressable>

        {loading && <Text style={styles.info}>Carregando...</Text>}
        {error && <Text style={styles.error}>Erro: {error.message}</Text>}
        {!loading && devices.length === 0 && (
          <Text style={styles.info}>Nenhum dispositivo encontrado</Text>
        )}

        {devices.map((d) => {
          const isCurrent = currentDevice?.id === d.id;
          return (
            <View key={d.id} style={[styles.card, isCurrent && styles.cardCurrent]}>
              <Text style={styles.name}>{d.name}</Text>
              <Text style={styles.line}>Tipo: {d.type}</Text>
              <Text style={styles.line}>ID: {d.id}</Text>
              <Text style={styles.line}>
                Padrão: {d.isDefault ? "sim" : "não"} · Disponível:{" "}
                {d.isAvailable ? "sim" : "não"}
              </Text>
              <Text style={styles.line}>
                Taxas: {d.capabilities?.sampleRates?.join(", ") || "-"}
              </Text>
              {isCurrent && <Text style={styles.badge}>EM USO</Text>}
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "700" },
  subtitle: { color: "#888888", fontSize: 14 },
  button: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  info: { color: "#888888", fontSize: 14 },
  error: { color: "#FF5555", fontSize: 14 },
  card: {
    backgroundColor: "#0D0D0D",
    borderColor: "#1A1A1A",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  cardCurrent: { borderColor: "#00C853" },
  name: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  line: { color: "#AAAAAA", fontSize: 13 },
  badge: { color: "#00C853", fontSize: 12, fontWeight: "700", marginTop: 4 },
});
