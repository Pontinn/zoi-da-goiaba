<p align="center">
  <img src="logo/logo-goiaba.png" alt="Zói da Goiaba" width="220">
</p>

<h1 align="center">Zói da Goiaba</h1>

<p align="center">
  Compartilhamento de tela P2P entre amigos. Sem servidor, sem mensalidade, só o zói.
</p>

---

## O que é

App desktop para Windows feito para um grupo de até 8 amigos compartilharem a
tela (com áudio do sistema, se quiser) direto entre os PCs, usando uma malha
WebRTC ponto a ponto. Não existe servidor de mídia no meio: o vídeo sai da sua
placa e vai para o amigo, e só. A sinalização usa o servidor público do PeerJS,
apenas para os peers se acharem.

Nasceu para sessão de filme e noite de jogo entre amigos, não para reunião
corporativa. Isso fica claro nos sons.

## Funcionalidades

- Salas com código, aleatório ou personalizado, e limite configurável de 2 a 8 pessoas
- Várias transmissões simultâneas: cada um escolhe qual assistir
- Áudio do sistema opcional junto com a tela
- Presets de qualidade 720p30, 1080p30 e 1080p60, com adaptação automática
- Fullscreen de verdade, com controles que somem sozinhos
- Picture-in-picture para deixar num cantinho da tela
- Volume local por espectador (você abaixa o seu, não o dos outros)
- Dono da sala pode desconectar e banir, com transferência automática da coroa se ele cair
- Reconexão automática, com janela de 15 segundos antes de dar alguém como perdido
- Sons customizados, gravados na boca mesmo
- Saudações e taglines aleatórias, direto da zoeira do grupo
- Auto-update via GitHub Releases

## Instalação

1. Baixe o `ZoiDaGoiaba-Setup.exe` na página de
   [Releases](https://github.com/Pontinn/zoi-da-goiaba/releases).
2. Dois cliques e seguir o instalador.
3. O aviso do SmartScreen ("O Windows protegeu o computador") é normal: o app
   não é assinado digitalmente. Clique em **Mais informações** e depois em
   **Executar assim mesmo**.

Requer Windows 10 ou 11.

## Como usar

1. Crie uma sala e copie o código.
2. Mande o código no grupo.
3. Todo mundo entra com o código, e qualquer um pode transmitir a qualquer momento.

## Desenvolvimento

Requisitos: Node 24+ e Windows (a captura de tela e o loopback de áudio são do Windows).

```bash
npm install         # instala as dependências
npm run dev         # sobe o app em modo desenvolvimento
npm test            # testes unitários
npm run test:e2e    # testes end to end
npm run dist        # gera o instalador em release/
```

## Arquitetura em uma frase

Electron + malha WebRTC de até 8 peers, com o estado da sala distribuído nos
próprios clientes via DataChannel (o dono da sala é a autoridade), PeerJS
público só para sinalização e zero backend próprio.

---

<sub>Projeto privado de um grupo de amigos, sem nenhuma garantia. Use por sua
conta e risco. O nome e os sons são piada interna, não tente entender.</sub>
