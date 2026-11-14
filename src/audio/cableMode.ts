/**
 * Modo cabo — logica pura, sem React nem Android (testavel com `npm test`).
 *
 * - hasCable: diz se ha entrada USB/fone plugada e disponivel.
 * - createDevicePoller: rele a lista de entradas de tempos em tempos, sem
 *   sobrepor leituras e sem parar se uma leitura falhar.
 */

export const CABLE_TYPES = ["usb", "wired_headset"];

export type AudioDeviceLike = { type: string; isAvailable: boolean };

export function hasCable(devices: AudioDeviceLike[]): boolean {
  return devices.some((d) => CABLE_TYPES.includes(d.type) && d.isAvailable);
}

export type DevicePoller = {
  start: () => void;
  stop: () => void;
};

export function createDevicePoller(
  refresh: () => Promise<unknown>,
  intervalMs: number,
): DevicePoller {
  let timer: ReturnType<typeof setInterval> | null = null;
  let busy = false;

  const tick = () => {
    if (busy) return; // leitura anterior ainda em andamento
    busy = true;
    let pending: Promise<unknown>;
    try {
      pending = Promise.resolve(refresh());
    } catch {
      busy = false;
      return;
    }
    pending
      .catch(() => {})
      .finally(() => {
        busy = false;
      });
  };

  return {
    start() {
      if (timer !== null) return;
      timer = setInterval(tick, intervalMs);
    },
    stop() {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    },
  };
}
