# 📊 Relatório: Pro Tuner — Afinador Cromático

**Plataforma:** Android / iOS / Web (Expo SDK 54 + React Native)
**Status:** Protótipo funcional com captura de áudio real
**Arquitetura de detecção:** McLeod Pitch Method (MPM / NSDF)

---

## 📋 Resumo

O **Pro Tuner** é um afinador cromático para instrumentos de corda escrito em
React Native com Expo. Ele captura o áudio do microfone em tempo real, detecta a
frequência fundamental com o **McLeod Pitch Method (MPM)** e exibe nota, oitava,
frequência, desvio em cents e a corda ativa num display OLED.

O aplicativo é **100% local**: não há backend, autenticação, banco de dados nem
envio de áudio para servidores. Todo o processamento acontece no dispositivo.

### Estado atual

- ✅ Captura de áudio real (nativa e web)
- ✅ Detecção de pitch por MPM/NSDF
- ✅ Persistência de configurações (AsyncStorage)
- ✅ UI OLED com cordas, cents e suavização
- ✅ Modo manual de trava de corda
- ⚠️ Validação em dispositivo real ainda pendente (ajuste fino de limiares)

---

## 🏗️ Arquitetura

### Estrutura de diretórios

```
pro-tuner-v2/
├── app/
│   ├── _layout.tsx            Root layout (tema, safe-area, gesture handler)
│   └── (tabs)/
│       ├── index.tsx          TunerScreen (tela principal)
│       ├── settings.tsx       SettingsScreen (calibração A4 + afinações)
│       └── _layout.tsx        Navegação por abas
├── src/
│   ├── audio/
│   │   └── MPMProcessor.ts    McLeod Pitch Method (NSDF)
│   ├── hooks/
│   │   └── usePitchDetectorFinal.ts   Captura de áudio + detecção
│   ├── components/
│   │   └── PitchLabDisplay.tsx UI do afinador (nota, cents, cordas)
│   └── utils/
│       ├── noteUtils.ts       Conversão frequência↔nota + afinações
│       └── SettingsManager.ts Persistência (AsyncStorage)
├── components/                UI compartilhada (ScreenContainer, ícones, tab háptica)
├── constants/theme.ts         Tema
├── hooks/                     use-colors, use-color-scheme
├── lib/                       theme-provider, utils, runtime web
├── app.config.ts              Configuração Expo (permissões, plugins)
└── design.md / todo.md        Documentação
```

### Fluxo de dados

```
Microfone (PCM 16-bit @ 44.1 kHz)
  • nativo:  @siteed/audio-studio (ExpoAudioStreamModule)
  • web:     Web Audio API (AnalyserNode.getFloatTimeDomainData)
      ↓
Buffer deslizante (2048 amostras, hop de 1024 = 50% de sobreposição)
      ↓
Gate de ruído por RMS (noiseThreshold configurável)
      ↓
MPMProcessor.detectPitch()  →  { frequency, clarity }
      ↓
getNoteInfo() (fórmula MIDI, referência A4 configurável)
      ↓
cents = 1200 · log2(freq / freqAlvo)
      ↓
usePitchDetectorFinal (setState com throttle de ~50 ms só no render)
      ↓
PitchLabDisplay (UI: nota, cents, corda ativa)
```

A **detecção roda em cada janela** que couber no buffer acumulado; apenas o
`setState` (re-render) é limitado a ~50 ms, para não sobrecarregar a UI.

---

## 🔧 Componentes principais

### 1. Detecção de pitch — `MPMProcessor`

O **McLeod Pitch Method** substituiu a antiga combinação FFT + HPS + YIN. Etapas:

1. **Normalização por RMS** — silêncio real (`rms < 0.0008`) é descartado; sinais
   fracos recebem ganho (até 20x) até um nível alvo.
2. **NSDF** — *Normalized Square Difference Function*, autocorrelação normalizada
   que varia de -1 a 1. Quanto mais perto de 1, mais periódico é o sinal.
3. **Seleção do primeiro pico** acima de 85% do maior pico — escolhe a frequência
   mais aguda "boa o suficiente", evitando cair uma oitava abaixo (subharmônica),
   ponto fraco do YIN simples.
4. **Interpolação parabólica** ao redor do pico, para precisão sub-amostra.
5. **Clareza (0–1)** — retornada como *confidence* real (periodicidade do sinal),
   não um proxy de volume.

| Parâmetro | Valor |
|-----------|-------|
| Faixa de frequência | 60–1200 Hz |
| Limiar de aceitação (clareza mínima) | 0.30 |
| Fração do maior pico para escolher pico mais agudo | 0.85 |
| RMS mínimo (silêncio) | 0.0008 |

### 2. Captura de áudio — `usePitchDetectorFinal`

- **Nativo (Android/iOS):** `@siteed/audio-studio` — stream PCM 16-bit em 44.1 kHz,
  1 canal, callback `onAudioStream` a cada ~100 ms. As amostras base64→Float32 são
  concatenadas num buffer deslizante e processadas em janelas sobrepostas.
- **Web:** Web Audio API — `AnalyserNode.getFloatTimeDomainData` dentro de um loop
  `requestAnimationFrame`.
- **Permissões:** solicita microfone; em caso de negação/erro, o display mostra um
  estado explícito (`MIC?`, `ERRO`).

### 3. Notas e afinações — `noteUtils`

- Conversão frequência↔nota pela fórmula MIDI (`n = 12·log2(f/A4) + 69`).
- Afinações predefinidas (cordas abertas):

| Afinação | Cordas |
|----------|--------|
| Standard | E2 A2 D3 G3 B3 E4 |
| Drop D | D2 A2 D3 G3 B3 E4 |
| Half Step Down | D#2 G#2 C#3 F#3 A#3 D#4 |
| Full Step Down | D2 G2 C3 F3 A3 D4 |
| Open G | E2 G2 D3 G3 B3 G4 |

### 4. Interface — `PitchLabDisplay`

- Fundo OLED puro (`#000000`), nota em fonte grande.
- Linhas das cordas atravessando a tela; cor cromática fixa por posição, só a
  corda ativa brilha.
- Suavização de exibição: *hold* da nota (600 ms), média móvel de cents e debounce
  de troca de nota (180 ms).
- Modo manual de trava de corda (string-lock).
- Considera-se "afinado" com desvio menor que ±10 cents.

### 5. Configurações — `SettingsManager`

Persistidas via `AsyncStorage` (chave `@pro_tuner_settings`):

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `refA4` | 440 | Referência A4 (432–444 Hz) |
| `selectedTuning` | Standard | Afinação predefinida |
| `sensitivity` | 0.8 | Sensibilidade |
| `noiseThreshold` | 0.005 | Limiar de ruído (gate RMS) |

---

## 🧪 Testes e validação

- ✅ Type-check (`npm run check`) e lint (`npm run lint`)
- ⚠️ Sem testes unitários automatizados (candidato: `MPMProcessor` com sinais
  sintéticos de frequência conhecida)
- ⚠️ Não validado em dispositivo físico — ajuste fino de limiares pendente

### Teste manual recomendado

```bash
npm run android   # build de desenvolvimento com áudio nativo
```

Tocar cordas de referência (E2 ≈ 82.4 Hz, A2 ≈ 110 Hz, etc.) e verificar:
detecção correta da nota, estabilidade (sem pulos de oitava), latência aceitável.

---

## 🚀 Próximos passos

1. Testar o fluxo completo em Android e iOS reais.
2. Ajustar `noiseThreshold` e limiares da NSDF com base em testes.
3. Adicionar testes automatizados para o `MPMProcessor`.
4. (Opcional) Detecção automática da corda mais próxima dentro da afinação, modo
   de treino e suporte a mais instrumentos.

---

## 🔒 Segurança e privacidade

- Processamento 100% no dispositivo; nenhum áudio é gravado em arquivo nem
  enviado para servidores.
- Única permissão necessária: **microfone** (`RECORD_AUDIO`).
- Sem coleta de dados pessoais, login ou backend.

---

## 🎯 Conclusão

O Pro Tuner é um afinador funcional e enxuto, com captura de áudio real e detecção
por MPM/NSDF — uma escolha robusta contra erros de oitava. A base de código foi
limpa de todo o scaffolding de backend/login que não era usado, deixando o app
focado no seu propósito: afinar, de forma local e privada. O passo mais importante
que resta é a validação em hardware real e o ajuste fino dos limiares de detecção.
