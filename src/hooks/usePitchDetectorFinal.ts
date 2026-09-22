import { useState, useEffect, useRef } from "react";
import { Platform } from "react-native";
import { decode } from "base-64";
import { useAudioRecorder, ExpoAudioStreamModule } from "@siteed/audio-studio";
import { MPMProcessor } from "../audio/MPMProcessor";
import { NOTES } from "../utils/noteUtils";

export interface PitchData {
  note: string;
  octave: number;
  frequency: number;
  cents: number;
  inTune: boolean;
  confidence: number;
  detectionMethod: string;
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
const BUFFER_SIZE = 2048;
const HOP_SIZE = 1024; // 50% de sobreposicao: detecta 2x mais vezes que o buffer avanca
const MAX_BUFFER = BUFFER_SIZE * 2;
const UI_UPDATE_MIN_INTERVAL_MS = 50; // limita re-render, nunca a deteccao em si

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
  sensitivity: number = 0.8
): PitchData {
  const [pitchData, setPitchData] = useState<PitchData>(INITIAL_PITCH_DATA);

  const isActiveRef = useRef(isActive);
  const bufferRef = useRef<Float32Array>(new Float32Array(0));
  const lastUpdateRef = useRef(0);

  const { startRecording, stopRecording } = useAudioRecorder();

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!isActive) return;

    let cancelled = false;

    const start = async () => {
      try {
        const { granted } =
          await ExpoAudioStreamModule.requestPermissionsAsync();

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

          onAudioStream: async (event: any) => {
            if (!isActiveRef.current) return;
            if (!event?.data) return;

            const samples = base64ToFloat32(event.data);

            // Concatena mantendo so as ultimas MAX_BUFFER amostras
            const prev = bufferRef.current;
            const combinedLen = prev.length + samples.length;
            const combined = new Float32Array(combinedLen);
            combined.set(prev, 0);
            combined.set(samples, prev.length);

            bufferRef.current =
              combinedLen > MAX_BUFFER
                ? combined.slice(combinedLen - MAX_BUFFER)
                : combined;

            // Processa APENAS a janela mais recente. Antes este trecho varria
            // todas as janelas sobrepostas do buffer (~4 por callback), o que
            // multiplicava por 4 o custo da NSDF e saturava a thread JS
            // (travando toques e captacao). Para o que aparece na tela, so a
            // janela mais recente importa.
            const buf = bufferRef.current;
            if (buf.length >= BUFFER_SIZE) {
              const chunk = buf.subarray(buf.length - BUFFER_SIZE);
              // Mantem um rabo do buffer para a proxima janela ter sobreposicao
              bufferRef.current = buf.slice(buf.length - HOP_SIZE);

              let sumSq = 0;
              for (let i = 0; i < chunk.length; i++) {
                sumSq += chunk[i] * chunk[i];
              }
              const rms = Math.sqrt(sumSq / chunk.length);

              const now = Date.now();
              const canRender = now - lastUpdateRef.current >= UI_UPDATE_MIN_INTERVAL_MS;

              if (rms < noiseThreshold) {
                if (canRender) {
                  lastUpdateRef.current = now;
                  setPitchData((p) => ({
                    ...p,
                    note: "-",
                    frequency: 0,
                    confidence: 0,
                    detectionMethod: "RMS " + rms.toFixed(5),
                  }));
                }
                return;
              }

              const { frequency: freq, clarity } = MPMProcessor.detectPitch(chunk, SAMPLE_RATE);
              if (freq <= 0) return;

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
                  detectionMethod: "audio-studio + MPM",
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
      stopRecording().catch(() => {});
      bufferRef.current = new Float32Array(0);
    };
  }, [isActive, refA4, noiseThreshold]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    let audioCtx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let animationFrame = 0;

    const start = async () => {
      if (!isActive) return;

      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new AudioContext();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = BUFFER_SIZE;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const buffer = new Float32Array(analyser.fftSize);

        const detect = () => {
          if (!isActiveRef.current) return;
          analyser.getFloatTimeDomainData(buffer);

          let sumSq = 0;
          for (let i = 0; i < buffer.length; i++) {
            sumSq += buffer[i] * buffer[i];
          }
          const rms = Math.sqrt(sumSq / buffer.length);

          if (rms >= noiseThreshold) {
            const { frequency: freq, clarity } = MPMProcessor.detectPitch(buffer, SAMPLE_RATE);
            if (freq > 0) {
              const info = getNoteInfo(freq, refA4);
              if (info) {
                const cents = calculateCentsToTarget(freq, info.targetFreq);
                setPitchData({
                  note: info.noteName,
                  octave: info.octave,
                  frequency: freq,
                  cents,
                  inTune: Math.abs(cents) < 10,
                  confidence: clarity,
                  detectionMethod: "Web Audio API + MPM",
                });
              }
            }
          }

          animationFrame = requestAnimationFrame(detect);
        };

        detect();
      } catch (error) {
        console.error("Web audio error:", error);
      }
    };

    start();

    return () => {
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((t) => t.stop());
      audioCtx?.close();
    };
  }, [isActive, refA4, noiseThreshold]);

  return pitchData;
}