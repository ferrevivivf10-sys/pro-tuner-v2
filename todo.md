# Pro Tuner — TODO

Estado em 14/11/2026 · versão 1.0.53 na `main`.

## Feito

### Base
- [x] Abas Afinador + Ajustes, tema OLED, textos em português
- [x] Afinações (Padrão, Drop D, Meio tom abaixo, Um tom abaixo, Open G) e calibração do A4
- [x] Configurações salvas no aparelho (`SettingsManager`)
- [x] Tela ligada com o afinador ativo; mic pausa em segundo plano e fora da aba
- [x] Versão automática + CHANGELOG a cada build na `main`

### Detecção (MPM)
- [x] MPM em dois estágios (decimado 4x + refino em taxa cheia) com interpolação parabólica
- [x] Pico 0,90 + pico híbrido 0,85 (Mi agudo)
- [x] Conferência em taxa cheia dos picos agudos (ataque do Si e do Mizinho lido como f/3)
- [x] Correção de sub-harmônico (ataque do nylon lido uma oitava acima)
- [x] Estabilidade no mic: gate 0,0025, clareza pela sensibilidade, 2 leituras para trocar de nota (oitava: 3), descarte acima de 700 Hz, dobra de oitava só em corda
- [x] Display segura a nota 400 ms

### Cabo
- [x] Modo cabo automático (USB/fone com fio), validado pela saída P3 do violão
- [x] Plugar e desplugar com o app aberto ou em segundo plano (aprovado no celular em 13/11)
- [x] Subtela "Entradas de áudio" em Ajustes

### Qualidade
- [x] Modo de teste em Ajustes: grava .wav + .csv; filtro 1500 Hz opcional
- [x] Testes automatizados (`npm test`): detector com trechos reais + lógica do cabo
- [x] Build checa tipos (`tsc`) antes dos testes
- [x] Sobras do template, docs antigos e suporte web removidos
- [x] Estabilidade do mic separada do hook (`src/audio/stability.ts`) e testada
- [x] `noiseThreshold` sem uso removido das configurações
- [x] Lint sem avisos e código formatado com Prettier
- [x] Acessibilidade (TalkBack) no Afinador, em Ajustes e nas Entradas de áudio
- [x] Actions do workflow atualizadas (Node 24)
- [x] Mostrador se adapta a telas estreitas (`dialLayout.ts`), testado de 320 a 412 px
- [x] Lógica do afinador por corda separada da tela (`stringTuner.ts`) e testada
- [x] Expo SDK 54 → 57 (React Native 0.86, React 19.2); vulnerabilidades 44 → 22
- [x] Mediana dos cents e folga no "afinado" (entra < 5, sai > 7)
- [x] "X de 6 cordas afinadas" com ✓ nas cordas e vibração
- [x] Fonte do microfone no modo de teste (Padrão / Voz / Cru) e web sem filtros de voz
- [x] Fim da nota: nota nova só entra logo após um ataque (salto de volume); sub-harmônicos, cordas por simpatia e ruído no fim da nota descartados
- [x] Monitor da taxa de entrega: aviso e nota bloqueada se a captura sair de 44.100 ± 2% ou parar (validar o limite no aparelho)

## Pendente

- [ ] Assinatura própria do APK (chave + segredo no GitHub)

## Decidido não fazer (por enquanto)

- Fonte Voz como padrão: nos testes de 14/11 com barulho aceitou mais leituras erradas que a Padrão (6 contra 2) e o sinal chega ~3x mais fraco. Continua no modo de teste
- Fonte sem processamento (`UNPROCESSED`) como padrão: no celular de teste (14/11) o Android não suporta e abre a `MIC`. Continua disponível como "Cru" no modo de teste
- Juiz SWIPE: empatou com barulho real (5 consertos, 5 estragos)
- YIN, escolha pela sequência e janela maior (3072/4096): sem ganho
- Filtro 1500 Hz como padrão: mostra nota nas pausas com ruído
- Modo processado do Android: corta notas e apaga o Mi grave
- Módulo nativo de áudio: o mic já chega praticamente cru
- Web: suporte removido do código; iOS: fora do alvo atual

## Ideias

- [ ] Texto "aperte / afrouxe" e vibração ao afinar
- [ ] Modo guiado corda a corda
- [ ] Pausa automática após alguns minutos sem nota
- [ ] Gate de ruído adaptativo (nível do ambiente + margem)
- [ ] Mais instrumentos (baixo, viola, ukulele)
