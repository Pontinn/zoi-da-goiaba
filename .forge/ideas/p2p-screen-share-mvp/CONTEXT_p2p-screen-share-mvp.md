---
feature: p2p-screen-share-mvp
language: pt-BR
code_identifier_language: en
created: 2026-08-24
---

# CONTEXT - p2p-screen-share-mvp

## Baseline (ancora de drift)

- HEAD: sem git no momento da criacao (repo sera iniciado na Stage 2).
- Estado do projeto: **GREENFIELD**. A pasta do projeto estava vazia (exceto `.forge/` e `audios/`). Nao ha codigo, dependencias, configuracao ou convencoes preexistentes.

## Contexto tecnico (nasce das decisoes da Stage 1, nao de codigo)

- **Stack decidida**: Electron (Chromium/Node) + WebRTC nativo do Chromium. Sinalizacao via servidor publico do PeerJS. Alvo: Windows 10/11 (Electron cobre ambos sem custo extra; loopback de audio funciona nos dois). Entrega: INSTALADOR Windows (base do auto-update).
- **Convencao de identificadores de codigo**: INGLES (novo projeto, padrao). A prosa dos artefatos e pt-BR, mas classes/funcoes/variaveis/arquivos de codigo serao em ingles.
- **APIs-chave da plataforma** (verificadas como disponiveis na stack):
  - `desktopCapturer` (Electron) - lista monitores e janelas com thumbnails pro seletor de fonte.
  - `getDisplayMedia`/`getUserMedia` com constraint de loopback - captura de tela + audio do sistema (loopback funciona no Windows/Chromium).
  - `RTCPeerConnection` (mesh full: cada par de participantes tem uma conexao) - video/audio + DataChannel pra metadados (nickname, estado de transmissao, moderacao, quem-assiste-o-que).
  - PeerJS - abstrai sinalizacao/oferta/resposta/ICE; servidor publico gratuito; STUN publico do Google.
- **Assets**: pasta `audios/` na raiz com 7 gravacoes do usuario (nomes definidos no IDEA), ja processadas (silencio cortado + loudnorm; originais em `audios/originais/`).
- **Repositorio remoto**: https://github.com/Pontinn/screen-share.git (remote `origin`). Candidato natural a fonte do auto-update via GitHub Releases (electron-updater). REGRA DO USUARIO: nunca fazer push/merge sem autorizacao explicita.

## Restricoes

- Sem servidor proprio de midia ou de estado: tudo P2P + PeerJS publico pra sinalizacao.
- Sem TURN/relay: falha de NAT vira mensagem de erro clara.
- Estado da sala (participantes, dono, banidos, limite) vive nos proprios clientes via DataChannel; morre com a sala.
