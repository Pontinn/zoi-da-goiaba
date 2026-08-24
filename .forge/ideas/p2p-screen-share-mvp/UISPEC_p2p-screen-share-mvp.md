---
feature: p2p-screen-share-mvp
language: pt-BR
source: greenfield-authored  # sem app pra renderizar nem referencia externa; contrato AUTORAL derivado do IDEA secao 9 + PRD RNF-12 + diretriz "moderno, bonito, animado"
created: 2026-08-24
---

# UISPEC - Zói da Goiaba

## Baseline (ancora de drift)

- HEAD: a3290a3 (primeiro commit do repo).
- Fonte de referencia: IDEA secao 9 (tema escuro + roxo #9d00ff com variantes) e PRD RNF-12. NAO houve captura renderizada (projeto greenfield, modo degrade documentado); este arquivo E a referencia canonica ate o app existir.

## 1. Identidade

App: **Zói da Goiaba** (exibicao com acento). Personalidade: zoeira entre amigos por fora, engenharia seria por dentro. Dark-only (sem tema claro no MVP).

## 2. Tokens de design (valores concretos)

### Cores
| Token | Valor | Uso |
|---|---|---|
| `--bg-app` | `#0e0b12` | fundo raiz (quase preto com leve tom roxo) |
| `--bg-surface` | `#17131e` | cards, paineis, barra lateral |
| `--bg-elevated` | `#201a2b` | modais, dropdowns, tooltips |
| `--bg-hover` | `#2a2138` | hover de itens/linhas |
| `--accent` | `#9d00ff` | COR DA MARCA (definida pelo usuario): botoes primarios, foco, bordas ativas, indicadores |
| `--accent-hover` | `#b23dff` | hover de elementos accent |
| `--accent-pressed` | `#7e00cc` | estado pressed |
| `--accent-soft` | `#9d00ff26` | fundos sutis (15% alfa): badges, selecao, glow |
| `--text-primary` | `#f2eef7` | texto principal |
| `--text-secondary` | `#a99bc0` | texto secundario, labels |
| `--text-muted` | `#6e6285` | placeholders, metadados |
| `--success` | `#2fd47a` | conexao boa, "ao vivo" |
| `--warning` | `#ffb224` | conexao media, avisos |
| `--danger` | `#ff3d5e` | erro, desconectar/banir, "voce esta transmitindo" |
| `--border` | `#2c2438` | bordas padrao 1px |

### Tipografia
- Familia: **Inter** (embutida no app, sem download em runtime), fallback `Segoe UI, system-ui, sans-serif`.
- Escala: 12 (metadados) / 13 (secundario) / 14 (corpo, base) / 16 (subtitulo) / 20 (titulo de tela) / 28 (marca na tela inicial). Pesos: 400/500/600.
- Numeros tabulares (`font-variant-numeric: tabular-nums`) em contadores, bitrate e timers.

### Geometria
- Radius: 8px (inputs/botoes), 12px (cards/miniaturas), 16px (modais). Pilula (999px) em badges.
- Espacamento: escala de 4px (4/8/12/16/24/32/48).
- Bordas 1px `--border`; elevacao por sombra `0 8px 24px #00000066` apenas em `--bg-elevated`.

### Movimento (REGRA DE PERFORMANCE - inegociavel)
- Animar SOMENTE `transform` e `opacity` (compostas na GPU). PROIBIDO animar width/height/top/left/box-shadow/filter em elementos proximos ao video.
- Duracoes: 120ms (hover/pressed), 180ms (aparicao de elementos), 240ms (modais/transicao de tela). Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Auto-hide dos controles de fullscreen: fade+slide (opacity + translateY 8px) em 180ms; some apos ~3s de inatividade.
- `prefers-reduced-motion`: respeitar (reduzir a 0ms).
- NENHUMA animacao continua/infinita durante reproducao de video (nada de glow pulsante permanente); excecao: spinner de "reconectando..." e o ponto "ao vivo" (opacity pulse lento, custo zero).

## 2b. Assets de marca (aprovados pelo usuario em 2026-08-24)

- `logo/icone.png` (1365x1365, quadrado roxo arredondado com transparencia): fonte UNICA do icone do app. Gerar dele o `.ico` multi-tamanho (256/128/64/48/32/16) do instalador/atalhos/barra de tarefas.
- `logo/logo-goiaba.png` (recorte transparente da goiaba + arcos de sinal): logomarca DENTRO do app. Usos: tela de primeira abertura e home (marca na tela inicial), e discretamente em cantos de interface. NAO esticar, nao recolorir, fundo sempre transparente.
- `logo/Gemini_Generated_Image_*.jpg`: arte original bruta; nao usar diretamente.

## 3. Componentes (inventario canonico)

- **Botao primario**: fundo `--accent`, texto branco, radius 8, hover `--accent-hover` + translateY(-1px), pressed `--accent-pressed`.
- **Botao secundario**: fundo transparente, borda `--border`, hover `--bg-hover`.
- **Botao perigo**: `--danger` (desconectar/banir/parar transmissao).
- **Input de texto**: fundo `--bg-surface`, borda `--border`, foco: borda `--accent` + anel `--accent-soft`.
- **Card de participante**: avatar circular com inicial do nickname sobre `--accent-soft`, nickname, badges (coroa = dono; olho = assistindo alguem; ponto `--danger` pulsante = transmitindo).
- **Miniatura de transmissao**: card radius 12 com o video ao vivo, nickname sobreposto na base (gradiente escuro), borda 2px `--accent` quando e a que voce esta assistindo; hover: scale(1.02).
- **Barra de controles do player** (fullscreen e janela): gradiente da base, contem: sair do fullscreen, volume (slider + mudo), badge de qualidade (ex: 1080p30), indicador de conexao (3 barrinhas coloridas success/warning/danger). Auto-hide conforme secao 2.
- **Indicador "VOCE ESTA TRANSMITINDO"**: barra fina fixa no topo da janela, fundo `--danger`, texto branco 12px + botao "parar". NUNCA auto-hide.
- **Toast**: canto inferior direito, `--bg-elevated`, radius 12, entra com translateY+fade 180ms, some em 4s. Usado em entrada/saida (com o som do usuario), erros, reconexao.
- **Modal**: overlay `#000000a6`, caixa `--bg-elevated` radius 16, entra com scale(0.96->1)+fade 240ms.
- **PiP (janela flutuante)**: sempre no topo, sem moldura do SO, radius 12, video + barra minima auto-hide (voltar, volume, fechar).

## 4. Telas (mapa de referencia)

1. **Primeira abertura**: marca "Zói da Goiaba" 28px + campo de nickname + botao primario "Bora".
2. **Home**: duas acoes grandes (Criar sala / Entrar com codigo) + nickname editavel (engrenagem).
3. **Criar sala**: codigo (gerar aleatorio ou digitar personalizado) + limite (2-8, padrao 6) + botao copiar codigo.
4. **Sala**: barra lateral de participantes (cards) + grade central de miniaturas das transmissoes ativas + botao primario "Transmitir" (abre seletor de fonte: abas Monitores/Janelas com previews, toggle de audio, preset de qualidade).
5. **Assistindo**: player embutido -> fullscreen real (cobre tudo) -> ou PiP.

## 5. Do / Don't

- DO: video sempre com prioridade de recursos; UI cede (pausar miniaturas ao entrar em fullscreen se necessario).
- DO: acento roxo com moderacao (marca, foco, acao primaria); superficie predominante e o cinza-roxo escuro.
- DON'T: texto roxo puro `#9d00ff` sobre fundo escuro em corpo de texto (contraste insuficiente); usar so em elementos graficos/bordas ou com `--accent-hover` para texto pequeno.
- DON'T: blur/backdrop-filter sobre video (custo de GPU alto).
- DON'T: tema claro, gradientes coloridos de fundo, glassmorphism pesado.
