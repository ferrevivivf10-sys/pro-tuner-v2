# Pro Tuner

Afinador cromático para violão e guitarra de 6 cordas, feito em **React Native +
Expo (SDK 54)**. Alvo atual: **Android**. Capta o som pelo microfone do celular
ou por cabo (saída P3/P10 do instrumento via USB-C), detecta a frequência com o
**McLeod Pitch Method (MPM)** e mostra nota, desvio em cents e a corda.

Tudo roda no aparelho: sem backend, sem login, sem envio de dados.

---

## Build

O APK é gerado pelo GitHub Actions (`.github/workflows/android-build.yml`):

- roda a cada push na `main` (exceto mudanças só em `.md`) ou manualmente;
- passos: `npm install` → checar tipos (`tsc`) → testes → `expo prebuild` →
  `gradlew assembleRelease`;
- o APK sai como artefato `pro-tuner-vX.Y.Z` na página do build;
- versão automática: `1.0.<nº de commits>` (`scripts/version.js`);
- na `main`, o `CHANGELOG.md` é gerado e commitado sozinho (`scripts/changelog.js`).

Local (com Android SDK instalado):

```bash
npm install
npm run android   # build de desenvolvimento no aparelho/emulador
```

| Script | O que faz |
|--------|-----------|
| `npm run check` | Checa tipos (`tsc --noEmit`) |
| `npm test` | Testes automatizados (`tests/*.test.mjs`) |
| `npm run lint` | ESLint (`expo lint`) |
| `npm run format` | Prettier |
| `npm run android` | Build de desenvolvimento Android |

---

## Detecção (`src/audio/MPMProcessor.ts`)

Janela de 2048 amostras a 44,1 kHz, faixa de **60 a 1200 Hz**.

1. **Normalização por RMS**: abaixo de 0,0008 é silêncio; sinais fracos recebem ganho.
2. **Estágio grosseiro**: NSDF no sinal decimado 4x (~11 kHz).
3. **Escolha do pico**: o primeiro pico com pelo menos 90% do maior.
   - **Pico híbrido**: se o resultado ficar uma oitava abaixo de um pico com 85%
     (notas a partir de 125 Hz), usa o de cima. Corrige o Mi agudo.
   - **Conferência em taxa cheia**: picos acima de 85% são conferidos no sinal
     completo (95% do maior). Corrige o ataque do Si e do Mizinho lido como f/3.
4. **Refino em taxa cheia** com interpolação parabólica (precisão sub-amostra).
5. **Sub-harmônico**: se a NSDF em 2T ou 3T supera a de T em 0,05, usa f/2 ou f/3.
   Corrige o ataque do nylon lido uma oitava acima.
6. **Clareza (0 a 1)**: o quanto o sinal é periódico; abaixo de 0,3 é descartado.

### Estabilidade (`src/hooks/usePitchDetectorFinal.ts`)

Só no microfone (no cabo o sinal já é limpo):

- gate de ruído 0,0025 e clareza mínima pela sensibilidade (Alta 0,65 · Média 0,75 · Baixa 0,85);
- leituras acima de 700 Hz descartadas (ruído do ambiente);
- nota nova só após 2 leituras seguidas (pulo de oitava: 3);
- dobra de oitava: harmônico 2x conta como a mesma nota, só se a nota estável
  for uma corda da afinação (até 150 cents);
- filtro passa-baixa 1500 Hz opcional, só no modo de teste.

O display (`src/components/PitchLabDisplay.tsx`) segura a nota por 400 ms após o
som sumir.

---

## Cabo (`src/audio/cableMode.ts`)

- Entrada USB ou fone com fio disponível = modo cabo ("Ativo · Cabo").
- Com o afinador ativo, a lista de entradas é relida a cada 2,5 s; ao trocar
  mic ↔ cabo a captura reinicia sozinha.
- No cabo: gate 0,003 e clareza mínima 0,6, sem as regras de estabilidade.

Limitação: a `@siteed/audio-studio` 3.x não permite escolher a fonte de áudio
"sem processamento" do Android (só na 4.x, em beta). Medido: o microfone já
chega praticamente cru.

---

## Monitor da taxa de entrega (`src/audio/rateMonitor.ts`)

Mede quantas amostras o app recebe por segundo de relógio (inclinação do total
acumulado × tempo, janela de 4 s). Detecta atraso, perda ou interrupção do fluxo
entregue ao app. **Não** mede a taxa física do conversor: o Android pode
reamostrar antes de entregar.

- Fora de 44.100 ± 2% por 2 s seguidos: aviso na tela e nenhuma nota exibida
  (a frequência não é "corrigida").
- Sem amostras por mais de 1 s: aviso de captura parada.
- O limite de 2% é inicial; a taxa medida vai para o CSV do modo de teste
  (coluna `taxa_entrega`) para ser validada no aparelho.

---

## Modo de teste

Liga em **Ajustes → Modo de teste**. Mostra um botão de gravar e dados técnicos
na tela. Grava até 120 s e salva, numa pasta escolhida pelo usuário:

- `.wav`: o áudio exato que o detector recebeu;
- `.csv`: uma linha por leitura (amostra, RMS, frequência crua, clareza, status,
  frequência mostrada, taxa de entrega medida).

Essas gravações são usadas para validar mudanças offline antes de gastar build.

---

## Testes (`tests/`)

`npm test` roda com o Node (sem dependências instaladas):

- `mpm.test.mjs`: senos, harmônicos e trechos reais de violão em
  `tests/fixtures/` (Mi agudo, ataque do nylon, ataque do Si e do Mizinho);
- `cable.test.mjs`: lógica do modo cabo (plugar/desplugar, releitura sem
  sobreposição, falhas);
- `rate.test.mjs`: monitor da taxa de entrega (44.100, 43.000 e 45.000
  amostras/s, intervalos irregulares, rajadas, interrupção, buffer vazio).

---

## Configurações (`src/utils/SettingsManager.ts`, AsyncStorage)

| Campo | Padrão | Descrição |
|-------|--------|-----------|
| `refA4` | 440 | Referência do Lá (432, 438, 440, 442 ou 444 Hz) |
| `selectedTuning` | `Standard` | Afinação |
| `sensitivity` | 0,7 (Média) | Baixa 0,4 · Média 0,7 · Alta 0,9 (só microfone) |
| `ringStyle` | — | Estilo do mostrador |
| `testMode` | desligado | Modo de teste |
| `testLowpass` | desligado | Filtro 1500 Hz (só no modo de teste) |
| `noiseThreshold` | 0,005 | Salvo, mas **não usado**: o gate é fixo no código |

Afinações (`src/utils/noteUtils.ts`):

| Afinação | Cordas |
|----------|--------|
| Padrão | E2 A2 D3 G3 B3 E4 |
| Drop D | D2 A2 D3 G3 B3 E4 |
| Meio tom abaixo | D#2 G#2 C#3 F#3 A#3 D#4 |
| Um tom abaixo | D2 G2 C3 F3 A3 D4 |
| Open G | D2 G2 D3 G3 B3 D4 |

---

## Estrutura

```
app/
  _layout.tsx               Layout raiz (tema, safe-area, gestos)
  audio-inputs.tsx          Ajustes → Entradas de áudio (diagnóstico)
  (tabs)/
    _layout.tsx             Abas (Afinador + Ajustes)
    index.tsx               Tela do afinador (mic/cabo, modo de teste)
    settings.tsx            Ajustes
src/
  audio/
    MPMProcessor.ts         Detecção (MPM)
    cableMode.ts            Lógica do modo cabo
    rateMonitor.ts          Monitor da taxa de entrega de amostras
    TestRecorder.ts         Gravação do modo de teste (.wav + .csv)
  hooks/
    usePitchDetectorFinal.ts  Captura + detecção + estabilidade
  components/
    PitchLabDisplay.tsx     Tela do afinador (nota, cents, cordas)
    TunerDial.tsx           Mostrador (estilos de anel)
  utils/
    noteUtils.ts            Frequência ↔ nota, afinações
    SettingsManager.ts      Configurações
components/, hooks/, lib/, constants/   Tema e UI base (vindos do template, em uso)
scripts/                    Versão, changelog e patch do gesture-handler
tests/                      Testes automatizados e trechos reais de áudio
```

---

## Limitações conhecidas

- Baixo não é suportado: a faixa começa em 60 Hz (o Mi do baixo é 41 Hz).
- iOS tem código de captura, mas não é alvo nem testado. O suporte web foi removido.
- O APK usa a assinatura de debug (assinatura própria ainda pendente).

---

## Privacidade

Única permissão: **microfone** (`RECORD_AUDIO`). Nada é enviado para fora do
aparelho. Áudio só é salvo quando o usuário liga o modo de teste, grava e
escolhe a pasta.
