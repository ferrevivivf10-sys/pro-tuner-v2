/**
 * Entradas de audio — subtela de Ajustes.
 * Mostra se o cabo foi detectado e quais entradas o aparelho oferece.
 */
import React from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useAudioDevices } from "@siteed/audio-studio";
import { ScreenContainer } from "@/components/screen-container";

// Mesmos tipos usados pelo modo cabo no afinador
const CABLE_TYPES = ["usb", "wired_headset"];

const TYPE_LABELS: Record<string, string> = {
  builtin_mic: "Microfone do celular",
  usb: "Cabo USB",
  wired_headset: "Fone / cabo P2",
  bluetooth: "Bluetooth",
};

export default function AudioInputsScreen() {
  const { devices, loading, error, refreshDevices } = useAudioDevices();

  const cable = devices.find((d) => CABLE_TYPES.includes(d.type) && d.isAvailable);
  // Entradas internas repetidas (tipo "unknown") nao ajudam o usuario
  const visible = devices.filter((d) => d.type in TYPE_LABELS && d.isAvailable);
  const builtin = visible.find((d) => d.type === "builtin_mic");
  const inUseId = cable?.id ?? builtin?.id;
  const list = [
    ...visible.filter((d) => d.type !== "builtin_mic"),
    ...(builtin ? [builtin] : []),
  ];

  return (
    <ScreenContainer containerClassName="bg-black">
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.back}>‹ Ajustes</Text>
        </Pressable>

        <Text style={styles.title}>Entradas de áudio</Text>

        <View style={[styles.status, cable ? styles.statusCable : styles.statusMic]}>
          <Text style={[styles.statusTitle, cable && styles.statusTitleCable]}>
            {cable ? "Cabo detectado" : "Usando o microfone do celular"}
          </Text>
          <Text style={styles.statusText}>
            {cable
              ? "O afinador ajusta os filtros sozinho para o cabo."
              : "Plugue o cabo do instrumento na entrada USB-C para afinar sem ruído do ambiente."}
          </Text>
        </View>

        {loading && <Text style={styles.info}>Carregando...</Text>}
        {error && <Text style={styles.error}>Não foi possível ler as entradas.</Text>}

        {list.map((d) => {
          const inUse = d.id === inUseId;
          return (
            <View key={d.id} style={[styles.card, inUse && styles.cardInUse]}>
              <View style={styles.cardRow}>
                <Text style={styles.name}>{TYPE_LABELS[d.type]}</Text>
                {inUse && <Text style={styles.badge}>EM USO</Text>}
              </View>
              <Text style={styles.detail} numberOfLines={1}>{d.name}</Text>
            </View>
          );
        })}

        <Pressable
          style={styles.button}
          onPress={() => refreshDevices()}
          accessibilityRole="button"
          accessibilityLabel="Atualizar lista de entradas"
        >
          <Text style={styles.buttonText}>Atualizar</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  back: { color: "#00E676", fontSize: 16, fontWeight: "600" },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginTop: 4 },
  status: { borderRadius: 10, padding: 14, gap: 4, borderWidth: 1 },
  statusMic: { backgroundColor: "#0D0D0D", borderColor: "#1A1A1A" },
  statusCable: { backgroundColor: "#0A1A0A", borderColor: "#00E676" },
  statusTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  statusTitleCable: { color: "#00E676" },
  statusText: { color: "#AAAAAA", fontSize: 13 },
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
  cardInUse: { borderColor: "#00C853" },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  detail: { color: "#777777", fontSize: 12 },
  badge: { color: "#00C853", fontSize: 11, fontWeight: "700" },
  button: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
});
