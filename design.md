# Pro Tuner — Design Document

## App Concept

Afinador cromático profissional para guitarras, baixos e outros instrumentos de corda. Detecta a frequência fundamental via microfone em tempo real usando FFT + HPS, exibe a nota detectada, desvio em cents e uma agulha analógica animada.

---

## Color Palette

| Token | Valor (dark) | Uso |
|-------|-------------|-----|
| `background` | `#0D0D0D` | Fundo principal (preto profundo) |
| `surface` | `#1A1A1A` | Cards e painéis |
| `primary` | `#00E676` | Verde neon — nota afinada |
| `error` | `#FF1744` | Vermelho — nota desafinada |
| `foreground` | `#ECEDEE` | Texto principal |
| `muted` | `#555555` | Texto secundário, marcações |
| `border` | `#2A2A2A` | Bordas sutis |

O app usa **modo escuro fixo** (dark-only), estilo instrumento de medição profissional.

---

## Screen List

### 1. TunerScreen (tab: Tuner)

**Conteúdo principal:**
- Título "PRO TUNER" em letras espaçadas no topo
- Nome da nota detectada (ex: `A`) em fonte grande (80px), colorida de verde quando afinada
- Número da oitava como sobrescrito (ex: `4`)
- Frequência em Hz (ex: `440.00 Hz`)
- Agulha analógica SVG com arco graduado — gira de acordo com os cents de desvio
- Indicador de cents (ex: `+2 cents` em verde, `-15 cents` em vermelho)
- Botão PAUSE/RESUME na parte inferior

**Funcionalidade:**
- Microfone captura PCM em tempo real
- FFT + HPS detecta frequência fundamental
- Filtro exponencial suaviza a leitura
- Agulha anima com `react-native-reanimated`

### 2. SettingsScreen (tab: Settings)

**Conteúdo principal:**
- Header "CALIBRAÇÃO A4"
- Lista de opções de calibração: 432 Hz, 438 Hz, 440 Hz, 442 Hz, 444 Hz
- Item selecionado destacado em verde
- Seção "AFINAÇÕES" com seleção de modo (Standard, Drop D, Half Step Down)
- Cada string da afinação exibida como chip colorido

**Funcionalidade:**
- Salva preferência via AsyncStorage
- Recarregada automaticamente na TunerScreen

---

## Key User Flows

1. **Afinar uma corda:**
   App abre → TunerScreen ativa → usuário toca a corda → nota detectada aparece → agulha aponta para o centro quando afinada → cor muda para verde

2. **Mudar calibração:**
   Tab Settings → toca valor desejado (ex: 432 Hz) → confirmação visual → volta para Tuner → nova referência aplicada

3. **Pausar detecção:**
   Botão PAUSE → microfone para → agulha congela → botão muda para RESUME

---

## Navigation

- Bottom Tab Navigator com 2 abas: **Tuner** (ícone de afinador) e **Settings** (ícone de engrenagem)
- Tab bar escura, sem borda superior visível
- Cor ativa: verde neon (`#00E676`)

---

## Component Breakdown

| Componente | Arquivo | Descrição |
|-----------|---------|-----------|
| `TunerNeedle` | `components/TunerNeedle.tsx` | SVG com arco + ponteiro animado |
| `NoteDisplay` | inline em TunerScreen | Nota + oitava + Hz |
| `CentsBar` | inline em TunerScreen | Barra de cents com gradiente |
| `TunerScreen` | `app/(tabs)/index.tsx` | Tela principal |
| `SettingsScreen` | `app/(tabs)/settings.tsx` | Calibração e afinações |

---

## Audio Architecture

```
Microfone (PCM) → Hanning Window → FFT (Radix-2) → Magnitude Spectrum → HPS → Frequência Fundamental → getNoteFromFreq → UI
```

- **Buffer size:** 2048 amostras
- **Sample rate:** 44100 Hz
- **HPS order:** 5
- **Filtro:** Exponential Moving Average (α = 0.15)
- **Threshold de afinação:** ±3 cents
