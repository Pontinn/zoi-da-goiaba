---
feature: app-audio-capture
language: pt-BR
generated: 2026-08-25
status: uispec
reference_mode: project-identity
source: render-captured
---

# UISPEC - app-audio-capture

## 1. Baseline (ancora de drift)

- HEAD no momento da captura: `36f21efc468c46e71a39ac7d6a252b677e124aeb` (branch `feature/app-audio-capture`)
- Fingerprints (git hash-object) dos arquivos por tras da identidade capturada:
  - `src/renderer/src/ui/theme.css` - `392b80b68845fb29991a12e5ee931e0434b30ee1`
  - `src/renderer/src/ui/screens/room.css` - `168c9a76b74a9a5948fa858a6e30537f1ec74cdb`
  - `src/renderer/src/ui/screens/screens.css` - `f507ca04850c7d10d5e3e8fa77dd59332b960ffd`
  - `src/renderer/src/ui/components/components.css` - `37f54ac19ab23fd96973fdea3ec1a1e21e44abe5`
  - `src/renderer/src/ui/screens/player.css` - `19f7ba2209601641f8c50478f30027f65ee5c6d5`
  - `src/renderer/src/ui/screens/RoomScreen.tsx` - `45af9289806e2d13f33faf2f750f37d646717dbc`
  - `src/renderer/src/ui/screens/PlayerView.tsx` - `8c19aed07505b9e3c3ef946c6ae9381c646e196e`
  - `src/renderer/src/ui/components/StreamThumbnail.tsx` - `5224206db3ecf801659b10505a85a3cf7fd8fed8`
  - `src/renderer/src/ui/components/ReconnectOverlay.tsx` - `905e6d388abf436aca091cdf8ee87aa3da54d9ec`
  - `src/renderer/src/ui/components/MediaFailureOverlay.tsx` - `cb48826f23d931a0b19188267ad24f1343d0ba58`
  - `src/renderer/src/ui/components/Toast.tsx` - `e3bd3a2f9115c97c07a9a4dd7a7fa7e42a93d8c0`
  - `src/renderer/src/ui/components/ParticipantCard.tsx` - `554551c367bd96cb0226f2dbbc05f46debdaaa87`
  - `src/renderer/src/ui/components/DoorsTransition.tsx` - `d0be283337dd73fd4a397cb4d24f8f2ce66cdb11`
  - `src/renderer/src/ui/components/SourcePickerModal.tsx` - `37d0f58372feb617d1546aabb9d6ec36f214fea8`
  - `src/renderer/src/assets/brand/logo-goiaba.png` - `3d4c9ef389810772d72638cef0c3fa647bd04aed`

Mudanca em qualquer um destes arquivos invalida (ou exige reconferir) este UISPEC.

## 2. Alvos de referencia capturados

Todas as imagens em `<FEATURE_DIR>/ui-refs/` (gitignored), RENDER-CAPTURADAS via Playwright `_electron` (headless, sem slowMo) sobre o build de `out/`, subindo 2 instancias isoladas (`ZOI_USER_DATA_DIR`), uma criando a sala e transmitindo (Leo), outra entrando e assistindo (Bruna), pelo servidor publico de sinalizacao real (sem mocks).

| Arquivo | O que mostra |
|---|---|
| `01-room-empty-state.png` | Sala vazia, ninguem transmitindo: o container `.z-empty` que hoje ocupa `.z-room__main` quando `transmissions.length === 0`. |
| `02-source-picker-modal.png` | `SourcePickerModal` aberto, aba Monitores, fontes carregadas com thumbnail real, toggle de audio e presets - contexto do modal que inicia a transmissao (nao e alvo direto da feature, mas mostra o vocabulario de card/switch/badge). |
| `03-room-transmitting-own-tile.png` | O ALVO PRINCIPAL: sala com Leo transmitindo sozinho. `TransmittingBar` no topo (vermelho, "VOCE ESTA TRANSMITINDO Tela 1 - 720p30 - sem audio"), grid com UM `StreamThumbnail` marcado `sua transmissao` (badge vermelho). Este e o layout exato onde o CARD DE STATUS novo precisa substituir o thumbnail. |
| `04-playerview-own-stream-CURRENT-BUG.png` | Leo clicou na propria miniatura: `PlayerView` abre com a PROPRIA stream (bug relatado na IDEA, ainda nao corrigido no codigo atual). Mostra o layout do `PlayerView`/`PlayerControls` que o card de status precisa substituir quando `selected.peerId === room.selfPeerId`. |
| `05-viewer-room-grid-with-remote-thumb.png` | Visao da Bruna (espectadora) apos entrar: grid com o `StreamThumbnail` de Leo (SEM o badge `sua transmissao`, pois nao e dela), aside com 2 participantes, badge `ao vivo` no Leo e `assistindo Leo` na propria Bruna. Confirma que a visao dos OUTROS nao muda. |
| `06-viewer-remote-thumb-zoom.png` | Mesmo estado, apos a stream de video real chegar e estabilizar (frame renderizado no thumbnail). |
| `07-viewer-playerview-remote.png` | Bruna com o `PlayerView` aberto assistindo a transmissao de Leo (normal, video+controles, sem bug): referencia de como o player de terceiros deve continuar funcionando identico. |
| `08-transmitter-room-with-viewer.png` | Visao do proprio Leo (transmissor) DEPOIS que Bruna entrou e comecou a assistir: aside mostra Bruna com `assistindo Leo` (eye icon). Este e o dado ao vivo que o card de status vai agregar como "N espectadores" (`room.watching`). |

## 3. Design tokens (computados, ligados as CSS vars reais)

Fonte: `src/renderer/src/ui/theme.css` `:root` (unica fonte de tokens do app; nenhuma tela redefine identidade inline).

### Cores
- `--bg-app: #0e0b12` (fundo da janela, confirmado no render: preto arroxeado)
- `--bg-surface: #17131e` (superficie elevada leve: aside, code pill)
- `--bg-elevated: #201a2b` (menus, toasts, cards flutuantes)
- `--bg-hover: #2a2138`
- `--accent: #9d00ff` (roxo de marca)
- `--accent-hover: #b23dff`
- `--accent-pressed: #7e00cc`
- `--accent-soft: #9d00ff26` (fundo do icone do empty-state, confirmado no render: circulo roxo translucido atras do icone de broadcast)
- `--text-primary: #f2eef7`
- `--text-secondary: #a99bc0`
- `--text-muted: #6e6285`
- `--success: #2fd47a`
- `--warning: #ffb224`
- `--danger: #ff3d5e` (TransmittingBar, badge "ao vivo", badge "sua transmissao" - todos confirmados vermelho/rosa no render)
- `--border: #2c2438`

### Tipografia
- `--font-family: 'Inter', 'Segoe UI', system-ui, sans-serif` (Inter embutida localmente, woff2, sem download em runtime)
- `--text-meta: 12px` (tags do thumbnail, badges)
- `--text-secondary-size: 13px`
- `--text-body: 14px` (base)
- `--text-subtitle: 16px` (`.z-empty__title`, `.z-reconnect__text`)
- `--text-title: 20px`
- `--text-brand: 28px`
- Pesos: 400 base, 500 (labels, botoes, `.z-empty__title`), 600 (titulos, nomes)

### Geometria
- `--radius-control: 8px`, `--radius-card: 12px` (thumbnails, cards), `--radius-modal: 16px`, `--radius-pill: 999px` (badges, code pill, toggle)
- `--space-1..12`: 4/8/12/16/24/32/48px
- `--shadow-elevated: 0 8px 24px #00000066`

### Movimento (regra do app: SO transform/opacity)
- `--dur-fast: 120ms`, `--dur-enter: 180ms`, `--dur-screen: 240ms`
- `--ease: cubic-bezier(0.2, 0, 0, 1)` (easing UNICO do app inteiro; usar o mesmo na feature nova)
- `prefers-reduced-motion: reduce` zera TODAS as duracoes globalmente (`:root` redefine `--dur-*` para `0ms` e forca `animation-duration/transition-duration: 0.001ms !important` em `*`). Qualquer animacao nova PRECISA respeitar isso automaticamente (usando as CSS vars, nao valores fixos) ou, se usar `@keyframes` com duracao hardcoded, precisa de uma regra extra dentro desse media query.

## 4. Inventario de componentes (reusar, nao inventar paralelo)

- `src/renderer/src/ui/screens/RoomScreen.tsx` - orquestra grid/strip/player/empty-state em `.z-room__main`. O card novo entra aqui, no mesmo lugar onde hoje `StreamThumbnail`/`PlayerView` sao decididos (linhas ~220-296).
- `src/renderer/src/ui/components/StreamThumbnail.tsx` - miniatura memoizada; ja tem o precedente textual `z-thumb__self` ("sua transmissao"). O card novo NAO e uma variante deste componente (ele substitui o slot inteiro), mas deve copiar o padrao de `memo()` + video attach por ref estavel (aqui nao ha video, mas o padrao de perf/memo vale).
- `src/renderer/src/ui/screens/PlayerView.tsx` + `src/renderer/src/ui/components/PlayerControls.tsx` - o que o card substitui quando a transmissao selecionada e a propria.
- `src/renderer/src/ui/components/ReconnectOverlay.tsx` e `MediaFailureOverlay.tsx` (classes `z-reconnect`, `z-reconnect--failure`, `role="status"`) - PRECEDENTE VISUAL DIRETO citado pela IDEA/CONTEXT para o card: cartao central com icone + titulo + texto, fundo escuro semi-transparente, `animation: z-fade-in var(--dur-enter) var(--ease) both`. O card novo deve nascer deste vocabulario (mesmas classes-base ou classes-irma), mas ocupando o LUGAR do tile/player (opaco, nao overlay por cima de video - aqui nao ha video atras).
- `src/renderer/src/ui/screens/room.css` `.z-empty` / `.z-empty__icon` / `.z-empty__title` / `.z-empty__text` - outro precedente de "bloco central com icone circular + titulo + texto"; visualmente quase identico ao que o card precisa ser em repouso (ver `01-room-empty-state.png`).
- `src/renderer/src/ui/components/ParticipantCard.tsx` - vocabulario pronto de badge "ao vivo" (`z-badge z-badge--danger` + `z-live-dot`) e "assistindo X" (`EyeIcon` + label) que a contagem de espectadores do card pode reaproveitar (icone `EyeIcon` de `./icons`).
- `src/renderer/src/ui/theme.css` `.z-item-enter` + `--z-delay` inline - IDIOMA DE STAGGER ja usado pelo app (participantes e thumbnails do grid). Reusar este padrao (nao inventar outro) para os detalhes secundarios do card.
- `src/renderer/src/ui/components/DoorsTransition.tsx` + `components.css` (`.z-doors__logo`, `z-door-pulse`) - PRECEDENTE DIRETO de "logo do app como elemento animado central": `<img src={logoGoiaba} className="z-doors__logo">` com `animation: z-door-pulse 1200ms var(--ease) infinite` (scale 1 <-> 1.06, opacity 0.86 <-> 1). E a UNICA outra tela do app que ja usa a logo de forma animada e caracteristica - modelo direto para RF-20.
- `src/renderer/src/ui/components/Toast.tsx` + `components.css` (`.z-toast`, `.z-toast--warning`) - padrao pronto para o aviso de degradacao (fora do escopo visual deste UISPEC alem de documentar o token, ja que a feature so reusa o toast existente).
- Logo do app: `src/renderer/src/assets/brand/logo-goiaba.png` - PNG raster, **859x891px**, ~232KB. Formato apenas raster (nao ha SVG no repo). Ja usado em `DoorsTransition.tsx` (import direto `import logoGoiaba from '../../assets/brand/logo-goiaba.png'`, renderizado como `<img>`). Esta e a UNICA logo do app; nao ha variante de icone menor.

## 5. Layout e padroes de interacao

- Scaffold da sala: `.z-room` (coluna) > `.z-room__topbar` (code pill, botao Transmitir, config, sair) + `.z-room__body` (grid `268px + 1fr`: `.z-room__aside` fixo a esquerda, `.z-room__main` flexivel).
- `.z-room__main` tem 3 estados mutuamente exclusivos hoje: `PlayerView` (quando ha `selectedTxId`), `.z-empty` (quando nao ha selecao E nao ha nenhuma transmissao), `.z-grid` (grid responsivo `repeat(auto-fill, minmax(300px, 1fr))` quando ha transmissoes e nenhuma selecionada). O card de status precisa entrar como um 4o "sub-estado": quando a transmissao (no grid OU selecionada) e a PROPRIA, renderizar o card no lugar do `StreamThumbnail`/`PlayerView` correspondente, mantendo os outros dois casos (grid de terceiros, empty-state) intocados.
- Todo item de lista (participante, thumbnail) usa `.z-item-enter` com `--z-delay` calculado por indice (`Math.min(index, 8) * 45ms` no aside, `* 50ms` no grid, `* 30ms` no picker) - stagger consistente em toda a UI existente.
- Toasts: canto inferior direito (`z-toasts`), empilham, `pointer-events: none` no container (nunca roubam clique), `role="status"`, tom por borda esquerda de 3px colorida + `z-toast__dot`.
- Overlays de status (reconnect/failure): SEMPRE cobrem a AREA DO VIDEO inteira (`position: absolute; inset: 0`), nunca a tela toda; fundo semi-opaco preto (`#000000a6` / `#000000d9`); conteudo centralizado em coluna com `gap: var(--space-3)`.
- Empty/loading/error: convencao de icone circular (56px, fundo `--accent-soft`, cor `--accent-hover`) + titulo `--text-subtitle` 600 + texto secundario `max-width: 420-460px` centralizado.

## 6. CONTRATO DE MOTION

### 6.1 Vocabulario de motion JA EXISTENTE no app (extender, nao contrariar)

Todas as animacoes do app usam EXCLUSIVAMENTE `transform`/`opacity` (regra escrita no topo de `theme.css` e reforcada em `room.css`: "nada aqui anima de forma continua perto do video"). Easing unico: `cubic-bezier(0.2, 0, 0, 1)` (`--ease`), usado em 100% das transicoes/animacoes do repo - nao existe segundo easing custom.

Keyframes reais encontrados (`theme.css`, `components.css`, `screens.css`):

| Nome | Efeito | Duracao tipica de uso | Onde |
|---|---|---|---|
| `z-fade-rise` | opacity 0->1 + `translateY(8px)->0` | 180ms (`--dur-enter`) | `.z-item-enter`, `.z-screen-enter` (240ms), toasts |
| `z-fade-in` | opacity 0->1 | 180ms | overlays (reconnect/failure), doors center |
| `z-pop-in` | opacity 0->1 + `scale(0.96)->1` | usado em popovers/menus pequenos | `components.css` |
| `z-logo-in` | opacity 0->1 + `scale(0.88)->1` + `translateY(6px)->0` | 420ms fixo (`.z-logo-enter`) | telas de marca (FirstRun/Home) |
| `z-slide-left` | opacity 0->1 + `translateX(-10px)->0` | 180ms | `.z-slide-enter` |
| `z-room-open` | opacity 0->1 + `scale(0.92)->1` | 300ms fixo (`.z-room-enter`) | entrada da propria `RoomScreen` |
| `z-door-pulse` | `scale(1<->1.06)` + `opacity(0.86<->1)` | 1200ms infinite | logo pulsando nas portas (`z-doors__logo`) - UNICO loop continuo com a logo, e so roda quando NAO ha video (portas fechadas, sem stream) |
| `z-live-pulse` | opacity apenas (1<->0.35) | 2s infinite | ponto "ao vivo" - UNICA animacao continua tolerada perto do grid/video hoje |
| `z-spin` | `rotate(360deg)` | 800ms linear infinite | spinners de loading |

Idioma de stagger: `.z-item-enter { animation: z-fade-rise var(--dur-enter) var(--ease) both; animation-delay: var(--z-delay, 0ms); }`, com `--z-delay` setado inline por item (`style={{'--z-delay': `${i*Nms}`}}`). E o UNICO mecanismo de "entrada escalonada" do app - o card de status deve usar o MESMO mecanismo para seus detalhes secundarios, nao reinventar um stagger via `animation-delay` fixo por classe.

Precedente central para RF-20 (logo como elemento animado): `DoorsTransition.tsx` e a UNICA tela que anima a logo hoje, via `.z-doors__logo { animation: z-door-pulse 1200ms var(--ease) infinite; }` - um PULSO CONTINUO (nao uma entrada), o que so e aceitavel ali porque as portas cobrem a tela e NAO ha video rodando atras. Isso e uma restricao importante: no card de status DENTRO da sala (ao lado de outros tiles com video ao vivo), um loop continuo na logo NAO deve ser copiado 1:1 - a RNF-09 exige "sem loop continuo pesado durante toda a transmissao". O padrao a seguir para a logo do card e uma ENTRADA UNICA com bounce/spring (nao um pulso infinito).

### 6.2 Contrato proposto para o card de status (motion, RF-18/RF-19/RF-20/RNF-09)

Escopo: o card nasce UMA VEZ por transmissao (na montagem, quando `LOCAL_TX_START` troca `txId`); as animacoes de entrada disparam so nesse momento, nunca em loop. So a mudanca de contador de espectadores anima depois disso.

**Fase 0 - `@keyframes` novos sugeridos** (adicionar a `theme.css`, mesma secao "animacoes (apenas transform/opacity)"):

```css
/* Bounce/spring de entrada: overshoot leve, sem herdar easing linear do resto do app - e a EXCECAO deliberada (elemento caracteristico). */
@keyframes z-status-bounce-in {
  0%   { opacity: 0; transform: scale(0.7); }
  55%  { opacity: 1; transform: scale(1.08); }
  75%  { transform: scale(0.96); }
  100% { transform: scale(1); }
}

/* Contador trocando de valor: sobe e funde, sem afetar layout (o numero antigo sai por opacity, o novo entra por opacity+translateY curto). */
@keyframes z-count-roll-out {
  from { opacity: 1; transform: translateY(0); }
  to   { opacity: 0; transform: translateY(-6px); }
}
@keyframes z-count-roll-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

`z-status-bounce-in` usa cubic-bezier proprio embutido no proprio keyframe (via os passos 55%/75%/100%) em vez de um `cubic-bezier` com overshoot no `animation-timing-function`, porque `cubic-bezier()` do CSS nao pode passar de 1.0 sem componentes >1 (ex: `cubic-bezier(0.34, 1.56, 0.64, 1)` - equivalente numerico de "easeOutBack" - e ESSA e a alternativa mais simples e o valor recomendado se preferirem `animation-timing-function` a um keyframe com overshoot manual). Recomendacao final: usar `animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1)` (easeOutBack, overshoot ~15%) sobre um keyframe simples de `scale(0.7)->scale(1)` + `opacity(0)->1` - mais facil de manter que o keyframe com 4 paradas acima. Qualquer uma das duas formas atende RF-18 (bounce/spring); a segunda e a preferida por simplicidade.

**Fase 1 - sequencia de entrada (named phases), todas disparando na MESMA montagem do card:**

| Fase | Elemento | Propriedades | Duracao | Delay | Easing |
|---|---|---|---|---|---|
| 1. Logo (elemento central, RF-20) | `<img>` da logo (`logo-goiaba.png`), tamanho contido (sugestao: 72-96px dentro do card, NAO os 859x891 originais - ver nota de perf abaixo) | `opacity`, `transform: scale()` | 480ms | 0ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` (bounce, RF-18) |
| 2. Titulo ("Transmissao iniciada") | texto principal | `opacity`, `transform: translateY(8px)->0` | 220ms (`--dur-enter` arredondado) | 160ms (apos o pico do bounce da logo) | `var(--ease)` (mesmo easing padrao do app - o titulo e suave, nao bounce) |
| 3. Detalhes secundarios (fonte, com/sem audio, contagem) | cada linha/badge do card | `opacity`, `transform: translateY(6px)->0` | 180ms (`--dur-enter`) cada | 220ms + `i * 60ms` (reusar `.z-item-enter` + `--z-delay` inline, mesmo mecanismo do resto do app) | `var(--ease)` |

Duracao total percebida da entrada: ~700-760ms (logo 480ms + titulo comecando aos 160ms terminando aos 380ms + ate 3 detalhes escalonados a 60ms cada terminando por volta de 220+180+2*60=580ms). Fica dentro de "impressionante mas rapido" sem travar a leitura (RNF-09: "a animacao nao pode atrasar a leitura das informacoes").

**Fase 2 - mudanca de contagem de espectadores (RF-19), toda vez que o numero mudar enquanto o card ja esta visivel:**
- NAO reanimar o card inteiro; animar SO o numero.
- Padrao sugerido: o valor antigo sai com `z-count-roll-out` (120ms, `--dur-fast`), o novo entra com `z-count-roll-in` (120ms, `--dur-fast`), com o numero novo posicionado via `key={count}` no React para forcar remontagem do `<span>` do numero (padrao React comum para animar trocas de texto sem manual DOM diffing) - contido num wrapper com `overflow: hidden` de altura fixa (1 linha) para o roll não vazar layout.
- Alternativa mais simples (se o roll parecer excessivo): so um `z-pop-in` rapido (96px scale 0.9->1, 150ms) no numero a cada troca - reusa keyframe ja existente no app, zero CSS novo.

**Fase 3 - saida:** quando a transmissao para (RF-13), o card some junto com a troca de sub-estado do `.z-room__main` (nao precisa de animacao de saida dedicada; o padrao do app hoje e nao animar saida de tela, so entrada - ver `RoomScreen`/telas: nenhuma tem `exit` keyframe, so `enter`). Manter esse padrao (sem novo keyframe de saida) a menos que fique visualmente abrupto demais - se sim, reusar `z-fade-in ... reverse` (ja usado por `.z-toast--leaving`).

### 6.3 Guardrails de performance (RNF-09, MUST)

- Propriedades permitidas nas novas animacoes: SOMENTE `opacity` e `transform` (`scale`, `translateY`, `translateX`). PROIBIDO animar `width`/`height`/`top`/`left`/`margin`/`box-shadow` (blur) - qualquer uma dessas forca layout/paint e conflita com RNF-01/RNF-09.
- A logo do card usa o MESMO arquivo `logo-goiaba.png` (859x891, ~232KB) ja usado em `DoorsTransition`; renderizar em tamanho pequeno (72-96px) via CSS (`width`/`height` fixos no `<img>`, sem re-encode necessario) - o decode de um PNG desse tamanho e trivial e ja acontece hoje na tela de portas sem custo percebido; NAO precisa de asset novo/menor.
- Nenhuma das animacoes do card pode ficar em loop continuo durante a transmissao: todas disparam uma vez na montagem (`animation: ... both` sem `infinite`), IGUAL ao resto do app. A UNICA excecao de loop continuo hoje no app inteiro e o ponto "ao vivo" (`z-live-pulse`, so opacity) - se quiserem um toque "vivo" continuo no card, reusar ESSE MESMO padrao (so opacity, 2s) em vez de inventar um novo loop.
- `will-change: transform, opacity` APENAS durante a janela da animacao (remover a propriedade, ou nao aplicar `will-change` a elementos que nao estao animando no momento) - o app hoje so usa `will-change: transform` nos paineis das portas (`z-doors__panel`), que sao efemeros; seguir o mesmo padrao (`will-change` nao deve ficar setado indefinidamente no card durante toda a transmissao).
- `prefers-reduced-motion: reduce`: o `theme.css` ja zera `--dur-*` globalmente E forca `animation-duration: 0.001ms !important` em `*` - as novas `@keyframes` (que usam duracao fixa em ms, nao as CSS vars, no caso do bounce) SAO PEGAS por essa regra universal (`animation-duration ... !important` vale mesmo para durações hardcoded), entao nenhuma acao extra e necessaria alem de nao usar `!important` propria que sobrescreva a regra global.
- Card memoizado (`memo()`), seguindo `StreamThumbnail`/`TransmittingBar`/`ParticipantCard` (RNF-08) - sem re-render por frame de video (o card nao tem `<video>`, entao isso e naturalmente barato, mas a contagem de espectadores muda com frequencia baixa via `room.watching`, nao precisa de otimizacao alem do memo padrao).
- Medir/validar: RNF-09 pede fps sem queda perceptivel DURANTE a animacao do card - como o card nao compartilha compositing layer com o `<video>` de outras transmissoes (elementos DOM irmaos, nao sobrepostos), o risco real e baixo; ainda assim, evitar qualquer `filter: blur()` ou `backdrop-filter` novo no card (ambos sao caros de compositing), e nao adicionar sombras animadas (`box-shadow` estatica e ok, animada nao).

### 6.4 Logo do app (dado tecnico exato para a implementacao)

- Caminho: `src/renderer/src/assets/brand/logo-goiaba.png`
- Formato: PNG raster (nao ha SVG da logo no repo)
- Dimensoes reais: **859 x 891 px** (quase quadrada, levemente mais alta que larga), ~232KB
- Uso atual: `src/renderer/src/ui/components/DoorsTransition.tsx`, import ES (`import logoGoiaba from '../../assets/brand/logo-goiaba.png'`), renderizado como `<img className="z-doors__logo" src={logoGoiaba} alt="" aria-hidden="true">`, dimensionado via CSS (`height: 32vh; max-height: 340px; width: auto`) - o padrao a seguir e IMPORTAR o mesmo arquivo (nao duplicar/gerar variante) e dimensionar via CSS no card tambem.

## 7. Do / Don't para o agente de frontend

**Do:**
- Reusar `.z-item-enter` + `--z-delay` inline para os detalhes secundarios do card (fonte, audio, espectadores) - nao inventar um segundo mecanismo de stagger.
- Reusar `var(--ease)` para tudo que NAO for o bounce da logo/card (o bounce e a UNICA excecao deliberada de easing no app, exatamente porque e o elemento caracteristico pedido pela IDEA).
- Importar `logo-goiaba.png` do MESMO caminho ja usado por `DoorsTransition.tsx`.
- Basear a estrutura visual do card em `.z-reconnect`/`.z-empty` (cartao central, icone/logo + titulo + texto), ocupando o espaco que hoje e `StreamThumbnail` (no grid) ou `PlayerView` (quando selecionado).
- Colocar a checagem `peerId === room.selfPeerId` tanto no `onSelect` do thumbnail (impedir abrir o player) quanto na decisao de `selected`/render em `RoomScreen.tsx` (renderizar o card em vez do `PlayerView`), cobrindo os DOIS pontos mapeados no CONTEXT secao 3/4.
- Animar SO opacity/transform; disparar a entrada UMA vez por `txId` novo (nao a cada re-render).
- Seguir `memo()` no componente do card (padrao RNF-08).

**Don't:**
- Nao usar `filter`, `box-shadow` animado, `width`/`height`/`top`/`left` em nenhuma keyframe nova.
- Nao criar um loop continuo pesado no card (nem na logo, nem em nenhum outro elemento) durante toda a transmissao - a unica excecao tolerada e um pulso de OPACITY tipo `z-live-pulse`, se quiserem um toque "vivo".
- Nao usar um segundo `cubic-bezier` alem do bounce dedicado da logo/titulo - o resto do app usa SO `var(--ease)`.
- Nao redimensionar/gerar um novo arquivo de logo; usar o PNG existente e dimensionar via CSS.
- Nao esquecer o guard de `prefers-reduced-motion` se alguma duracao nova for hardcoded fora das CSS vars (`--dur-*`) - a regra global do `theme.css` ja cobre isso via `!important`, mas confirmar que a nova classe nao usa `!important` proprio que vença a global.
- Nao deixar o card sem estado nenhum quando `room.watching` ainda nao chegou (mostrar 0 ou "carregando", nunca `undefined`/branco).

## 8. Gaps / notas de fallback

- `ReconnectOverlay` e `MediaFailureOverlay` NAO foram render-capturados nesta sessao (exigiriam forcar reconexao/falha de midia real, fora do escopo do recon visual) - documentados via LEITURA DE CODIGO (secao 4/5), marcados aqui como CODE-DERIVED. O CSS completo (`.z-reconnect`, `.z-reconnect--failure`, `.z-reconnect__icon/__text/__hint`) foi lido integralmente de `player.css`, entao os valores no UISPEC sao exatos, so a composicao visual final (screenshot) que falta.
- O toast de aviso (`pushToast('warning', ...)`) tambem NAO foi render-capturado (nao ha caminho de UI determinístico para forcar a degradacao de audio nesta sessao sem alterar codigo) - CSS completo lido de `components.css` (`.z-toast`, `.z-toast--warning`), marcado CODE-DERIVED.
- `02-source-picker-modal.png` foi capturado com fontes REAIS da maquina de desenvolvimento (nomes/thumbnails de janelas abertas no host) - util so como referencia de layout/tokens, nao leva nenhuma informacao sensivel alem do que qualquer captura de tela do dev-host mostraria (sem credenciais nem PII de terceiros).
- `04` e `07` mostram o "espelho infinito" do bug relatado na IDEA (tela transmitida contendo a propria janela do app, recursivamente) - e o comportamento ATUAL sem a correcao desta feature, capturado deliberadamente como prova visual do problema E como referencia de layout do `PlayerView` que o card substitui.
- Nao foi possivel (nem necessario) capturar o card de status em si, pois ele ainda NAO EXISTE no codigo - este UISPEC descreve o CONTRATO para constru-lo, nao uma captura dele.

## Nota de seguranca

Nenhum segredo, credencial, token ou valor de variavel de ambiente foi incluido neste documento ou nos screenshots. As capturas usaram um servidor de sinalizacao PUBLICO (mesmo do resto do projeto) e perfis de usuario TEMPORARIOS e isolados (`ZOI_USER_DATA_DIR`), apagados ao final da execucao. O screenshot do seletor de fontes mostra nomes de janelas abertas na maquina de desenvolvimento no momento da captura (sem dados sensiveis alem de titulos de janela comuns).
