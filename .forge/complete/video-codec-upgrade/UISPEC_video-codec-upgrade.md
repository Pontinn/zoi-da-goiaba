---
feature: video-codec-upgrade
language: pt-BR
generated: 2026-08-26
status: uispec
reference_mode: project-identity
source: render-captured
---

## 1. Baseline (ancora de drift)

- `HEAD`: `a947d00eee99f7bdd66509f3c25d499c10e9d96b`
- Fingerprints (git hash-object) dos arquivos por tras das areas capturadas:
  - `src/renderer/src/ui/components/TransmittingBar.tsx` - `d2c43378d3ac1de7c12d3a30ba9e62c1282c5f94`
  - `src/renderer/src/ui/components/SettingsModal.tsx` - `10624f22d8f17c94d76841cfb153abf49ea4c475`
  - `src/renderer/src/ui/components/SourcePickerModal.tsx` - `37d0f58372feb617d1546aabb9d6ec36f214fea8`
  - `src/renderer/src/ui/components/components.css` - `5ddabd594454f701657686a09570b6836bf8b704`
  - `src/renderer/src/ui/screens/screens.css` - `f507ca04850c7d10d5e3e8fa77dd59332b960ffd`
  - `src/renderer/src/ui/screens/room.css` - `6c8d1f62744a37feb513e96d15421eb86db49e0c`
  - `src/renderer/src/ui/theme.css` - `2e608de9e177dbbb754ca6d6621455b82e34f383`
  - `src/renderer/src/ui/components/Modal.tsx` - `edff1c4e6a238122213833fa5420051b9dbada64`
  - `src/renderer/src/ui/components/Button.tsx` - `2dff4214c9b03884f747f5fcc5ebe13a037724a9`
- Sem drift: estes fingerprints batem exatamente com os registrados no CONTEXT (baseline `1e73ffa...`); os unicos commits entre um e outro sao documentacao do forge, nenhum toca as areas de UI.

## 2. Alvos de referencia

Captura feita com Playwright `_electron` real (instancia isolada, `ZOI_USER_DATA_DIR` proprio, perfil novo, sem sala/pessoas de verdade), viewport 1280x800. Sequencia: apelido -> home -> criar sala -> abrir seletor de fonte -> selecionar Tela 1 -> confirmar transmissao (captura LOCAL real, sem segundo peer) -> barra de transmissao renderizada -> abrir configuracoes por cima.

| Area | Como foi capturada | Arquivos em `ui-refs/` |
|---|---|---|
| Home screen | apos criar apelido, tela de boas-vindas | `01-home.png` |
| Sala vazia (RoomScreen) | sala criada, ninguem transmitindo ainda | `03-room-empty.png` |
| **SourcePickerModal** | modal aberto no modo "start", lista real de monitores da maquina | `04-source-picker-modal.png` |
| **SourcePickerModal** (fonte selecionada) | Tela 1 selecionada, `z-switch` de audio e segmented control de qualidade visiveis | `05-source-picker-selected.png` |
| **TransmittingBar** | transmissao local real iniciada (captura de tela de verdade, sem par remoto: o componente so depende do estado local `localTx`) | `06-transmitting-bar.png` (tela inteira), `07-transmitting-bar-closeup.png` (recorte so da barra) |
| **SettingsModal** | aberto por cima da sala, com a TransmittingBar ativa ao fundo (mesmo componente que abriria a partir da home; o botao de configuracoes so existe no rodape da sidebar da sala) | `08-settings-modal-in-room.png` |

Nenhuma tela contem dado pessoal real: apelido usado foi "UI Recon", sala com codigo gerado (`uirecon-<timestamp>`), sem outros participantes.

## 3. Tokens de design (computados, ligados as variaveis do projeto)

Todos vem de `src/renderer/src/ui/theme.css` (unica fonte de identidade; nenhuma tela redefine token inline) e foram confirmados batendo com o render:

**Cores**
- Fundo do app: `--bg-app` `#0e0b12` (preto arroxeado quase puro, visivel atras dos modais)
- Superficie/sidebar: `--bg-surface` `#17131e`
- Superficie elevada (modal, cards de linha): `--bg-elevated` `#201a2b` (visivel no modal de Configuracoes e no card "Transmissao iniciada")
- Hover de superficie: `--bg-hover` `#2a2138`
- Acento (roxo/magenta): `--accent` `#9d00ff`, hover `--accent-hover` `#b23dff`, pressed `--accent-pressed` `#7e00cc`, soft (fundo de estado ligado) `--accent-soft` `#9d00ff26` - visivel no botao "Salvar", no tab ativo "Monitores", no segmented control "1080p30" selecionado e no thumb do `z-switch` ligado
- Texto primario `--text-primary` `#f2eef7`, secundario `--text-secondary` `#a99bc0`, mutado `--text-muted` `#6e6285`
- Perigo/transmissao `--danger` `#ff3d5e` - e a cor de fundo INTEIRA da TransmittingBar (nao so um acento pontual)
- Aviso `--warning` `#ffb224` - visivel no toast amarelo do canto inferior direito ("Nao foi possivel isolar o audio do Discord...")
- Sucesso `--success` `#2fd47a`
- Borda `--border` `#2c2438`

**Tipografia**
- Familia: `--font-family: 'Inter', 'Segoe UI', system-ui, sans-serif'` (Inter Variable embutida como asset local, sem download em runtime)
- Escala: `--text-meta` 12px (labels pequenos, hints, badges), `--text-secondary-size` 13px, `--text-body` 14px (padrao), `--text-subtitle` 16px, `--text-title` 20px (titulo de modal), `--text-brand` 28px
- Pesos observados: 400 corpo, 500 labels/botoes, 600-700 titulos ("Configuracoes", "O que voce quer transmitir?")
- A label da TransmittingBar ("VOCE ESTA TRANSMITINDO") usa `text-transform: uppercase` + `letter-spacing: 0.04em`; o texto da fonte/preset ao lado NAO (`text-transform: none`)

**Geometria**
- Raios: `--radius-control` 8px (botoes, inputs, seg control), `--radius-card` 12px, `--radius-modal` 16px (visivel na caixa do modal de Configuracoes), `--radius-pill` 999px (badges, switch track, botoes da TransmittingBar)
- Espacamento em escala de 4px: `--space-1` a `--space-12` (4/8/12/16/24/32/48)
- Sombra de elevacao: `--shadow-elevated: 0 8px 24px #00000066` (por baixo do modal)

**Movimento**
- `--dur-fast` 120ms, `--dur-enter` 180ms, `--dur-screen` 240ms, easing unico `cubic-bezier(0.2, 0, 0, 1)` em quase tudo (excecao documentada: entrada da logo usa easeOutBack)
- So `transform`/`opacity` animam (regra do projeto); `prefers-reduced-motion` zera todas as duracoes

## 4. Inventario de componentes (reusar estes, nao inventar paralelos)

- **`z-switch`** (`src/renderer/src/ui/screens/room.css:578-643`, uso real em `SourcePickerModal.tsx:159-175`; caminho corrigido em 2026-08-26 apos verificacao do forge-review, o original citava screens.css): `<button role="switch" aria-checked>` com classe `z-switch`/`z-switch--on`, contendo `<span class="z-switch__track"><span class="z-switch__thumb" /></span>` + `<span class="z-switch__label">` (linha de texto principal + `<span class="z-switch__hint">` menor e mutado embaixo). Confirmado no render (`05-source-picker-selected.png`): trilho cinza-escuro com borda quando desligado, trilho `--accent-soft` com borda `--accent` e thumb `--accent-hover` deslocado quando ligado. Este e o padrao EXATO que o toggle "modo nitidez" da TransmittingBar deve reusar, byte a byte na estrutura HTML/classes.
- **Escala de modal** (`Modal.tsx` + `.z-modal-overlay`/`.z-modal`/`.z-modal__header`/`.z-modal__title`/`.z-modal__subtitle`/`.z-modal__body`/`.z-modal__footer` em `components.css:238-292`): overlay escurecido, caixa `--bg-elevated` com `--radius-modal`, cabecalho com titulo+subtitulo+X opcional (`hideClose`), corpo com padding, rodape com botoes alinhados a direita. `SettingsModal` e `SourcePickerModal` (`wide` variant) sao os dois usos reais. O escape "forcar compatibilidade/VP8" e SO mais uma linha dentro do `z-modal__body` do `SettingsModal`, mesma escala.
- **Linha de configuracao (settings row)**: padrao `<div className="z-row-between">` com um bloco `<div>` a esquerda (titulo em `--text-secondary-size` + descricao em `--text-meta` cor `--text-secondary`) e um controle a direita (slider, botao, ou switch). Repetido 3x no `SettingsModal.tsx` (volume, versao, diagnostico) com `margin-top: var(--space-3)` ou `var(--space-4)` entre linhas. O escape "forcar VP8" deve seguir este MESMO padrao de linha (rotulo+descricao a esquerda, controle a direita - provavelmente um `z-switch` compacto ou um botao de estado, a decidir na SPEC, mas a moldura da linha e esta).
- **Botoes de barra** (`.z-transmitting-bar__btn`, `src/renderer/src/ui/screens/room.css:49-70`, uso em `TransmittingBar.tsx:31-36`; caminho corrigido em 2026-08-26, o original citava screens.css): pill outline transparente com borda branca translucida (`#ffffff59`), fundo `#ffffff26` no hover com leve `translateY(-1px)`. Um novo botao/toggle de "nitidez" na barra deve considerar este estilo (ou o `z-switch` adaptado a paleta invertida da barra vermelha) - **cuidado**: o `z-switch` padrao usa `--bg-elevated`/`--border`/`--accent`, que sao tons ESCUROS pensados para fundo escuro; dentro da barra vermelha (`--danger` de fundo) esses tons de superficie ficariam pouco legiveis. A SPEC/frontend precisa decidir se adapta as cores do switch para o contexto claro-sobre-vermelho da barra (ex.: trilho translucido branco como os botoes da barra) mantendo a MESMA estrutura HTML/classes-base do `z-switch`, ou se usa as classes de botao da barra com um indicador de estado ligado/desligado equivalente. Ver secao 7 (Gaps).
- **`Button`** (`Button.tsx` + `.z-btn`/`.z-btn--primary`/`--secondary`/`--danger`/`--ghost`, `components.css:5-109`): variantes primary (roxo `--accent`), secondary (padrao neutro), danger (vermelho), ghost. Tamanhos sm/md/lg. Usado em toda parte (Cancelar/Salvar, Transmitir, Sair, Verificar atualizacoes).
- **Segmented control (`z-seg`/`z-seg__item`/`z-seg__item--on`)**: usado para as abas "Monitores/Janelas" e para o seletor de qualidade no `SourcePickerModal`. Fundo `--bg-surface`, item ativo com `--accent-soft`/`--accent-hover`.
- **`z-note`**: caixa de aviso com icone + texto pequeno mutado (o aviso de bitrate no picker). Padrao a reusar se a feature precisar de um aviso inline (ex.: nota sobre o escape de compatibilidade).
- **Badges** (`z-badge`, `z-badge--success`/`--warning`/`--neutral`): pilulas pequenas de status, vistas em "codigo copiado" e nos estados de atualizacao do `SettingsModal`.

## 5. Padroes de layout e interacao

- **Modal**: Esc fecha, foco inicial vai para o primeiro campo focavel, overlay com clique-fora fecha (so quando o clique comeca E termina no overlay). Entrada com `z-modal` (nao capturado em keyframe separado, mas o modal ja aparece com fade+scale no CSS geral do projeto).
- **Toast**: aparece no canto inferior direito, caixa `--bg-elevated` com barra de cor lateral (laranja para warning, visto em `06`-`08`), empilha por cima de tudo, texto de duas linhas quando longo.
- **Settings rows**: sempre `z-row-between` com o bloco de texto a esquerda (titulo + descricao secundaria menor) e o controle a direita; espacamento vertical consistente `--space-3`/`--space-4` entre linhas.
- **TransmittingBar**: barra fixa de 34px de altura, fundo `--danger` solido (sem gradiente), ordem da esquerda para a direita: ponto pulsante branco + label maiuscula ("VOCE ESTA TRANSMITINDO") + separador `·` + fonte + preset + audio, depois um spacer flexivel, depois os botoes de acao (Trocar fonte, Parar) alinhados a direita. NUNCA some sozinha (comentario no proprio codigo-fonte). Um toggle novo de "nitidez" entraria naturalmente ANTES dos dois botoes existentes (entre o spacer e "Trocar fonte") ou dentro do bloco de label/fonte, a decidir na SPEC - mas a ordem visual esquerda-metadados / direita-acoes deve ser preservada.
- **SourcePickerModal**: abas de tipo de fonte -> grade de thumbnails reais -> bloco de opcoes (`z-switch` de audio, depois `z-row-between` de qualidade, depois `z-note` de aviso). O escape de compatibilidade NAO fica aqui (decisao da IDEA: SettingsModal), mas o padrao visual do switch e a referencia obrigatoria.

## 6. Identidade por area

O app tem UMA identidade unica (paleta, tipografia, geometria, movimento identicos em toda a superficie capturada). Nao ha variacao de tema entre TransmittingBar/SettingsModal/SourcePickerModal alem do que e funcional: a TransmittingBar usa fundo `--danger` (vermelho solido) porque e um indicador de estado critico ("ao vivo"), enquanto SettingsModal e SourcePickerModal usam a escala neutra de superficies escuras (`--bg-elevated` sobre `--bg-app`). Essa e a UNICA diferenca de identidade entre as tres areas.

## 7. Faca / Nao faca

- FACA reusar o `z-switch` verbatim (mesma estrutura HTML, mesmas classes) para o toggle "modo nitidez"; se o contraste dentro da barra vermelha exigir ajuste de cor, ajuste SO as cores (trilho/thumb), nunca a estrutura ou o `role="switch"`/`aria-checked`.
- FACA usar `z-row-between` + bloco titulo/descricao para a linha "forcar compatibilidade/VP8" no `SettingsModal`, no mesmo estilo das linhas de volume/versao/diagnostico ja existentes.
- FACA manter a ordem visual da TransmittingBar (metadados a esquerda, spacer, acoes a direita) ao inserir o novo toggle.
- FACA usar so os tokens de `theme.css` (cores, espacamento, raio, tipografia); NAO crie cor nova fora da paleta documentada na secao 3.
- FACA strings de UI em pt-BR sem acento, seguindo o tom direto e curto ja usado ("Trocar fonte", "Parar", "Transmitir o audio do sistema").
- NAO invente um componente de switch/toggle paralelo com classes novas quando `z-switch` ja resolve.
- NAO use travessao (em dash) em nenhuma string ou comentario novo.
- NAO anime nada alem de `transform`/`opacity` (regra de performance do projeto, `theme.css` linha 55-59).
- NAO mude a cor de fundo da TransmittingBar nem introduza gradiente: e fundo solido `--danger` por decisao visual existente.

## 8. Gaps / notas de fallback

- Nenhum gap relevante: as tres areas pedidas (TransmittingBar, SettingsModal, SourcePickerModal) foram capturadas com RENDER REAL, incluindo a TransmittingBar com transmissao local de verdade (screen capture real de "Tela 1"), sem precisar de um segundo peer/par remoto - o componente so depende do estado local `localTx` (`RoomScreen.tsx:180-188`), que e setado assim que a captura local termina, independente de qualquer conexao WebRTC ter fechado.
- Unico ponto NAO capturado por render: o `SettingsModal` aberto a partir da HOME (fora de uma sala) - o botao de engrenagem so existe no rodape da sidebar da `RoomScreen` (`RoomScreen.tsx:260-267`), nao na tela inicial. Isso nao e um gap de identidade: e o MESMO componente `SettingsModal.tsx`, capturado igual (`08-settings-modal-in-room.png`); so o ponto de entrada na navegacao muda, o que e irrelevante para o contrato visual.
- Nao foi necessario nenhum code-derived: leitura de codigo serviu so para mapear as capturas de volta aos nomes de classes/tokens, nunca para substituir uma captura ausente.
