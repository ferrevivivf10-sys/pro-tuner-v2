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
- [x] Calibração refA4 validada no device (violão em 432 Hz)
- [x] Tela sempre ligada com o afinador ativo
- [x] Versão automática + CHANGELOG a cada build (GitHub Action)

### Captação por cabo (branch `cabo-etapa1`)

- [x] Tela de diagnóstico listando entradas de áudio (aba `devices`)
- [x] Modo cabo automático ao detectar entrada USB ("Ativo · Cabo")
  - [x] Gate de ruído 0.003 e clareza mínima 0.6 fixos no modo cabo
  - [x] Validado pela saída P3 do violão (efeitos desligados)
  - [x] Volta sozinho pro mic ao desplugar, sem travar
- [x] Texto de diagnóstico (RMS · clareza · amostras) na tela do afinador

### Estabilidade no microfone (branch `cabo-etapa1`)

- [x] Gate de ruído do mic 0.0025 e clareza mínima 0.75
- [x] Nota nova só após 2 leituras seguidas (oitava pra baixo: 3)
- [x] Segura a nota exibida por 200 ms após o som sumir
- [x] Descarta leituras acima de 1000 Hz (tom fantasma do ambiente)
- [x] Dobra de oitava: harmônico 2x no fim da corda conta como a mesma nota
- Resultado medido em ambiente com ruído: leituras ruins de 20,7% para 2,1%

## Pendente

- [ ] Testar build v1.0.30 (corte 1000 Hz + dobra de oitava) em ambiente com ruído
- [ ] Bateria: desligar `keepAwake` da gravação (hoje grava em segundo plano)
- [ ] Bateria: pausar o mic quando o app vai pro segundo plano
- [ ] Mover a aba `devices` para uma subtela "Entradas de áudio" em Settings
- [ ] Remover o texto de diagnóstico antes de ir pra `main`
- [ ] Rever a opção de sensibilidade (no mic a clareza mínima 0.75 já domina)
- [ ] Merge de `cabo-etapa1` na `main` após aprovação no celular
- [ ] Limpar branches `teste` e `backup-sabado`
- [ ] Testar o fluxo completo de afinação em dispositivo Android real
- [ ] Testar em iOS real
- [ ] Validar latência e estabilidade da detecção com instrumento real
- [ ] Ajustar limiares (`noiseThreshold`, `CLARITY_THRESHOLD`) com base em testes
- [ ] Testes automatizados para `MPMProcessor` (sinais sintéticos de frequência conhecida)

## Ideias (opcional)

- [ ] Pausa automática após alguns minutos sem nota (libera a tela)
- [ ] Gate de ruído adaptativo (nível do ambiente + margem) em vez de fixo
- [ ] UI mais fluida em telas de 144 Hz
- [ ] Atualizar actions do workflow (avisos de Node 20 e setup-java v4)
- [ ] Detecção automática da corda mais próxima dentro da afinação
- [ ] Modo de treino / histórico de afinações
- [ ] Suporte a mais instrumentos (baixo, viola, ukulele)
