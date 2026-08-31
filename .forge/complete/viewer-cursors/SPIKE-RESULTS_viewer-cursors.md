---
feature: viewer-cursors
sprint: S1 (spike)
language: pt-BR
generated: 2026-08-27
machine: Windows 11 Pro 10.0.26200 x64, dois monitores
---

# SPIKE-RESULTS - viewer-cursors

Resultados REAIS das duas sondas do Sprint S1, rodadas nesta maquina com
`npm run pointer:probe` (`scripts/pointer-probe.mjs`). Nada aqui e teoria: cada
numero abaixo veio da saida JSON do proprio script.

## 0. Ambiente medido

| Item | Valor |
|---|---|
| Electron | 43.4.1 |
| Chromium | 150.0.7871.224 |
| Node (dentro do Electron) | 24.18.1 |
| Windows | 10.0.26200 |
| Arquitetura | x64 |
| Monitores | 2 |
| Display 1 (primario) | id `390701056`, bounds `{ x: 0, y: 0, width: 2048, height: 1152 }`, scaleFactor **1.25** |
| Display 2 | id `3191376985`, bounds `{ x: -1920, y: 0, width: 1920, height: 1080 }`, scaleFactor **1** |

A maquina cobre de graca os dois casos dificeis previstos nos edge cases do
SPEC: **escala de DPI diferente de 100%** (1.25 no primario) e **monitor com
origem NEGATIVA** (`bounds.x = -1920`), que e o caso classico que quebra codigo
de posicionamento.

## 1. Veredito por item

| Sonda | # | Pergunta | Resultado medido | Veredito |
|---|---|---|---|---|
| A | 1 | A janela transparente sobe e fica visivel? | `isVisible: true`, `isDestroyed: false`, bounds pedidos == bounds obtidos | **CONFIRMADO** |
| A | 2 | CONTROLE: sem protecao, o retangulo magenta ENTRA na captura do proprio processo? | media RGB da regiao = **(255.0, 0.0, 255.0)** em 961 pixels | **CONFIRMADO** |
| A | 3 | Com `setContentProtection(true)`, o magenta SOME da captura? | media RGB da MESMA regiao = **(89.9, 96.9, 71.0)**, `magentaPresent: false`, sem excecao, thumbnail nao vazio | **CONFIRMADO** |
| A | 4 | A janela sobrevive a protecao (continua viva, visivel e aceita click-through)? | `isVisible: true`, `isDestroyed: false`, bounds inalterados, `setIgnoreMouseEvents(true)` sem erro | **CONFIRMADO** |
| A | 5 | O clique atravessa a janela e chega ao aplicativo por baixo? | **sem veredito automatico** (ver 2.4) | **PENDENTE DE CONFIRMACAO MANUAL** |
| B | 1 | Toda fonte de tela do `desktopCapturer` casa com um `display`? | 2 fontes, 2 displays, `allMatched: true` | **CONFIRMADO** |
| B | 2 | O `display.bounds` leva a janela ao monitor certo? | 2 de 2 com `getDisplayMatching` devolvendo o id pedido e bounds EXATOS | **CONFIRMADO** |
| B | 3 | A captura ESCALA em vez de preencher com barras? | delta de proporcao **0.000%** nos dois monitores | **CONFIRMADO** |
| B | 4 | O que `display_id` devolve com UM monitor so? | maquina tem 2 monitores; nenhum `display_id` veio vazio (ver 3.4) | **REGISTRADO** (nao aplicavel aqui) |

**Conclusao geral: as duas premissas de plataforma do SPEC se sustentam nesta
maquina.** As sete verificacoes automatizadas passaram, o script saiu com codigo
0, e o desenho da feature (overlay transparente protegido da propria captura,
posicionado pelo `display.bounds` da fonte escolhida) esta liberado. O unico item
sem veredito e o A5, que ja estava previsto como verificacao humana e que ja
consta do checklist manual (T8, AC-10/RF-09).

## 2. Sonda A - `setContentProtection` tira a janela da PROPRIA captura

Montagem: uma `BrowserWindow` com as opcoes exatas do contrato 5.C7 do SPEC
(`frame: false`, `transparent: true`, `backgroundColor: '#00000000'`,
`hasShadow: false`, `skipTaskbar: true`, `focusable: false`, `show: false` e
`showInactive()` depois, `alwaysOnTop` com nivel `screen-saver`,
`backgroundThrottling: false`), cobrindo o monitor primario inteiro
(2048 x 1152), com um retangulo MAGENTA opaco de 200 x 200 pontos em
`(120, 120)` dentro da janela.

A regiao amostrada e o miolo do retangulo (25% de recuo de cada lado), mapeada
para o thumbnail de 640 x 360 devolvido pelo `desktopCapturer`: retangulo
`left: 53, top: 53, right: 84, bottom: 84`, ou seja **961 pixels** por amostra.
`getBitmap()` do Electron devolve BGRA e o script converte.

### 2.1 Item 2 (CONTROLE) - sem protecao

```json
"withoutProtection": {
  "sourceId": "screen:0:0",
  "sourceName": "Tela 1",
  "sourceDisplayId": "390701056",
  "sample": { "r": 255, "g": 0, "b": 255, "pixels": 961 },
  "magentaPresent": true
}
```

Magenta puro, sem uma unidade de desvio. Este item existe justamente porque um
resultado negativo no item 3 sem controle seria ambiguo (poderia ser apenas uma
captura que nao pega nada).

### 2.2 Item 3 - com `setContentProtection(true)`

```json
"withProtection": {
  "protectionError": null,
  "sample": { "r": 89.9, "g": 96.9, "b": 71, "pixels": 961 },
  "magentaPresent": false,
  "thumbnailEmpty": false
}
```

A chamada nao lancou, o thumbnail continuou VALIDO (a captura do resto da tela
segue funcionando, `thumbnailEmpty: false`) e a mesma regiao passou a mostrar o
papel de parede por baixo, em tons de verde acinzentado. **A janela sai da
captura do proprio processo, e so ela.**

### 2.3 Item 4 - efeitos colaterais

```json
"sideEffects": {
  "isVisibleAfterProtection": true,
  "isDestroyedAfterProtection": false,
  "boundsAfterProtection": { "x": 0, "y": 0, "width": 2048, "height": 1152 },
  "setIgnoreMouseEventsError": null
}
```

A janela continua viva, visivel ao sistema e no mesmo lugar; `setIgnoreMouseEvents(true)`
foi aceito sem excecao.

### 2.4 Item 5 - clique atravessando a janela (MANUAL, nao confirmado)

O script imprime a instrucao para o operador ("o retangulo magenta esta em
(120, 120) do monitor primario; confirme que voce o VE e clique dentro dele para
conferir que o clique chega ao aplicativo por baixo") e espera o tempo definido
em `ZOI_POINTER_PROBE_MANUAL_WAIT_MS` (padrao 0).

**Esta rodada foi executada em modo autonomo, sem operador humano na frente da
maquina. Portanto o item 5 NAO esta confirmado e nao esta sendo declarado como
confirmado.** O que se sabe pela via automatica: a janela nao foi destruida,
continua `isVisible: true` e aceitou `setIgnoreMouseEvents(true)` sem erro.
Nenhum veredito automatico foi inventado para o clique em si, conforme o SPEC
manda ("Nao inventar veredito automatico aqui").

Este item ja estava previsto no checklist manual da feature (T8, AC-10/RF-09:
"clicar atraves do overlay e o clique chegar ao aplicativo por baixo"), entao ele
segue por aquele caminho. Para executa-lo com o operador presente:

```
set ZOI_POINTER_PROBE_MANUAL_WAIT_MS=30000
npm run pointer:probe
```

## 3. Sonda B - fonte do `desktopCapturer` para monitor fisico

### 3.1 Item 1 - a ponte de ids existe

| `source.id` | `source.name` | `source.display_id` | `display.id` casado | `display.bounds` | `scaleFactor` |
|---|---|---|---|---|---|
| `screen:0:0` | Tela 1 | `390701056` | `390701056` | `{ x: 0, y: 0, w: 2048, h: 1152 }` | 1.25 |
| `screen:1:0` | Tela 2 | `3191376985` | `3191376985` | `{ x: -1920, y: 0, w: 1920, h: 1080 }` | 1 |

`allMatched: true`. O `display_id` do `desktopCapturer` e a representacao em
string do `display.id` de `screen.getAllDisplays()`, sem nenhuma conversao. E
exatamente a ponte que `CaptureSource.displayId` (`src/main/capture.ts:49`) ja
carrega ate o renderer hoje sem ninguem consumir.

### 3.2 Item 2 - o `bounds` posiciona a janela no monitor certo

| display pedido | bounds pedido | bounds devolvido | `getDisplayMatching().id` | exato? |
|---|---|---|---|---|
| `3191376985` | `{ -1920, 0, 1920, 1080 }` | `{ -1920, 0, 1920, 1080 }` | `3191376985` | sim |
| `390701056` | `{ 0, 0, 2048, 1152 }` | `{ 0, 0, 2048, 1152 }` | `390701056` | sim |

`allOk: true`. Os dois casos de risco cairam de pe: o monitor com **origem
negativa** (`x: -1920`) e o monitor com **DPI 125%**. `BrowserWindow.setBounds`
e `display.bounds` vivem no MESMO espaco de coordenadas em pontos, entao nao ha
conversao manual de DPI a fazer (risco R12 fechado).

### 3.3 Item 3 - a captura ESCALA, nao preenche com barras

| display | bounds | proporcao do display | `videoWidth x videoHeight` | proporcao da track | delta |
|---|---|---|---|---|---|
| `3191376985` | 1920 x 1080 | 1.77778 | 1280 x 720 | 1.77778 | **0.000%** |
| `390701056` | 2048 x 1152 | 1.77778 | 1280 x 720 | 1.77778 | **0.000%** |

Medido pelo caminho que o app usa de verdade: `setDisplayMediaRequestHandler`
armando a fonte de tela e `getDisplayMedia` com as constraints do preset
`p720_30` (`width ideal 1280`, `height ideal 720`, `frameRate ideal 30`),
`audio: false`. `track.getSettings()` devolveu `1280 x 720` e o
`video.videoWidth/videoHeight` confirmou o mesmo par.

Note o segundo monitor: `2048 x 1152` foi entregue como `1280 x 720`, ou seja o
Chromium **reescalou** preservando a proporcao, sem barras. E o que sustenta a
decisao 3/T4 do SPEC de o overlay do transmissor nao precisar de calculo de
letterbox: `x` e `y` normalizados mapeiam direto para
`x * larguraDoOverlay` e `y * alturaDoOverlay`.

### 3.4 Item 4 - o caso de UM SO monitor

Esta maquina tem DOIS monitores, entao o caso nao pode ser observado aqui:
`rawDisplayIds` veio `["390701056", "3191376985"]` e `anyEmpty: false`. Registrado
como nao observavel nesta maquina, e nao como sucesso. O ramo do contrato 5.C7
que cai em `screen.getPrimaryDisplay()` quando `displayId` e `null` ou nao casa
com nenhum display continua sendo o caminho previsto para maquinas de um monitor
so, e continua sem prova empirica ate alguem rodar a sonda numa dessas.

## 4. O que isto libera

- **Sonda A confirmada** libera a invariante RF-05 (a posicao viaja como DADO,
  nunca como PIXEL): o overlay do transmissor pode desenhar os cursores dos
  espectadores sobre a tela real sem que eles voltem para dentro do video.
- **Sonda B confirmada** libera RF-08 (o overlay cobre SO o monitor
  compartilhado) e fecha o risco R12 (DPI e coordenadas negativas).
- **Pendencia unica:** item A5 (clique atravessando), que segue para o checklist
  manual como ja estava planejado.
