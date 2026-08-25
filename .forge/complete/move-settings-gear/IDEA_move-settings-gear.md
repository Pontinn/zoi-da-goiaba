---
feature: move-settings-gear
language: pt-BR
type: change
status: done
created: 2026-08-25
mode: quick
---

# QUICK: mover engrenagem de configuracoes para o rodape da sidebar

## Pedido (usuario, 2026-08-25)
Na tela da sala, tirar o botao de engrenagem (Configuracoes) da barra superior (hoje entre "Transmitir" e "Sair") e coloca-lo no canto inferior esquerdo da tela, na mesma sidebar dos participantes, "bem no canto la embaixo". Screenshot de referencia mostrava a engrenagem entre os botoes Transmitir e Sair no topo.

## Plano inline
1. `src/renderer/src/ui/screens/RoomScreen.tsx`: remover o `IconButton` "Configuracoes" (linhas 180-182 no baseline) da barra superior.
2. No `<aside className="z-room__aside">` (linha 189), adicionar um rodape fixo no fim da sidebar (ex: `z-room__aside-footer`) com o mesmo `IconButton` "Configuracoes" + `GearIcon`, alinhado a esquerda, colado embaixo.
3. `src/renderer/src/ui/screens/room.css`: `.z-room__aside` vira coluna flex com a lista crescendo e o rodape empurrado pro fim (`margin-top: auto`); estilo discreto no padrao do tema (tema escuro + roxo #9d00ff). Cuidado com a regra `.z-room__aside > *:has(.z-participant__menu)` (linha 290): o rodape nao pode quebrar o layout dela.
4. `SettingsModal` continua aberto pelo mesmo estado `settingsOpen`; nada muda no modal.
5. UX (diretriz do usuario): nao atrapalhar nem complicar; a engrenagem deve continuar obvia e clicavel, com area de clique confortavel e tooltip/label preservado.

## Bordas obvias
- Sidebar com muitos participantes (lista rola): o rodape nao pode sobrepor a lista nem sumir; lista rola, rodape fica.
- Janela baixa: rodape continua visivel (a sidebar ja tem altura da area util).
- HomeScreen tem o proprio acesso a configuracoes: FORA do escopo; so a tela da sala muda.

## Verificacao proporcional
- `npm run typecheck` + `npm run lint` + `npx vitest run` verdes.
- Smoke render: abrir o app, entrar numa sala, ver a engrenagem no rodape da sidebar, abrir e fechar o modal de configuracoes por ela, screenshot.
- Nenhum teste existente referencia a engrenagem (verificado por grep em tests/).

## Regressao
- Barra superior continua com Transmitir + Sair funcionais.
- Modal de configuracoes abre/fecha identico.
- Nada de outra tela e tocado.
