# Pro Tuner — Design Document

## App Concept

Afinador cromático para guitarras, baixos e outros instrumentos de corda. Detecta
a frequência fundamental via microfone em tempo real usando o **McLeod Pitch
Method (MPM)**, exibe a nota detectada, o desvio em cents e um display OLED com as
cordas do instrumento. Funciona 100% local, sem backend.

---

## Color Palette

| Token | Valor (dark) | Uso |
|-------|-------------|-----|
| `background` | `#000000` | Fundo principal (OLED puro) |
| `surface` | `#0A0A0A` | Cards e painéis |
| `primary` | `#00E676` | Verde neon — nota afinada / ativo |
| `error` | `#FF1744` | Vermelho — nota desafinada |
| `foreground` | `#ECEDEE` | Texto principal |
| `muted` | `#555555` | Texto secundário, marcações |
| `border` | `#1A1A1A` | Bordas sutis |

O app usa **modo escuro fixo** (dark-only), estilo instrumento de medição
profissional.

Cada corda tem uma cor cromática fixa por posição (grave → agudo):
azul, vermelho, verde, ouro, roxo, ciano. Apenas a corda ativa brilha.

---

## Screen List

### 1. TunerScreen (tab: Tuner)

**Conteúdo principal:**
- Barra de status (Ativo/Pausado) e referência A4 no topo
- `PitchLabDisplay`: nota detectada em fonte grande, oitava, frequência em Hz,
  desvio em cents e as linhas das cordas atravessando a tela
- Rótulo do método de detecção em uso
- Botão PAUSAR/RETOMAR na parte inferior
- Modal de seleção de afinação (Standard, Drop D, Half Step Down, Full Step Down,
  Open G)

**Funcionalidade:**
- Microfone captura PCM em tempo real (nativo via `@siteed/audio-studio`, web via
  Web Audio API)
- MPM (NSDF) detecta a frequência fundamental
- A nota grande é a da **corda** mais próxima da afinação (não a cromática); os
  cents são medidos contra a frequência dessa corda, já **corrigida pela
  calibração A4** (432/440/…)
- Indicador de ação no centro do anel: **AFROUXAR** (agudo) / **APERTAR** (grave)
  / **AFINADO**
- Suavização de exibição: hold da nota (600 ms) e média móvel de cents
- Modo manual de trava de corda (string-lock) tocando na corda desejada

### 2. SettingsScreen (tab: Settings)

**Conteúdo principal:**
- Seção "Calibração A4": 432, 438, 440, 442, 444 Hz
- Item selecionado destacado em verde
- Seção "Modo de Afinação" com cada afinação e as frequências das cordas
- Rodapé com a versão

**Funcionalidade:**
- Salva preferências via AsyncStorage (`SettingsManager`)
- Recarregadas automaticamente na TunerScreen

---

## Key User Flows

1. **Afinar uma corda:**
   App abre → TunerScreen ativa → usuário toca a corda → nota detectada aparece →
   fica verde e centralizada quando afinada (±10 cents)

2. **Mudar calibração:**
   Tab Settings → toca o valor desejado (ex: 432 Hz) → confirmação visual → volta
   para Tuner → nova referência A4 aplicada

3. **Pausar detecção:**
   Botão PAUSAR → microfone para → botão muda para RETOMAR

---

## Navigation

- Bottom Tab Navigator com 2 abas: **Tuner** (ícone waveform) e **Settings**
  (ícone de engrenagem)
- Tab bar escura, borda superior quase invisível
- Cor ativa: verde neon (`#00E676`)

---

## Component Breakdown

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `PitchLabDisplay` | `src/components/PitchLabDisplay.tsx` | Display OLED: nota da corda, cents calibrados, indicador afrouxar/apertar e trava manual |
| `TunerScreen` | `app/(tabs)/index.tsx` | Tela principal + modal de afinação |
| `SettingsScreen` | `app/(tabs)/settings.tsx` | Calibração A4 e afinações |
| `usePitchDetectorFinal` | `src/hooks/usePitchDetectorFinal.ts` | Captura de áudio + detecção |
| `MPMProcessor` | `src/audio/MPMProcessor.ts` | McLeod Pitch Method (NSDF) |

---

## Audio Architecture

```
Microfone (PCM 16-bit @ 44.1 kHz)
  → buffer deslizante (2048 amostras, hop 1024 = 50% de sobreposição)
  → gate de ruído (RMS)
  → NSDF (Normalized Square Difference Function)
  → seleção do 1º pico ≥ 85% do maior pico (evita erro de oitava)
  → interpolação parabólica → frequência + clareza
  → getNoteInfo → cents → UI
```

- **Buffer size:** 2048 amostras
- **Hop size:** 1024 amostras (50% de sobreposição)
- **Sample rate:** 44100 Hz
- **Faixa:** 60–1200 Hz
- **Threshold de afinação:** ±10 cents
- **Confidence:** clareza da NSDF (0–1)
- **Captura:** `@siteed/audio-studio` (nativo) · Web Audio API `AnalyserNode` (web)
