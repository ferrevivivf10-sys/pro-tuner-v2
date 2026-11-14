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

## Pendente

- [ ] Assinatura própria do APK (chave + segredo no GitHub)
- [ ] Acessibilidade no Afinador e em Ajustes
- [ ] Separar a lógica de estabilidade do hook e testar
- [ ] `noiseThreshold` é salvo mas não usado (gate fixo no código): remover ou usar
- [ ] Atualizar actions do workflow (avisos de Node 20)
- [ ] Fonte de áudio sem processamento: só na `@siteed/audio-studio` 4.x (beta)

## Decidido não fazer (por enquanto)

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
