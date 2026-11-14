import { useState, useEffect, useRef } from "react";
import { PermissionsAndroid } from "react-native";
import { decode } from "base-64";
import { useAudioRecorder } from "@siteed/audio-studio";
import { MPMProcessor } from "../audio/MPMProcessor";
import { TestRecorder } from "../audio/TestRecorder";
import { createRateMonitor, EXPECTED_RATE } from "../audio/rateMonitor";
import { NOTES } from "../utils/noteUtils";

export interface PitchData {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  inTune: boolean;
  confidence: number;
  detectionMethod: string;
  captureWarning?: string; // captura com problema: a nota nao e mostrada
}

const INITIAL_PITCH_DATA: PitchData = {
  note: "-",
  octave: 0,
  frequency: 0,
  cents: 0,
  inTune: false,
  confidence: 0,
  detectionMethod: "Aguardando...",
};

const SAMPLE_RATE = 44100;
const STALL_CHECK_MS = 500; // de quanto em quanto tempo confere se a captura parou
const STALL_WARNING = "Captura parada: o microfone não está enviando áudio";
const BUFFER_SIZE = 2048;
const HOP_SIZE = 1024; // 50% de sobreposicao: detecta 2x mais vezes que o buffer avanca
const MAX_BUFFER = BUFFER_SIZE * 2;
const UI_UPDATE_MIN_INTERVAL_MS = 50; // limita re-render, nunca a deteccao em si

// Estabilidade (modo microfone): descarta leituras isoladas de ruido,
// ataque da corda e pulos de oitava. Valores medidos nos testes com ruido.
const SAME_NOTE_CENTS = 50;     // leituras dentro disso contam como a mesma nota
const CONFIRM_FRAMES = 2;       // leituras seguidas para trocar de nota
const OCTAVE_CONFIRM_FRAMES = 3; // pulo de oitava exige mais confirmacao
const HOLD_MS = 200;            // segura a nota exibida apos o som sumir
const HOLD_SOUND_MS = 600;      // segura mais se ainda ha som (leitura suja por ruido)
const FOLD_STRING_CENTS = 150;  // a dobra de oitava so vale se a nota estavel for uma corda da afinacao
const MIC_MAX_FREQ = 700;       // acima disso e ruido do ambiente (Mi agudo na 12a casa = 659 Hz)

// Clareza minima no mic conforme a sensibilidade escolhida.
// Ruido/voz medidos ficam abaixo de ~0.75.
function micMinClarity(sensitivity: number): number {
  if (sensitivity >= 0.85) return 0.65; // Alta: pega notas fracas (ambiente silencioso)
  if (sensitivity >= 0.55) return 0.75; // Media: equilibrio
  return 0.85;                          // Baixa: so notas bem limpas (muito ruido)
}

function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}

// Filtro passa-baixa de 2a ordem (biquad Butterworth), opcional no modo de teste.
const LOWPASS_HZ = 1500;
const LP = (() => {
  const w0 = (2 * Math.PI * LOWPASS_HZ) / SAMPLE_RATE;
  const c = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const a0 = 1 + alpha;
  return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, a1: (-2 * c) / a0, a2: (1 - alpha) / a0 };
})();

// Junta o bloco novo ao buffer, mantendo so as ultimas MAX_BUFFER amostras
function appendTail(prev: Float32Array, samples: Float32Array): Float32Array {
  const len = prev.length + samples.length;
  const combined = new Float32Array(len);
  combined.set(prev, 0);
  combined.set(samples, prev.length);
  return len > MAX_BUFFER ? combined.slice(len - MAX_BUFFER) : combined;
}

function isOctaveJump(a: number, b: number): boolean {
  return Math.abs(Math.abs(centsBetween(a, b)) - 1200) < SAME_NOTE_CENTS;
}

function calculateCentsToTarget(detectedFreq: number, targetFreq: number): number {
  if (detectedFreq <= 0 || targetFreq <= 0) return 0;
  return 1200 * Math.log2(detectedFreq / targetFreq);
}

function getNoteInfo(frequency: number, refA4: number) {
  if (frequency <= 0) return null;

  const n = 12 * Math.log2(frequency / refA4) + 69;
  const midi = Math.round(n);

  const noteName = NOTES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;

  const targetFreq = refA4 * Math.pow(2, (midi - 69) / 12);

  return { noteName, octave, targetFreq };
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = decode(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);

  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }

  return float32;
}

export function usePitchDetectorFinal(
  isActive: boolean,
  refA4: number = 440,
  noiseThreshold: number = 0.001,
  sensitivity: number = 0.8,
  stabilize: boolean = false,
  stringFreqs: number[] = [], // cordas da afinacao (Hz, ja com o A4 escolhido)
  lowpass: boolean = false    // modo de teste: filtra o audio antes do detector
): PitchData {
  const [pitchData, setPitchData] = useState<PitchData>(INITIAL_PITCH_DATA);

  const isActiveRef = useRef(isActive);
  const bufferRef = useRef<Float32Array>(new Float32Array(0));
  const lastUpdateRef = useRef(0);
  const lastChunkLenRef = useRef(0); // DIAGNOSTICO: amostras por callback
  const stableFreqRef = useRef(0);   // ultima nota aceita (Hz)
  const candFreqRef = useRef(0);     // candidata a nova nota (Hz)
  const candCountRef = useRef(0);    // leituras seguidas da candidata
  const lastAcceptRef = useRef(0);   // quando a ultima leitura foi aceita
  const stringFreqsRef = useRef(stringFreqs);
  const lowpassRef = useRef(lowpass);
  const filteredRef = useRef<Float32Array>(new Float32Array(0)); // mesmo buffer, filtrado
  const lpStateRef = useRef({ x1: 0, x2: 0, y1: 0, y2: 0 });
  const rateMonitorRef = useRef(createRateMonitor()); // taxa de entrega de amostras

  const { startRecording, stopRecording } = useAudioRecorder();

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Lidos por ref para nao reiniciar a gravacao quando mudam
  stringFreqsRef.current = stringFreqs;
  lowpassRef.current = lowpass;

  useEffect(() => {
    if (!isActive) return;

    let cancelled = false;

    // Monitor da taxa de entrega: recomeca a cada captura e confere se ela parou
    rateMonitorRef.current.reset();
    const stallTimer = setInterval(() => {
      if (rateMonitorRef.current.check(performance.now()).status !== "parado") return;
      stableFreqRef.current = 0;
      candCountRef.current = 0;
      setPitchData((p) =>
        p.captureWarning === STALL_WARNING
          ? p
          : { ...p, note: "-", frequency: 0, confidence: 0, captureWarning: STALL_WARNING }
      );
    }, STALL_CHECK_MS);

    const start = async () => {
      try {
        // Pede so o microfone (a lib pediria Bluetooth junto, que o app nao usa).
        // So abre o pedido se ainda nao tiver: o dialogo pausa o app.
        const MIC = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
        const granted =
          (await PermissionsAndroid.check(MIC)) ||
          (await PermissionsAndroid.request(MIC)) === PermissionsAndroid.RESULTS.GRANTED;

        if (!granted || cancelled) {
          setPitchData({
            note: "MIC?",
            octave: 0,
            frequency: 0,
            cents: 0,
            inTune: false,
            confidence: 0,
            detectionMethod: "Permissao negada",
          });
          return;
        }

        await startRecording({
          sampleRate: SAMPLE_RATE,
          channels: 1,
          encoding: "pcm_16bit",
          interval: 100,
          keepAwake: false, // nao grava em segundo plano

          onAudioStream: async (event: any) => {
            if (!isActiveRef.current) return;
            if (!event?.data) return;

            const samples = base64ToFloat32(event.data);
            lastChunkLenRef.current = samples.length;
            TestRecorder.addSamples(samples); // DIAGNOSTICO: so grava se o teste estiver ligado

            // Taxa de entrega fora do esperado: avisa e nao mostra nota (nao corrige a frequencia)
            const rate = rateMonitorRef.current.push(samples.length, performance.now());
            TestRecorder.setDeliveryRate(rate.rate);
            if (rate.status === "fora" && rate.rate !== null) {
              const warning =
                "Captura irregular: " + Math.round(rate.rate) + " amostras/s (esperado " + EXPECTED_RATE + ")";
              bufferRef.current = new Float32Array(0);
              filteredRef.current = new Float32Array(0);
              stableFreqRef.current = 0;
              candCountRef.current = 0;
              setPitchData((p) =>
                p.captureWarning === warning
                  ? p
                  : { ...p, note: "-", frequency: 0, confidence: 0, captureWarning: warning }
              );
              return;
            }
            setPitchData((p) => (p.captureWarning ? { ...p, captureWarning: undefined } : p));

            // Copia filtrada do mesmo bloco (o estado do filtro continua entre blocos)
            const filtered = new Float32Array(samples.length);
            const lp = lpStateRef.current;
            for (let i = 0; i < samples.length; i++) {
              const x = samples[i];
              const y = LP.b0 * x + LP.b1 * lp.x1 + LP.b0 * lp.x2 - LP.a1 * lp.y1 - LP.a2 * lp.y2;
              lp.x2 = lp.x1;
              lp.x1 = x;
              lp.y2 = lp.y1;
              lp.y1 = y;
              filtered[i] = y;
            }

            bufferRef.current = appendTail(bufferRef.current, samples);
            filteredRef.current = appendTail(filteredRef.current, filtered);

            // Processa APENAS a janela mais recente. Antes este trecho varria
            // todas as janelas sobrepostas do buffer (~4 por callback), o que
            // multiplicava por 4 o custo da NSDF e saturava a thread JS
            // (travando toques e captacao). Para o que aparece na tela, so a
            // janela mais recente importa.
            const buf = bufferRef.current;
            if (buf.length >= BUFFER_SIZE) {
              const chunk = buf.subarray(buf.length - BUFFER_SIZE);
              const fbuf = filteredRef.current;
              // O detector le o audio filtrado so se o filtro estiver ligado;
              // o volume (RMS) e sempre medido no audio original.
              const detChunk =
                lowpassRef.current && fbuf.length === buf.length
                  ? fbuf.subarray(fbuf.length - BUFFER_SIZE)
                  : chunk;
              // Mantem um rabo do buffer para a proxima janela ter sobreposicao
              bufferRef.current = buf.slice(buf.length - HOP_SIZE);
              filteredRef.current = fbuf.slice(Math.max(0, fbuf.length - HOP_SIZE));

              let sumSq = 0;
              for (let i = 0; i < chunk.length; i++) {
                sumSq += chunk[i] * chunk[i];
              }
              const rms = Math.sqrt(sumSq / chunk.length);

              const now = Date.now();
              const canRender = now - lastUpdateRef.current >= UI_UPDATE_MIN_INTERVAL_MS;

              const diag = (prefix: string, clar?: number) =>
                prefix + "RMS " + rms.toFixed(4) +
                (clar !== undefined ? " · clar " + clar.toFixed(2) : "") +
                " · n=" + lastChunkLenRef.current;

              // Limpa a nota exibida (silencio por HOLD_MS ou ruido por HOLD_SOUND_MS)
              const clearNote = (text: string) => {
                stableFreqRef.current = 0;
                candCountRef.current = 0;
                if (canRender) {
                  lastUpdateRef.current = now;
                  setPitchData((p) => ({ ...p, note: "-", frequency: 0, confidence: 0, detectionMethod: text }));
                }
              };

              if (rms < noiseThreshold) {
                TestRecorder.logFrame(rms, 0, 0, "silencio", 0);
                if (stabilize) {
                  if (now - lastAcceptRef.current >= HOLD_MS) clearNote(diag(""));
                  return;
                }
                if (canRender) {
                  lastUpdateRef.current = now;
                  setPitchData((p) => ({
                    ...p,
                    note: "-",
                    frequency: 0,
                    confidence: 0,
                    detectionMethod: "RMS " + rms.toFixed(5) + " · n=" + lastChunkLenRef.current,
                  }));
                }
                return;
              }

              let { frequency: freq, clarity } = MPMProcessor.detectPitch(detChunk, SAMPLE_RATE);
              const rawFreq = freq;
              const lowClarity =
                stabilize && (clarity < micMinClarity(sensitivity) || freq > MIC_MAX_FREQ);
              if (freq <= 0 || lowClarity) {
                TestRecorder.logFrame(rms, rawFreq, clarity, "sem_nota", 0);
                if (stabilize && now - lastAcceptRef.current >= HOLD_SOUND_MS) {
                  clearNote(diag("SEM NOTA · ", clarity));
                  return;
                }
                // DIAGNOSTICO: mostra o que chega mesmo sem nota detectada
                if (canRender) {
                  lastUpdateRef.current = now;
                  setPitchData((p) => ({
                    ...p,
                    detectionMethod:
                      "SEM NOTA · RMS " + rms.toFixed(4) +
                      " · clar " + clarity.toFixed(2) +
                      " · n=" + lastChunkLenRef.current,
                  }));
                }
                return;
              }

              if (stabilize) {
                const stable = stableFreqRef.current;
                // Dobra de oitava: no fim da corda o harmonico (2x) domina;
                // com nota ja confirmada, trata como a mesma nota. So vale se a
                // nota estavel for uma corda da afinacao (senao um erro de
                // oitava no ataque ficaria preso).
                const strings = stringFreqsRef.current;
                const stableIsString =
                  strings.length === 0 ||
                  strings.some((s) => s > 0 && Math.abs(centsBetween(stable, s)) < FOLD_STRING_CENTS);
                if (
                  stable > 0 &&
                  stableIsString &&
                  Math.abs(centsBetween(freq, stable) - 1200) < SAME_NOTE_CENTS
                ) {
                  freq = freq / 2;
                }
                if (stable > 0 && Math.abs(centsBetween(freq, stable)) < SAME_NOTE_CENTS) {
                  // mesma nota: aceita direto
                  stableFreqRef.current = freq;
                  candCountRef.current = 0;
                } else {
                  // nota nova: precisa se repetir antes de aparecer
                  const sameCand =
                    candCountRef.current > 0 &&
                    Math.abs(centsBetween(freq, candFreqRef.current)) < SAME_NOTE_CENTS;
                  candFreqRef.current = freq;
                  candCountRef.current = sameCand ? candCountRef.current + 1 : 1;
                  const need =
                    stable > 0 && isOctaveJump(freq, stable) ? OCTAVE_CONFIRM_FRAMES : CONFIRM_FRAMES;
                  if (candCountRef.current < need) {
                    TestRecorder.logFrame(rms, rawFreq, clarity, "segurando", 0);
                    if (canRender) {
                      lastUpdateRef.current = now;
                      setPitchData((p) => ({
                        ...p,
                        detectionMethod: diag("SEGURANDO " + candCountRef.current + "/" + need + " · ", clarity),
                      }));
                    }
                    return;
                  }
                  stableFreqRef.current = freq;
                  candCountRef.current = 0;
                }
                lastAcceptRef.current = now;
              }

              TestRecorder.logFrame(rms, rawFreq, clarity, "aceita", freq);
              const info = getNoteInfo(freq, refA4);
              if (!info) return;

              const cents = calculateCentsToTarget(freq, info.targetFreq);

              if (canRender) {
                lastUpdateRef.current = now;
                setPitchData({
                  note: info.noteName,
                  octave: info.octave,
                  frequency: freq,
                  cents,
                  inTune: Math.abs(cents) < 10,
                  confidence: clarity,
                  detectionMethod:
                    "RMS " + rms.toFixed(4) +
                    " · clar " + clarity.toFixed(2) +
                    " · n=" + lastChunkLenRef.current,
                });
              }
            }
          },
        });
      } catch (error) {
        console.error("Recording error:", error);
        const msg = error instanceof Error ? error.message : String(error);
        setPitchData({
          note: "ERRO",
          octave: 0,
          frequency: 0,
          cents: 0,
          inTune: false,
          confidence: 0,
          detectionMethod: "Erro: " + msg,
        });
      }
    };

    start();

    return () => {
      cancelled = true;
      clearInterval(stallTimer);
      stopRecording().catch(() => {});
      bufferRef.current = new Float32Array(0);
      filteredRef.current = new Float32Array(0);
      lpStateRef.current = { x1: 0, x2: 0, y1: 0, y2: 0 };
    };
  }, [isActive, refA4, noiseThreshold, stabilize, sensitivity]);

  return pitchData;
}