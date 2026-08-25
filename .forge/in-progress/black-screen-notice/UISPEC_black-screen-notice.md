---
feature: black-screen-notice
language: pt-BR
generated: 2026-08-25
status: uispec
reference_mode: project-identity (familia de overlays do player)
source: render-captured (ReconnectOverlay e MediaFailureOverlay forcados via harness throwaway, revertido; ver secao 8)
---

# UISPEC - black-screen-notice

## 1. Baseline (ancora de drift)

- HEAD no momento da captura: `264318e6f7aeca748d7707e3308ec61256ceae7b` (branch `feature/black-screen-notice`)
- Fingerprints (git hash-object) conferidos e IDENTICOS aos registrados no CONTEXT_black-screen-notice.md (sem drift desde entao):
  - `src/renderer/src/ui/screens/PlayerView.tsx` - `8c19aed07505b9e3c3ef946c6ae9381c646e196e`
  - `src/renderer/src/ui/components/ReconnectOverlay.tsx` - `905e6d388abf436aca091cdf8ee87aa3da54d9ec`
  - `src/renderer/src/ui/components/MediaFailureOverlay.tsx` - `cb48826f23d931a0b19188267ad24f1343d0ba58`
  - `src/renderer/src/ui/components/TransmissionStatusCard.tsx` - `85759021a38a3307348123201d04972522ca3327`
  - `src/renderer/src/ui/screens/RoomScreen.tsx` - `173beb6e384d52b421784a7deee947435a190206`
  - `src/renderer/src/ui/screens/player.css` - `19f7ba2209601641f8c50478f30027f65ee5c6d5`
  - `src/renderer/src/ui/theme.css` - `9bb42a60b97c49461c2d146f8dafc8fad42b3b2d`
  - `src/renderer/src/ui/components/components.css` - `5ddabd594454f701657686a09570b6836bf8b704`
  - `src/renderer/src/ui/screens/room.css` - `6c8d1f62744a37feb513e96d15421eb86db49e0c`
  - `src/renderer/src/assets/brand/logo-goiaba.png` - `3d4c9ef389810772d72638cef0c3fa647bd04aed`

Mudanca em qualquer um destes arquivos invalida (ou exige reconferir) este UISPEC.

## 2. Alvos de referencia

Todas as imagens estao em `<FEATURE_DIR>/ui-refs/` (gitignored). RENDER-CAPTURADAS via Playwright `_electron` (headless), 2 instancias reais (Pontin transmitindo, Bruna assistindo) pelo servidor publico de sinalizacao, sobre o build de `out/`. Para os dois overlays de precedencia (`ReconnectOverlay`/`MediaFailureOverlay`) foi usado um harness THROWAWAY (ver secao 8) que forcava as props via um flag de `window`, ja revertido (`git status --short` limpo ao final, confirmado).

| Arquivo | O que mostra |
|---|---|
| `09-status-card-tile-render.png` | `TransmissionStatusCard` variante `tile`, render real: card com logo, titulo "Transmissao iniciada", badges de fonte/audio/espectadores e o hint. Referencia de MOTION para a entrada da logo (RF-18) e para o idioma de stagger dos detalhes (RF-19 nao se aplica aqui, mas o mecanismo `.z-item-enter` sim). |
| `10-playerview-remote-live.png` | `PlayerView` da Bruna assistindo Pontin, video REAL fluindo, controles visiveis. Este e o ALVO DE LAYOUT: onde a nova notificacao de tela preta precisa caber (area do `.z-player`, acima da barra de controles). Canto superior direito redigido (ver nota de privacidade, secao 8). |
| `11-room-aside-live-pulse.png` | Sidebar de participantes do Pontin com o badge "ao vivo" (`z-live-dot`, `z-live-pulse`), o PRECEDENTE DIRETO do loop continuo leve que RF-19 pede para o indicador de espera. |
| `12-reconnect-overlay-render.png` | **ALVO PRINCIPAL**: `ReconnectOverlay` REAL renderizado sobre o video ao vivo da Bruna (forcado via harness), com o spinner `z-spinner--lg` girando, texto "reconectando..." e hint. Prova visual exata do que RNF-09 exige que o novo terceiro estado imite. |
| `13-media-failure-overlay-render.png` | **ALVO PRINCIPAL**: `MediaFailureOverlay` REAL renderizado sobre o mesmo video (forcado via harness), icone de alerta laranja em circulo, fundo mais opaco que o `ReconnectOverlay`. Segundo ALVO PRINCIPAL desta recon. |

## 3. Design tokens (computados, ligados as CSS vars reais)

Fonte: `src/renderer/src/ui/theme.css` `:root` (unica fonte de tokens; confirmado nos renders 09-13: nenhuma tela redefine cor/tipografia inline).

### Cores
- `--bg-app: #0e0b12` (fundo da janela)
- `--bg-surface: #17131e` (fundo do `.z-status-card`, confirmado no render 09)
- `--bg-elevated: #201a2b`
- `--accent: #9d00ff` (roxo de marca, confirmado no botao "Transmitir" nos renders)
- `--accent-hover: #b23dff` (cor do aro do spinner, confirmado no render 12)
- `--text-primary: #f2eef7`
- `--text-secondary: #a99bc0` (hint do reconnect/failure, confirmado nos renders 12/13)
- `--text-muted: #6e6285`
- `--warning: #ffb224` (icone do `MediaFailureOverlay`, confirmado no render 13: circulo e triangulo em laranja)
- `--danger: #ff3d5e` (badge "ao vivo", confirmado no render 11)
- `--border: #2c2438`
- Overlay do `ReconnectOverlay`: `#000000a6` (fundo semi-opaco, confirmado visualmente no render 12: video ainda visivel atras, mais escuro)
- Overlay do `MediaFailureOverlay`: `#000000d9` (mais opaco que o reconnect, confirmado no render 13: video quase ilegivel atras)
- Fundo do icone do `MediaFailureOverlay`: `#ffb2241f` (circulo laranja translucido atras do `AlertIcon`, confirmado no render 13)

### Tipografia
- `--font-family: 'Inter', 'Segoe UI', system-ui, sans-serif`
- `--text-meta: 12px` (badges do status card)
- `--text-secondary-size: 13px` (hint dos overlays)
- `--text-subtitle: 16px` (texto principal `.z-reconnect__text`, titulo `.z-status-card__title`), peso 500/600
- Confirmado nos renders: `.z-reconnect__text` ("reconectando...", "O video de Pontin nao chegou ate voce") em destaque acima do hint secundario, exatamente como cataloga o CSS.

### Geometria
- `--radius-card: 12px` (status card, `.z-player`)
- `--radius-pill: 999px` (badges)
- `--space-1..12`: 4/8/12/16/24/32/48px
- Icone circular do `MediaFailureOverlay`: 44x44px, `border-radius: 50%`
- Spinner do `ReconnectOverlay`: `.z-spinner--lg` 34x34px, borda 3px

### Movimento (regra do app: SO transform/opacity)
- `--dur-fast: 120ms`, `--dur-enter: 180ms`, `--dur-screen: 240ms`
- `--ease: cubic-bezier(0.2, 0, 0, 1)` (easing UNICO do app para tudo que nao for a logo do status card)
- `prefers-reduced-motion: reduce` zera `--dur-*` para `0ms` E forca `animation-duration/transition-duration: 0.001ms !important` + `animation-iteration-count: 1 !important` em `*` globalmente (`theme.css` linhas 62-77). Isso vale automaticamente para qualquer `@keyframes` novo desta feature que use as CSS vars; se alguma duracao ficar hardcoded (como o bounce da logo, que usa `480ms` fixo), a regra global ainda pega porque usa `!important` sobre `animation-duration`.

## 4. Inventario de componentes (reutilizar estes)

- `src/renderer/src/ui/components/ReconnectOverlay.tsx` + `src/renderer/src/ui/components/MediaFailureOverlay.tsx` - os DOIS IRMAOS MAIS VELHOS desta feature. O novo estado ("aguardando primeiro quadro") nasce como um TERCEIRO componente irmao (nome sugerido no CONTEXT: algo como `FirstFrameOverlay`/`WaitingOverlay`), reaproveitando a MESMA classe base `.z-reconnect` (cartao central, `role="status"`, `data-testid` proprio) e adicionando so o que for exclusivo (indicador de espera com a logo, crossfade de estagio).
- `src/renderer/src/ui/screens/PlayerView.tsx` linhas 167-169 - ponto de integracao exato. Hoje: `{reconnecting ? <ReconnectOverlay/> : null}` seguido de `{!reconnecting && failed ? <MediaFailureOverlay/> : null}`. O novo overlay entra como um TERCEIRO ramo, condicionado a `!reconnecting && !failed && <ainda sem primeiro quadro>` - a ordem de precedencia (RF-08/AC-08) ja e o padrao JSX existente, so estender.
- `src/renderer/src/ui/screens/player.css` `.z-reconnect` (linha 142-153), `.z-reconnect__text` (155-158), `.z-reconnect__hint` (160-165), `.z-reconnect--failure` (168-170), `.z-reconnect__icon` (172-181) - vocabulario CSS completo pronto para herdar; confirmado pixel a pixel nos renders 12/13.
- `src/renderer/src/ui/components/components.css` `.z-spinner`/`.z-spinner--lg` (728-741) - o loop continuo JA aceito visualmente ao lado do video (usado dentro do proprio `ReconnectOverlay`, confirmado no render 12). Se o indicador de espera do RF-19 for um spinner (em vez da logo pulsando), este e o componente a reusar sem reinventar.
- `src/renderer/src/ui/components/TransmissionStatusCard.tsx` + `.z-status-card__logo` (`components.css` 774-786) - a referencia EXATA da entrada da logo pedida por RF-18: `<img src={logoGoiaba} className="z-status-card__logo (variante tile)">` com `animation: z-status-bounce-in 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both`. Confirmado no render 09 (logo em repouso, ja com a animacao de entrada disparada e concluida no momento da captura).
- `src/renderer/src/ui/theme.css` `@keyframes z-status-bounce-in` (linha 246-256), `z-count-roll-in` (259-269), `z-fade-rise`/`z-fade-in`/`z-spin`/`z-live-pulse` (165-215) - TODOS os keyframes reutilizaveis por nome, ja documentados na secao 6.
- `src/renderer/src/ui/screens/room.css` `.z-live-dot` (linha 281-287, `animation: z-live-pulse 2s ease-in-out infinite`) - o OUTRO precedente de loop continuo leve (so opacity), confirmado no render 11 junto ao badge "ao vivo" do `ParticipantCard`.
- `src/renderer/src/ui/theme.css` `.z-item-enter` + `--z-delay` inline (linha 284-287) - idioma UNICO de stagger do app; reusar para qualquer detalhe secundario do novo overlay (ex.: se o segundo estagio tiver mais de uma linha de texto).
- Logo do app: `src/renderer/src/assets/brand/logo-goiaba.png` (859x891px PNG raster) - MESMO arquivo, importar do mesmo caminho, dimensionar via CSS (o status card usa 84px/24px conforme variante).

## 5. Layout e padroes de interacao

- Scaffold confirmado nos renders: `.z-room` (coluna) > `.z-room__topbar` + `.z-room__body` (aside 268px fixo + `.z-room__main` flexivel). O `.z-player` ocupa TODO o `.z-room__main` quando uma transmissao de terceiro esta selecionada (render 10/12/13): `position: relative`, fundo preto, `border-radius: var(--radius-card)`, cantos arredondados visiveis mesmo com video full-bleed dentro (`object-fit: contain`).
- Os overlays da familia (`.z-reconnect` e variante `--failure`) SEMPRE cobrem a AREA DO VIDEO inteira via `position: absolute; inset: 0` dentro do `.z-player` (confirmado nos renders 12/13: o overlay cobre exatamente o retangulo do player, nao a janela toda, nao vazando sobre a sidebar/topbar). O novo overlay de espera deve seguir o MESMO `inset: 0` relativo ao `.z-player`, nunca `position: fixed` relativo a viewport.
- Conteudo do overlay sempre centralizado em coluna (`display:flex; flex-direction:column; align-items:center; justify-content:center; gap: var(--space-3)`), confirmado nos dois renders: icone/spinner no topo, texto principal em seguida, hint secundario por ultimo, largura do hint limitada (`max-width: 46ch`, texto centralizado).
- `PlayerControls` (barra inferior com gradiente escuro) fica ABAIXO/por cima do video mas fora do `.z-reconnect` (z-index/ordem DOM diferentes) - confirmado no render 10 (controles visiveis com video normal) e ausente nos renders 12/13 focados no overlay, mas o componente continua montado por baixo (o `PlayerView.tsx` sempre renderiza `<PlayerControls>` independente do overlay). O novo overlay NAO deve cobrir/disputar espaço com a barra de controles.
- Precedente de "bloco central com marca/icone + titulo + texto secundario": os dois overlays (12/13) e o `TransmissionStatusCard` (09) compartilham a MESMA composicao visual (icone/logo centralizado, titulo em destaque, texto secundario menor e mais claro). O novo overlay de espera deve seguir essa MESMA composicao, apenas trocando o elemento central por uma variante animada (logo com indicador de espera) em vez do spinner puro ou do icone de alerta.

## 6. CONTRATO DE MOTION (secao critica desta feature)

### 6.1 Vocabulario medido (nao adivinhado)

Todas as animacoes do app usam EXCLUSIVAMENTE `transform`/`opacity`. Easing unico do app inteiro: `cubic-bezier(0.2, 0, 0, 1)` (`--ease`). A UNICA excecao documentada e usada em producao e a entrada da logo do status card, que usa `cubic-bezier(0.34, 1.56, 0.64, 1)` (easeOutBack, overshoot) - isso e o precedente EXATO que RF-18 pede imitar ("no espirito do bounce ja usado no card de status").

Keyframes reais e reutilizaveis por nome (`theme.css`):

| Nome | Efeito | Duracao real de uso | Onde (confirmado nos renders) |
|---|---|---|---|
| `z-fade-in` | opacity 0->1 | `var(--dur-enter)` = 180ms | `.z-reconnect` (linha 152 de `player.css`: `animation: z-fade-in var(--dur-enter) var(--ease) both;`) - a entrada do overlay de reconexao E de falha de midia, confirmada estruturalmente (ambos usam a mesma classe base `.z-reconnect`) |
| `z-status-bounce-in` | opacity 0->1 + `scale(0.7)->1` | 480ms, timing `cubic-bezier(0.34, 1.56, 0.64, 1)` (hardcoded na regra, nao na `animation-timing-function` do keyframe) | `.z-status-card--tile .z-status-card__logo` - a logo bounce, confirmada em repouso no render 09 |
| `z-fade-rise` | opacity 0->1 + `translateY(8px)->0` | 220ms (custom, nao a var padrao) | `.z-status-card--tile .z-status-card__title`, com `animation-delay: 160ms` |
| `z-count-roll-in` | opacity 0->1 + `translateY(6px)->0` | `var(--dur-fast)` = 120ms | `.z-status-card__count-value`, remontado via `key={count}` no React a cada troca |
| `z-spin` | `rotate(360deg)` | 800ms linear infinite | `.z-spinner`/`.z-spinner--lg` dentro do `ReconnectOverlay` (confirmado girando no render 12) |
| `z-live-pulse` | opacity `1<->0.35` | 2s `ease-in-out` infinite | `.z-live-dot` (confirmado no render 11, badge "ao vivo") |
| `z-item-enter` (classe, nao keyframe) | usa `z-fade-rise` + `animation-delay: var(--z-delay, 0ms)` | 180ms + delay por indice | idioma padrao de stagger de listas |

Nao existe `z-count-roll-out` no codigo atual (so `z-count-roll-in` foi implementado; a saida do numero antigo simplesmente e substituida pelo `key` do React, sem animacao de saida dedicada - confirma o padrao geral do app de "so animar entrada", ver 6.2).

### 6.2 Padrao de saida do app (importante para RF-21)

Nenhum componente do app hoje tem keyframe de SAIDA dedicado (nem os overlays, nem o status card, nem as telas). O padrao observado e: o elemento e desmontado do DOM (React) e o que estava atras simplesmente aparece, sem cross-fade de saida. Isso e uma LACUNA real para RF-21 ("o aviso deve desaparecer com uma transicao suave, cedendo lugar ao video sem solavanco"): o app nao tem um precedente pronto de fade-out a reutilizar por nome. Duas rotas validas, ambas dentro do vocabulario existente:
1. Reusar `z-fade-in` com `animation-direction: reverse` (ou uma classe `.z-fade-exit` nova, keyframe identico invertido) por uma janela curta (sugestao: `var(--dur-enter)` = 180ms) antes de desmontar o overlay via `setTimeout`/estado de saida no React.
2. Fazer o video "vencer" o overlay por `opacity` via CSS puro: manter o overlay montado por 180ms extra com `opacity: 0` (transition, nao animation) quando a condicao de saida disparar, e so entao desmontar.
Qualquer uma cumpre RNF-03 (so opacity/transform) e AC-18; a decisao de qual mecanismo (CSS transition vs `animation reverse` vs estado de saida no React) fica para a implementacao, mas NAO deve inventar um terceiro padrao alem desses dois (ambos derivam de `z-fade-in`, unico keyframe de fade puro do app).

### 6.3 Contrato para os quatro momentos desta feature

**Momento 1 - Entrada do aviso (RF-18/AC-15), ao final da carencia de 1,5s:**
- Estrutura: reusar `.z-reconnect` como base (fundo `#000000a6` igual ao `ReconnectOverlay`, nao o mais opaco do `--failure`, ja que este e o estagio MAIS BRANDO dos tres da familia).
- Entrada do CARTAO inteiro: `z-fade-in var(--dur-enter) var(--ease) both` (180ms), IDENTICO ao que `.z-reconnect` ja faz - nunca um pop seco (nao usar `z-pop-in`/scale abrupto no cartao inteiro).
- Entrada da LOGO (elemento caracteristico, RF-18): reusar `z-status-bounce-in 480ms cubic-bezier(0.34, 1.56, 0.64, 1) both` exatamente como o `TransmissionStatusCard`, com um `animation-delay` pequeno (sugestao: 0-80ms) para a logo nao competir com o fade do cartao. NAO inventar um segundo bounce/cubic-bezier: reusar por nome.
- Texto principal: `z-fade-rise 220ms var(--ease) both` com delay ~160ms (mesmo padrao do titulo do status card), garantindo que o texto so estabiliza depois do pico do bounce da logo.

**Momento 2 - Indicador de espera vivo (RF-19/AC-16), loop continuo enquanto o primeiro estagio esta visivel:**
- Duas rotas validas, ambas ja precedentes REAIS no app (nao inventar um terceiro mecanismo de loop):
  - (a) Reusar `.z-spinner`/`.z-spinner--lg` puro (`z-spin 800ms linear infinite`, `transform: rotate` apenas) - o mesmo elemento visual que ja aparece dentro do `ReconnectOverlay` (confirmado no render 12), o que reforça a familia visual em vez de introduzir um quarto estilo de loading.
  - (b) A logo pulsando de leve (pedido explicito da IDEA secao 9: "a logo pulsando de leve"): um `@keyframes` novo, SO opacity (ex.: `opacity: 1 <-> 0.6`, no espirito de `z-live-pulse`, mas nunca reusar `z-live-pulse` 1:1 porque semanticamente ele significa "ao vivo", nao "aguardando"), 2s `ease-in-out infinite`, seguindo EXATAMENTE o padrao de custo de `z-live-pulse` (so `opacity`, sem `scale` continuo).
- CRITICO (RNF-02/RNF-09): este loop PARA de existir assim que o primeiro quadro pinta - o elemento e desmontado junto com o resto do overlay, nunca fica `display:none` rodando em background. Isso e diferente do `z-live-pulse` (que roda por toda a duracao da transmissao) e do `z-spin` do `ReconnectOverlay` (que roda so enquanto reconecta) - aqui o loop e ainda mais curto (so durante a espera do primeiro quadro), reforcando que o app ja tem 2 precedentes de "loop continuo peca-CPU-zero" e este e um terceiro, do mesmo tipo, nunca mais pesado que eles.
- `prefers-reduced-motion`: como o app zera `animation-iteration-count: 1 !important` globalmente, o loop (spinner OU logo pulsando) para na primeira iteracao com `reduce` ativo - MESMO comportamento que `.z-spinner` ja tem hoje dentro do `ReconnectOverlay` (precedente de que isso e aceito: um spinner "travado" numa posicao com reduced-motion nao quebra a compreensao da mensagem, porque o TEXTO carrega a informacao, nao a animacao - RNF-04).

**Momento 3 - Crossfade entre estagio 1 e estagio 2 (RF-20/AC-17), aos 12s:**
- Nao ha precedente EXATO de "trocar texto sem corte" no app hoje (o app so anima ENTRADAS, nao trocas de conteudo no lugar, exceto o numero do status card via `z-count-roll-in` com `key`). O padrao mais proximo e justamente esse: usar `key={stage}` no elemento de texto para forcar remontagem via React, com o texto ENTRANDO por `z-count-roll-in` (`translateY(6px)->0` + opacity) e SEM keyframe de saida dedicado para o texto antigo (mesma lacuna do momento 2 de saida, secao 6.2) - a rota mais simples e o texto novo entrar por cima enquanto o antigo so desaparece (mesma tecnica sugerida na secao 6.2, opcao 2: overlap curto com o antigo saindo por opacity via transition).
- Alternativa mais robusta a um verdadeiro crossfade (dois elementos sobrepostos por um instante, um saindo por opacity enquanto o outro entra): tecnicamente mais fiel a palavra "crossfade" do RF-20, e nao contraria nenhum padrao existente (ainda so opacity/transform), mas exige os dois textos ocuparem o mesmo espaco por uma janela curta (`position: absolute` um sobre o outro dentro de um container de altura fixa, para nao pular o layout). Recomendacao: usar esta rota (crossfade real com absolute overlap, ~180-220ms) em vez do "so entrada" do numero, porque RF-20 pede explicitamente "nunca um corte abrupto de texto" - o corte fica mais evidente numa troca de FRASE INTEIRA (que pode mudar de tamanho/linhas) do que numa troca de NUMERO (mesma largura aproximada).
- Duracao sugerida: `var(--dur-enter)` (180ms) para ambos os lados do crossfade, easing `var(--ease)` (nao o bounce - o bounce e reservado para a logo/entrada inicial, nunca para trocas de texto).

**Momento 4 - Saida quando o primeiro quadro pinta (RF-21/AC-18):**
- Ver secao 6.2 (lacuna de saida do app): aplicar a MESMA solucao adotada la (fade-out curto, ~180ms, so opacity, antes de desmontar) ao CARTAO INTEIRO do aviso (nao so ao texto). Nao adicionar `scale`/`translate` na saida (evitar qualquer "sugado para dentro" chamativo) - a IDEA pede que a saida "ceda lugar ao video sem solavanco", ou seja, discreta, nao um segundo momento de espetaculo (a entrada e que pode ser mais rica, com a logo; a saida deve ser a mais simples e rapida das quatro).

### 6.4 Guardrails de performance (RNF-02/RNF-03/RNF-09)

- Propriedades permitidas em qualquer `@keyframes`/`transition` novo desta feature: SOMENTE `opacity` e `transform` (`scale`, `translateY`). Proibido `width`/`height`/`top`/`left`/`box-shadow`/`filter`/`backdrop-filter`.
- O `requestVideoFrameCallback` usado para detectar o primeiro quadro (RNF-02, ver CONTEXT secao 7) deve parar de se reagendar assim que o primeiro sucesso ocorrer - isso e logica de deteccao, nao de motion, mas e a mesma disciplina de "nada continua de graca": nenhuma das quatro animacoes de motion desta secao pode, sozinha, gerar reflow/repaint fora do proprio cartao do overlay (que fica em `position: absolute` sobre o video, camada de compositing separada do `<video>`).
- Nenhuma das quatro animacoes pode ficar em loop indefinidamente fora da janela do Momento 2 (que ja e, por definicao, temporario: acaba quando o primeiro quadro pinta OU quando um overlay de maior precedencia assume, RF-04/RF-08).
- `will-change: transform, opacity` so durante a janela ativa da animacao (mesmo padrao documentado no UISPEC da app-audio-capture, secao 6.3) - nao deixar setado indefinidamente enquanto o overlay so espera (sem re-render).

## 7. Do / Don't

**Do:**
- Nascer o novo overlay como IRMAO de `ReconnectOverlay`/`MediaFailureOverlay`, herdando `.z-reconnect` como classe base (fundo `#000000a6`, nunca o `--failure` mais opaco, ja que esta e a mensagem MAIS BRANDA dos tres).
- Usar `z-status-bounce-in` (por nome, mesmo cubic-bezier) para a entrada da logo - a UNICA excecao de easing do app, ja emprestada de proposito pela IDEA ("no espirito do bounce ja usado no card de status").
- Reusar `.z-spinner`/`.z-spinner--lg` OU um novo pulso de opacity no espirito de `z-live-pulse` para o indicador de espera (Momento 2) - nunca inventar um terceiro tipo de loading visual alem desses dois precedentes.
- Condicionar o terceiro ramo do JSX em `PlayerView.tsx` (linha ~167-169) exatamente onde os outros dois ja vivem, respeitando a ordem de precedencia (`reconnecting` > `failed` > aguardando primeiro quadro).
- Fazer o crossfade do Momento 3 com overlap curto de dois elementos de texto (nao so troca de `key` sem sobreposicao), porque RF-20 pede explicitamente ausencia de corte, e uma troca de frase (tamanho variavel) corta mais visualmente que uma troca de numero.
- Manter a mensagem 100% legivel com `prefers-reduced-motion` ativo (RNF-04): nenhuma das quatro animacoes pode ser a UNICA portadora de informacao (ex.: o loop parado numa posicao aleatoria com reduced-motion ainda deve deixar o texto "conectando..."/"aguarde" plenamente legivel, exatamente como o `z-spinner` parado ja e aceito hoje dentro do `ReconnectOverlay`).

**Don't:**
- Nao usar o fundo mais opaco `#000000d9` (`.z-reconnect--failure`) para este aviso - ele e reservado para a falha DEFINITIVA de midia, mais grave que uma espera inicial.
- Nao inventar um segundo `cubic-bezier` alem do bounce da logo - todo o resto (fade do cartao, crossfade do texto, fade-out final) usa `var(--ease)`.
- Nao deixar o indicador de espera (spinner ou logo pulsando) rodando apos o primeiro quadro pintar, nem em `display:none` de fundo - ele precisa ser DESMONTADO, nao so escondido (RNF-02: nada de custo perceptivel durante exibicao normal).
- Nao animar `width`/`height`/`box-shadow`/`filter` em nenhum momento das quatro fases.
- Nao competir por espaco com `PlayerControls` (a barra inferior de controles): o overlay cobre `inset:0` do `.z-player`, os controles continuam por cima/independentes, exatamente como hoje.
- Nao usar `position: fixed` relativo a viewport - sempre `position: absolute; inset: 0` relativo ao `.z-player` (confirmado em ambos os renders 12/13: o overlay nunca vaza sobre a sidebar/topbar).

## 8. Gaps / notas de fallback

- **Harness throwaway usado e revertido**: para renderizar de verdade `ReconnectOverlay` e `MediaFailureOverlay` (que o UISPEC anterior, `app-audio-capture`, marcou como CODE-DERIVED por nao ter forcado nenhum estado real), foi adicionado um flag temporario em `RoomScreen.tsx` (`reconnecting`/`failed` passavam a aceitar `window.__zoiForceOverlay === 'reconnect' | 'failure'`, alem da condicao real), o renderer foi rebuildado (`npm run build`), e um script Playwright standalone (fora de `tests/e2e`, nunca comitado) subiu 2 instancias reais (Pontin transmitindo, Bruna assistindo), abriu o player da Bruna com stream real, setou o flag via `page.evaluate`, esperou o proximo `qualityTick` (~3.6s, o intervalo real de `QUALITY_UPDATE_INTERVAL_MS`) para o React re-renderizar com o flag, e capturou a tela. Ao final: `git checkout -- src/renderer/src/ui/screens/RoomScreen.tsx` reverteu a edicao, o script temporario foi apagado, o renderer foi rebuildado de novo (limpo) e `git status --short` confirmado VAZIO. Nenhum modulo de midia/pipeline/watchdog foi tocado; so a prop repassada ao `PlayerView`.
- **Redacao de privacidade nos renders 10/12/13**: a captura de tela real da maquina de desenvolvimento (compartilhada como "Tela 1" pelo Pontin durante a sessao) trazia, no canto superior direito do quadro, uma sobreposicao de webcam (padrao de app de streaming ligado na maquina do dev). Antes de cada screenshot que mostrasse o video ao vivo, um bloco solido foi injetado via `page.evaluate` cobrindo esse canto (65% a 100% da largura do `.z-player`, 10% a 65% da altura) - visivel nos renders como a etiqueta "[redigido: webcam do dev]". Efeito colateral cosmetico: nos renders 12/13 esse bloco tampa 1-2 caracteres finais da direita do texto de hint (`.z-reconnect__hint`, centralizado, max-width 46ch) - a copy INTEGRAL de ambos os hints ja esta transcrita, sem cortes, na secao 4 (Inventario) e no proprio codigo-fonte de `ReconnectOverlay.tsx`/`MediaFailureOverlay.tsx` lido diretamente; nenhum token/cor/geometria foi afetado pela redacao.
- **Conteudo da tela compartilhada nos renders**: o video de fundo dos renders 10/12/13 e o que estava aberto na maquina do dev no momento da captura (um clipe de video generico, sem identificacao de terceiros nem dados sensiveis) - serve so de contexto visual (mostra que o overlay funciona sobre QUALQUER conteudo de video), nao e dado do produto nem precisa ser interpretado como parte do design.
- **Motion do Momento 3 (crossfade) e do Momento 4 (saida)**: nao foi possivel RENDER-CAPTURAR a transicao em si (exigiria gravar video/GIF da animacao rodando, fora do escopo de screenshots estaticos desta recon) - o contrato da secao 6.3 e uma extrapolacao FUNDAMENTADA a partir dos keyframes e classes REAIS do app (nunca um numero ou easing inventado do zero), mas marcado aqui como composto/inferido, nao como screenshot de uma animacao em curso.
- **`09-status-card-tile-render.png`** foi capturado ~1,2s apos a transmissao comecar, ou seja, DEPOIS que a animacao de entrada da logo (480ms) ja tinha concluido - a imagem mostra o estado de REPOUSO pos-entrada, nao o bounce em si. O bounce em si (cubic-bezier, duracao) ja estava plenamente documentado por leitura de codigo no UISPEC anterior e foi apenas confirmado aqui como comportamento coerente com o render.

## Nota de seguranca

Nenhum segredo, credencial, token ou valor de variavel de ambiente foi incluido neste documento ou nos screenshots. As capturas usaram o servidor de sinalizacao PUBLICO (mesmo do resto do projeto) e perfis de usuario TEMPORARIOS e isolados (`ZOI_USER_DATA_DIR`), apagados ao final da execucao. O harness throwaway usado para forcar os dois overlays de precedencia foi totalmente revertido do codigo-fonte (`git status --short` limpo, confirmado) e nunca chegou a ser comitado. Os renders que mostravam uma sobreposicao de webcam (dado potencialmente pessoal) foram redigidos antes da captura (ver secao 8); o codigo de sala usado (`recon-*`) e descartavel e nao corresponde a nenhuma sala real do grupo.
