/**
 * TestRecorder — modo de teste (ligado em Ajustes).
 * Grava o audio exato que o detector recebeu + um registro de cada leitura,
 * e salva os dois arquivos (.wav e .csv) numa pasta escolhida pelo usuario.
 */
import * as FileSystem from "expo-file-system/legacy";
import { encode } from "base-64";

const SAMPLE_RATE = 44100;
export const TEST_MAX_SECONDS = 120;
const MAX_SAMPLES = SAMPLE_RATE * TEST_MAX_SECONDS;

let recording = false;
let pcm = new Int16Array(0);
let total = 0;
let rows: string[] = [];
let meta = "";

export const TestRecorder = {
  isRecording: () => recording,
  seconds: () => total / SAMPLE_RATE,

  start(info: string) {
    pcm = new Int16Array(MAX_SAMPLES);
    total = 0;
    rows = [];
    meta = info;
    recording = true;
  },

  stop() {
    recording = false;
  },

  // Chamado a cada bloco de audio que chega do microfone/cabo
  addSamples(samples: Float32Array) {
    if (!recording) return;
    const n = Math.min(samples.length, MAX_SAMPLES - total);
    for (let i = 0; i < n; i++) {
      const v = Math.max(-1, Math.min(1, samples[i]));
      pcm[total + i] = Math.round(v * 32767);
    }
    total += n;
    if (total >= MAX_SAMPLES) recording = false;
  },

  // Uma linha por leitura: amostra final da janela, volume, leitura crua, decisao
  logFrame(
    rms: number,
    rawFreq: number,
    clarity: number,
    status: string,
    outFreq: number,
  ) {
    if (!recording) return;
    rows.push(
      [
        total,
        rms.toFixed(5),
        rawFreq.toFixed(2),
        clarity.toFixed(3),
        status,
        outFreq.toFixed(2),
      ].join(","),
    );
  },

  // Salva .wav e .csv numa pasta escolhida (ex.: Download). Retorna false se cancelado.
  async save(): Promise<boolean> {
    recording = false;
    const SAF = FileSystem.StorageAccessFramework;
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;

    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    const name = "pro-tuner-teste-" + stamp;

    const wavUri = await SAF.createFileAsync(
      perm.directoryUri,
      name,
      "audio/wav",
    );
    await FileSystem.writeAsStringAsync(
      wavUri,
      wavBase64(pcm.subarray(0, total)),
      {
        encoding: FileSystem.EncodingType.Base64,
      },
    );

    const csv =
      "# " +
      meta +
      "\n" +
      "amostra_fim,rms,freq_crua,clareza,status,freq_saida\n" +
      rows.join("\n") +
      "\n";
    const csvUri = await SAF.createFileAsync(
      perm.directoryUri,
      name,
      "text/csv",
    );
    await FileSystem.writeAsStringAsync(csvUri, csv);
    return true;
  },
};

// WAV PCM 16-bit mono, codificado em base64 para gravar via SAF
function wavBase64(data: Int16Array): string {
  const bytes = new Uint8Array(44 + data.length * 2);
  const view = new DataView(bytes.buffer);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + data.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++)
    view.setInt16(44 + i * 2, data[i], true);

  // Converte em pedacos para nao estourar a pilha
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }
  return encode(binary);
}
