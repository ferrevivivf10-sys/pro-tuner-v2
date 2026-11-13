# Changelog — Pro Tuner

Gerado automaticamente a cada build. Mais recente primeiro.

## v1.0.53 — 2026-11-13
- **Alterado:** build: checa tipos (tsc) antes dos testes no workflow (`110cfd0`)

## v1.0.52 — 2026-11-13
- **Melhorado:** conferencia em taxa cheia dos picos agudos (ataque do Si e do Mizinho nao caem para f/3), com teste em audio real (`674ac92`)

## v1.0.51 — 2026-11-13
- **Alterado:** teste: logica do modo cabo separada em cableMode.ts com 8 testes (plugar/desplugar, sem sobreposicao, falhas) (`6de32e1`)

## v1.0.50 — 2026-11-13
- **Corrigido:** cabo plugado com o app aberto e reconhecido (entradas relidas a cada 2,5 s) (`2c6a9d5`)

## v1.0.49 — 2026-11-11
- **Melhorado:** dobra de oitava so em corda, display segura 400 ms, mic para fora da aba, modo de teste em Ajustes, entradas relidas ao voltar pro app (`8fc72c6`)

## v1.0.48 — 2026-11-11
- **Melhorado:** pico hibrido (Mi agudo) e correcao de sub-harmonico (ataque do nylon), com testes em audio real (`5081656`)

## v1.0.47 — 2026-11-11
- **Alterado:** lista do proximo build (validado offline); filtro passa-baixa fica fora do padrao (`60c8c9d`)

## v1.0.46 — 2026-11-10
- **Alterado:** diagnostico: botao Gravar teste salva o audio do detector (.wav) e o registro de leituras (.csv) (`4b6ed11`)

## v1.0.45 — 2026-11-10
- **Melhorado:** ponteiro usa a mediana das 3 ultimas leituras (menos tremor) (`124b197`)

## v1.0.44 — 2026-11-10
- **Melhorado:** segura a nota ate 600 ms enquanto ainda ha som no microfone (`ab04747`)

## v1.0.43 — 2026-11-10
- **Melhorado:** corte de leituras acima de 700 Hz no microfone (`a9824a8`)

## v1.0.42 — 2026-11-10
- **Melhorado:** pico do detector em 0.90 (menos leituras uma oitava acima) (`6eb2c3b`)

## v1.0.41 — 2026-11-10
- **Corrigido:** pede so permissao de microfone (loop de permissao travava o afinador) (`bbea1b5`)

## v1.0.40 — 2026-11-10
- **Alterado:** atualiza pendencias e lembrete dos testes no proximo build (`94e74c5`)

## v1.0.39 — 2026-11-10
- **Adicionado:** testes automatizados do detector MPM rodando no build (`4378c69`)

## v1.0.38 — 2026-11-10
- **Melhorado:** sensibilidade controla a clareza minima no microfone (0.85 / 0.75 / 0.65) (`4bd93c9`)

## v1.0.37 — 2026-11-10
- **Melhorado:** aba devices vira subtela Entradas de audio em Ajustes (`b431cf1`)

## v1.0.36 — 2026-11-10
- **Removido:** sobras do template (nome app-template, link profundo, tablet no iOS e expo-audio sem uso) (`a334c57`)

## v1.0.35 — 2026-11-10
- **Removido:** permissoes nao usadas (bluetooth, chamadas, notificacao e servico em segundo plano) (`4f3b544`)

## v1.0.34 — 2026-11-10
- **Corrigido:** afinacao Open G (D2 G2 D3 G3 B3 D4) (`70c6034`)

## v1.0.33 — 2026-11-10
- **Melhorado:** nomes das afinacoes e abas em portugues (`dc034c9`)

## v1.0.32 — 2026-11-10
- **Corrigido:** microfone nao grava mais em segundo plano (keepAwake desligado e pausa ao sair do app) (`9cab39f`)

## v1.0.31 — 2026-11-09
- **Alterado:** registra captacao por cabo, estabilidade do mic e proximas melhorias (`b0aab6e`)

## v1.0.30 — 2026-11-09
- **Adicionado:** corte acima de 1000 Hz e dobra de oitava no modo microfone (`213dc81`)

## v1.0.29 — 2026-11-09
- **Adicionado:** estabilidade no modo microfone (confirmacao de nota, protecao de oitava, segura nota) (`cb8512a`)

## v1.0.28 — 2026-11-09
- **Adicionado:** modo cabo automatico com limites de ruido e clareza proprios (`1ceb5f9`)

## v1.0.27 — 2026-11-09
- **Alterado:** diagnostico: mostra RMS, clareza e amostras por callback na tela do afinador (`4b6228c`)

## v1.0.26 — 2026-11-09
- **Adicionado:** tela de teste listando entradas de audio (etapa 1 do cabo) (`baef63f`)

## v1.0.25 — 2026-11-08
- **Adicionado:** versao automatica e CHANGELOG gerado a cada build (`6f92f1a`)

## v1.0.24 — 2026-11-08
- **Alterado:** Manter tela ligada enquanto o afinador esta ativo (`8765da5`)

## v1.0.23 — 2026-09-25
- **Alterado:** Seat the state arc per ring style, and lighten the idle colour (part 3 of 3) (`1fed57c`)

## v1.0.22 — 2026-09-25
- **Alterado:** Let the dial ring be chosen in settings (part 2 of 3) (`1eaee6d`)

## v1.0.21 — 2026-09-25
- **Alterado:** Draw the dial from the ring artwork (part 1 of 3) (`d686777`)

## v1.0.20 — 2026-09-25
- **Alterado:** Add the processed dial ring artwork (`1c492e7`)

## v1.0.19 — 2026-09-25
- **Alterado:** Drive the ring colour from the tuning state (`d9e4395`)

## v1.0.18 — 2026-09-24
- **Alterado:** Use the real app artwork for the icons (`8202d9c`)

## v1.0.17 — 2026-09-22
- **Alterado:** build APKs from main, keep the manual trigger (`1ec6778`)

## v1.0.16 — 2026-09-22
- **Alterado:** Fix UI lag: make pitch detection ~36x cheaper (`ee232fb`)

## v1.0.15 — 2026-09-22
- **Alterado:** build release APK so JS is bundled (runs without Metro) (`8b3ef92`)

## v1.0.14 — 2026-09-22
- **Alterado:** drop failing setup-android step, use runner's SDK; Node 22 (`ded23a2`)

## v1.0.13 — 2026-09-22
- **Alterado:** Add app icons and a PC-free Android build workflow (`0b88482`)

## v1.0.12 — 2026-09-22
- **Alterado:** Fix A4 changes not applying live; add sensitivity control (`8c7e878`)

## v1.0.11 — 2026-09-02
- **Alterado:** Gate tuner display on detection clarity to reject ambient noise (`7e0dd57`)

## v1.0.10 — 2026-09-02
- **Alterado:** Fix A4 calibration and restore per-string tuner display (`4bcd3f8`)

## v1.0.9 — 2026-09-02
- **Alterado:** Remove unused dependencies and config (`b8d84b6`)

## v1.0.8 — 2026-09-02
- **Alterado:** Remove Manus platform remnants (`9f52b08`)

## v1.0.7 — 2026-09-02
- **Alterado:** Update docs to match current MPM architecture (`b744e83`)

## v1.0.6 — 2026-09-02
- **Alterado:** Remove dead scaffolding: junk files and unused login/backend (`5390f70`)

## v1.0.5 — 2026-07-10
- **Alterado:** Patch gesture-handler SVG interface, loosen version pin (`f393aed`)

## v1.0.4 — 2026-07-08
- **Alterado:** Replace YIN with McLeod Pitch Method (MPM) for pitch detection (`1a7ced4`)

## v1.0.3 — 2026-07-07
- **Alterado:** Add string-lock (manual) tuning mode to PitchLabDisplay (`cb78d5c`)

## v1.0.2 — 2026-07-07
- **Alterado:** Add scratch/leftover files (_lixo, arquivos.txt) (`8f0618e`)

## v1.0.1 — 2026-07-07
- **Alterado:** Initial commit: Pro Tuner chromatic tuner app (`07292af`)
