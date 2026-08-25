---
feature: app-sounds-volume
language: pt-BR
type: change
status: done
created: 2026-08-25
mode: quick
---

# IDEA (quick): Controle de volume dos sons do app

## Objetivo
Slider de volume nas Configuracoes controlando os SONS DO PROPRIO APP (entrar, sair, transmitindo, etc.), que hoje sao fixos em 100% (`APP_SOUND_VOLUME = 1` em sound-player.ts). Pedido do usuario em 2026-08-25. O botao de configuracoes ja existe na Home E na tela da sala (RoomScreen.tsx ja renderiza SettingsModal), entao essa parte do pedido ja esta atendida; so confirmar.

## Plano inline
1. `sound-player.ts`: volume passa a ser mutavel (`setSoundVolume(0..1)` + getter), aplicado nos elementos pre-carregados e nos clones de cada disparo. Default 1.
2. Persistencia: seguir o MESMO padrao das settings ja persistidas do app (src/main/settings.ts + IPC + preload, como nickname/preset). Chave nova (ex: `soundVolume`). Carregar no boot do renderer e aplicar antes do primeiro som.
3. `SettingsModal.tsx`: linha nova "Volume dos sons do app" com slider no padrao visual do VolumeControl existente (reutilizar componente ou o estilo). Ao soltar o slider, tocar um som curto (ex: "entrou") como feedback do nivel. Volume 0 = mudo.
4. Testes unit do sound-player (volume aplicado no clone, clamp 0..1) e o que couber da persistencia. Suites verdes.

## Fora de escopo
- Volume da transmissao assistida (ja existe no player, nao tocar).
- Sons novos ou troca de arquivos.

## Bordas
- Valor persistido invalido/ausente -> default 1.
- Clamp 0..1; slider 0-100 na UI se for o padrao do VolumeControl.
