# 🎸 Pro Tuner

Afinador cromático para guitarra, baixo e outros instrumentos de corda, feito
em **React Native + Expo (SDK 54)**. Captura o áudio do microfone em tempo real,
detecta a frequência fundamental com o **McLeod Pitch Method (MPM)** e mostra a
nota, a oitava, o desvio em cents e a corda ativa.

O app é **100% local** — não há backend, login, nem envio de dados para a nuvem.

---

## Quick Start

```bash
npm install

# Desenvolvimento (web, para testar rápido no navegador)
npm run dev

# Dispositivo / emulador (captura de áudio nativa)
npm run android
npm run ios
```

> A detecção de pitch nativa depende de um build de desenvolvimento
> (`expo run:android` / `expo run:ios`), pois usa o módulo nativo de captura de
> áudio `@siteed/audio-studio`. No Expo Go o áudio nativo não fica disponível;
> use `npm run dev` (Web Audio API) para uma prévia no navegador.

Scripts disponíveis:

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia o Metro em modo web |
| `npm run android` / `npm run ios` | Build de desenvolvimento com áudio nativo |
| `npm run check` | Type-check com `tsc --noEmit` |
| `npm run lint` | ESLint (`expo lint`) |
| `npm run format` | Prettier |
| `npm run qr` | Gera QR code de conexão (`scripts/generate_qr.mjs`) |

---

## Como funciona a detecção

O núcleo de detecção é o **McLeod Pitch Method (MPM)**, em
`src/audio/MPMProcessor.ts`. Ele substituiu a antiga combinação FFT + HPS + YIN.

1. **Normalização por RMS** — silêncio real (`rms < 0.0008`) é descartado; sinais
   fracos recebem ganho até 20x para chegar num nível alvo.
2. **NSDF** (Normalized Square Difference Function) — autocorrelação normalizada
   que varia de -1 a 1; quanto mais perto de 1, mais periódico é o sinal naquele
   lag.
3. **Seleção do primeiro pico** acima de 85% do maior pico — evita o erro clássico
   de "cair" uma oitava abaixo (subharmônica), ponto fraco do YIN simples.
4. **Interpolação parabólica** ao redor do pico escolhido, para precisão
   sub-amostra.
5. **Clareza (0–1)** — retornada junto com a frequência e usada como *confidence*
   real (o quão periódico é o sinal), não um proxy de volume.

Faixa de detecção: **60–1200 Hz** (E2 ≈ 82 Hz até acima de E4 ≈ 330 Hz e
harmônicos).

### Fluxo de dados

```
Microfone
  → captura PCM 16-bit @ 44.1 kHz
      • nativo:  @siteed/audio-studio (ExpoAudioStreamModule)
      • web:     Web Audio API (AnalyserNode)
  → buffer deslizante (2048 amostras, hop de 1024 = 50% de sobreposição)
  → gate de ruído por RMS
  → MPMProcessor.detectPitch()  → { frequency, clarity }
  → getNoteInfo() (fórmula MIDI, referência A4 configurável)
  → cents = 1200 · log2(freq / alvo)
  → usePitchDetectorFinal (setState com throttle de ~50 ms só no render)
  → PitchLabDisplay (UI)
```

A **detecção roda em toda janela** que couber no buffer; apenas o `setState`
(re-render) é limitado, para a UI não sobrecarregar.

---

## Estrutura do projeto

```
app/
  _layout.tsx            Root layout (tema, safe-area, gesture handler)
  (tabs)/
    _layout.tsx          Navegação por abas (Tuner + Settings)
    index.tsx            TunerScreen — tela principal
    settings.tsx         SettingsScreen — calibração A4 e afinações
src/
  audio/
    MPMProcessor.ts      McLeod Pitch Method (NSDF)
  hooks/
    usePitchDetectorFinal.ts   Captura de áudio (nativo + web) + detecção
  components/
    PitchLabDisplay.tsx  Display OLED com cordas, nota e cents
  utils/
    noteUtils.ts         Conversão frequência↔nota, afinações
    SettingsManager.ts   Persistência (AsyncStorage)
components/              UI compartilhada (ScreenContainer, ícones, tab háptica)
constants/theme.ts      Tema
hooks/                  use-colors, use-color-scheme
lib/                    theme-provider, utils, tema
```

---

## Configurações

Persistidas localmente via `AsyncStorage` (`SettingsManager`):

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `refA4` | `440` | Referência A4 (432 / 438 / 440 / 442 / 444 Hz) |
| `selectedTuning` | `Standard` | Afinação predefinida |
| `sensitivity` | `0.8` | Sensibilidade |
| `noiseThreshold` | `0.005` | Limiar de ruído (gate RMS) |

Afinações disponíveis (cordas abertas, em `noteUtils.ts`):

| Afinação | Cordas |
|----------|--------|
| Standard | E2 A2 D3 G3 B3 E4 |
| Drop D | D2 A2 D3 G3 B3 E4 |
| Half Step Down | D#2 G#2 C#3 F#3 A#3 D#4 |
| Full Step Down | D2 G2 C3 F3 A3 D4 |
| Open G | E2 G2 D3 G3 B3 G4 |

---

## Stack

- **Expo** ~54 / **React Native** 0.81 / **React** 19
- **expo-router** — navegação por arquivos
- **@siteed/audio-studio** — captura de áudio PCM nativa
- **react-native-svg** — display do afinador
- **react-native-reanimated** — animações
- **nativewind** (Tailwind CSS) — estilização
- **@react-native-async-storage/async-storage** — persistência local

---

## Privacidade

Todo o processamento acontece no dispositivo. A única permissão necessária é o
**microfone** (`RECORD_AUDIO`). Nenhum áudio é gravado em arquivo nem enviado
para servidores.
