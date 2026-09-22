# Pro Tuner — TODO

## Feito

- [x] Branding, tema OLED e ícones neon
- [x] Navegação por abas (Tuner + Settings) com ícones
- [x] Utilitários de nota e afinações (`src/utils/noteUtils.ts`)
- [x] Persistência de configurações via AsyncStorage (`SettingsManager`)
- [x] Permissão de microfone (Android/iOS via `app.config.ts`)
- [x] Captura de áudio real
  - [x] Nativo: `@siteed/audio-studio` (PCM 16-bit @ 44.1 kHz)
  - [x] Web: Web Audio API (`AnalyserNode`)
- [x] Detecção de pitch com **McLeod Pitch Method (MPM / NSDF)**
  - [x] Normalização por RMS + gate de ruído
  - [x] Seleção do 1º pico (≥ 85% do maior) — evita erro de oitava
  - [x] Interpolação parabólica (precisão sub-amostra)
  - [x] Clareza da NSDF como confidence real
- [x] Buffer deslizante 2048 / hop 1024 (50% de sobreposição)
- [x] Throttle de re-render (~50 ms) sem pular detecção
- [x] Display `PitchLabDisplay`: nota, cents, cordas, hold e suavização
- [x] Modo manual de trava de corda (string-lock)
- [x] Limpeza do scaffolding não usado (login/OAuth/tRPC/backend)

## Pendente

- [ ] Testar o fluxo completo de afinação em dispositivo Android real
- [ ] Testar em iOS real
- [ ] Validar latência e estabilidade da detecção com instrumento real
- [ ] Ajustar limiares (`noiseThreshold`, `CLARITY_THRESHOLD`) com base em testes
- [ ] Testes automatizados para `MPMProcessor` (sinais sintéticos de frequência conhecida)

## Ideias (opcional)

- [ ] Detecção automática da corda mais próxima dentro da afinação
- [ ] Modo de treino / histórico de afinações
- [ ] Suporte a mais instrumentos (baixo, viola, ukulele)
