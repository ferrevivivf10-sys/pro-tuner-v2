# Pro Tuner — TODO

- [x] Gerar logo do aplicativo (ícone de afinador neon)
- [x] Configurar branding (nome, cores, ícones)
- [x] Atualizar tema (dark mode, cores neon)
- [x] Criar módulo FFTProcessor (src/audio/FFTProcessor.ts)
- [x] Criar módulo HPSProcessor (src/audio/HPSProcessor.ts)
- [x] Criar utilitários de notas (src/utils/noteUtils.ts)
- [x] Criar hook usePitchDetector com microfone real via expo-audio
- [x] Criar componente TunerNeedle (SVG animado)
- [x] Implementar TunerScreen (tela principal do afinador)
- [x] Implementar SettingsScreen (calibração A4 e afinações)
- [x] Configurar navegação por abas (Tuner + Settings)
- [x] Adicionar ícones nas abas (icon-symbol.tsx)
- [x] Adicionar permissão de microfone no Android (via app.config.ts)
- [ ] Testar fluxo completo de afinação em dispositivo Android

## Otimizações de Detecção de Pitch

- [x] Implementar confidence score baseado em magnitude do pico
- [x] Adicionar validação de sub-harmônicos (evitar 164 Hz quando é 82 Hz)
- [x] Reduzir buffer de 2048 para 512 amostras (latência 200-300ms)
- [x] Implementar histórico de leituras com peso temporal
- [x] Adicionar travamento de corda detectada (evitar pulos entre notas)
- [x] Implementar algoritmo YIN para detecção híbrida YIN+HPS
- [ ] Adicionar modo profissional com detecção McLeod + HPS (opcional)
- [ ] Testar em dispositivo Android real com microfone

## Correções Críticas (v3)

- [x] Implementar AudioCaptureEngine (placeholder para captura real)
- [x] Implementar AudioFilterEngine (filtro passa-banda 60-1500 Hz + noise gate)
- [x] Implementar PitchDetectionEngineV3 (destravamento automático)
- [x] Implementar usePitchDetectorV3 (integração completa)
- [x] Implementar SettingsManager (persistência completa)
- [x] Medir latência REAL com performance.now()
- [x] Exibir tendência de frequência (subindo/descendo/estável)
- [x] Atualizar TunerScreen com todas as métricas


## Correções Críticas (v3 Fixed)

- [x] Corrigir PitchDetectionEngineV3Fixed (travamento/destravamento)
- [x] Corrigir usePitchDetectorV3Fixed (filtro integrado, SNR, latência real)
- [x] Resolver race condition de settings (aguardar carregar)
- [x] Reduzir noise threshold de 0.02 para 0.005
- [x] Aumentar FREQUENCY_JUMP_THRESHOLD de 0.15 para 0.25
- [x] Reduzir SMOOTHING_FACTOR de 0.25 para 0.15
- [x] Implementar AudioValidator (validação e tratamento de erro)
- [x] Atualizar TunerScreen com SNR e loading state


## Fase 1: 4 Otimizações Críticas

- [x] Aumentar buffer de 512 para 4096 (mais precisão)
- [x] Implementar PitchSmoother (filtro anti-jitter)
- [x] Implementar NoiseGateAdaptive (auto-calibração)
- [x] Implementar NoteLock (confirmação de nota)
- [x] Integrar tudo em usePitchDetectorPhase1
- [x] Atualizar TunerScreen com métricas de Fase 1


## Otimizações de Performance

- [x] Reduzir setState com debounce (atualizar só quando nota muda ou 200ms)
- [x] Reduzir buffer de 4096 para 2048 (latência 46ms)
- [x] Processar FFT a cada 2 frames (reduz carga)
- [x] Usar Reanimated para agulha (animação nativa, sem re-render)
- [x] Cleanup correto de intervalo (clearInterval)
- [x] Memoizar componentes (useMemo)


## Integração de Audio Real + Blackman-Harris

- [x] Implementar AudioRecorderReal com expo-audio
- [x] Implementar WindowFunctions com Blackman-Harris (4 termos)
- [x] Adicionar blackmanHarrisWindow ao FFTProcessor
- [x] Integrar Blackman-Harris em usePitchDetectorOptimized
- [ ] Testar com guitarra real em dispositivo Android
- [ ] Validar redução de vazamento espectral (~92dB)
