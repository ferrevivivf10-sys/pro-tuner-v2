# Gravações de 14/11/2026 — comparação das fontes do microfone

Gravadas no modo de teste da **v1.0.62** (`0391f1b`), Moto Edge 40 Neo, violão,
sensibilidade Alta, filtro desligado, A4 = 440 Hz. Em todas: as 6 cordas soltas,
da grave para a aguda, afinando quando precisava.

| # | Arquivo | Fonte pedida → usada | Ambiente | Leituras erradas aceitas (v1.0.62 → correção) |
|---|---|---|---|---|
| 1 | `1-padrao-barulho` | Padrão → mic | barulho de fundo | 2 → 0 |
| 2 | `2-padrao-calmo` | Padrão → mic | calmo | 0 → 0 |
| 3 | `3-voz-musica` | Voz → voiceRecognition | música tocando | 21 → 0 |
| 4 | `4-voz-barulho` | Voz → voiceRecognition | barulho de fundo, sem música | 6 → 0 |
| 5 | `5-cru-barulho` | Cru → mic (sem suporte) | barulho de fundo | 5 → 0 |
| 6 | `6-cru-barulho-2` | Cru → mic (sem suporte) | barulho de fundo | 4 → 0 |

## Arquivos

- `.wav`: o áudio exato que o detector recebeu (44,1 kHz, mono, 16 bits).
- `.csv`: uma linha por leitura: `amostra_fim, rms, freq_crua, clareza, status, freq_saida`.
  A primeira linha traz versão, fonte pedida e fonte usada.

## Conclusões

- Os erros apareceram só no fim da nota (som fraco) ou em ruído sem corda tocada:
  sub-harmônicos (f/2, f/3), cordas vibrando por simpatia e ruído.
  Corrigido com a regra do ataque em `src/audio/stability.ts`.
- A **Padrão** continua como fonte padrão. A Voz aceitou mais leituras erradas
  com o mesmo barulho, e o sinal dela chega ~3x mais fraco.
- A **Cru** (`UNPROCESSED`) não é suportada neste celular: o Android abre a `mic`.
- A gravação 3 teve música ao fundo, então não serve para comparar as fontes.
