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

## Próximo build (aguardando liberação)

Validado offline com as gravações do modo de teste (aço, nylon, cabo).

- [ ] Pico híbrido (0.90, volta pra 0.85 se der uma oitava acima e ≥ 125 Hz) + teste do Mi agudo
- [ ] Dobra de oitava só quando a nota estável é uma corda da afinação
- [ ] Correção de sub-harmônico: usa f/2 ou f/3 se a NSDF em 2T/3T for ≥ 0.05 maior que em T (ataque do nylon)
- [ ] Display segura a nota 300 ms (era 600) e remove a mediana do hook
- [ ] Mic para na aba Ajustes
- [ ] Modo de teste vira opção em Ajustes (com escolha de fonte de áudio sem processamento)
- [ ] Numeração das cordas (Mi grave = 6ª) e "instrumento" no lugar de "guitarra"
- [ ] Atualizar lista de entradas ao abrir o afinador e ao voltar pro app (bug do cabo)
- [ ] Filtro passa-baixa 1500 Hz: **fora do padrão** — só como opção no modo de teste (pode mostrar nota em pausas com ruído)

## Pendente

- [ ] **Lembrete:** o próximo build já leva os testes automatizados (commit `4378c69`) — conferir no log do Actions o passo "Testes" passando (7 testes)
- [ ] Testar build da rodada de melhorias (checklist de 7 itens)
- [x] Bateria: `keepAwake` desligado e mic pausa em segundo plano
- [x] Aba `devices` virou subtela "Entradas de áudio" em Ajustes
- [x] Sensibilidade controla a clareza mínima no mic (0.85 / 0.75 / 0.65)
- [x] Afinações e abas em português; Open G corrigido (D2 G2 D3 G3 B3 D4)
- [x] Permissões não usadas removidas; sobras do template removidas
- [x] Testes automatizados do detector MPM (`npm test`, rodam no build)
- [ ] Remover o texto de diagnóstico antes de ir pra `main`
- [ ] Assinatura própria do APK (chave + segredo no GitHub)
- [ ] Acessibilidade no Afinador e em Ajustes
- [ ] Separar a lógica de estabilidade do hook e testar
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
