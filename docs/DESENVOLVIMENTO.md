# Zói da Goiaba

Compartilhamento de tela P2P entre amigos, para Windows 10/11. Sem servidor de
midia e sem servidor de estado: o video vai direto de um participante para o
outro (mesh WebRTC) e a sala existe apenas enquanto alguem estiver nela.

- **Nome tecnico**: `ZoiDaGoiaba` (executavel `ZoiDaGoiaba.exe`)
- **Instalador**: `ZoiDaGoiaba-Setup.exe`
- **Plataforma**: Windows 10 e 11 (x64)

---

## Requisitos de desenvolvimento

- Node.js 22.12 ou superior
- Windows (o app usa captura de tela e loopback de audio do Windows)

## Instalacao das dependencias

```bash
npm install
```

Se o download do binario do Electron travar (proxy ou antivirus), aponte um
espelho antes de instalar:

```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm install
```

O npm 11 pede aprovacao para scripts de instalacao. As aprovacoes necessarias
(`electron`, `esbuild`, `electron-winstaller`) ja estao registradas em
`package.json` no campo `allowScripts`.

## Scripts

| Script | O que faz |
|---|---|
| `npm run dev` | Sobe o app em modo desenvolvimento (HMR no renderer) |
| `npm run build` | Compila main, preload e renderer em `out/` |
| `npm run typecheck` | TypeScript estrito nos dois alvos (node e web) |
| `npm run lint` | ESLint em todo o projeto |
| `npm run format` | Prettier |
| `npm test` | Suite unitaria (Vitest) do nucleo de protocolo e estado de sala |
| `npm run icon` | Regenera `build/icon.ico` a partir de `logo/icone.png` |
| `npm run dist` | Gera o instalador em `release/` (sem publicar nada) |

### Rodar varias instancias na mesma maquina

O app tem trava de instancia unica por perfil. Para abrir duas ou tres copias em
paralelo (util para testar uma sala), use um `userData` diferente em cada uma:

```bash
set ZOI_USER_DATA_DIR=C:\temp\zoi-a
npm run dev
```

---

## Gerar o instalador

```bash
npm run dist
```

O comando roda `electron-vite build && electron-builder --win --publish never`.
O `--publish never` e obrigatorio e garante que o build NAO interage com o
GitHub. Ao final, `release/` contem:

- `ZoiDaGoiaba-Setup.exe` - o instalador NSIS (wizard, escolha de pasta, atalhos
  na area de trabalho e no menu iniciar, instalacao por usuario e sem UAC)
- `latest.yml` - o manifesto que o auto-update le
- `ZoiDaGoiaba-Setup.exe.blockmap` - usado para download diferencial

## Publicar uma versao (passo MANUAL do usuario)

O projeto nunca publica nada sozinho: nao ha workflow de CI, nao ha push e nao
ha `--publish` no build. Para ativar o auto-update, publique a release a mao:

1. Suba a versao em `package.json` (ex.: `0.1.0` para `0.2.0`) e rode
   `npm run dist`.
2. No GitHub, em `Pontinn/zoi-da-goiaba`, crie uma **Release** nova com a tag
   `v<versao>` (ex.: `v0.2.0`), exatamente igual a versao do `package.json`.
3. Anexe a release **os dois arquivos**: `ZoiDaGoiaba-Setup.exe` e `latest.yml`.
   Sem o `latest.yml` o app instalado nao consegue detectar a atualizacao.
4. Publique a release (nao deixe como rascunho).

A partir dai, cada app instalado checa a atualizacao ao abrir e no botao
"verificar atualizacoes" das configuracoes. O download so comeca depois do
aceite do usuario, e a instalacao acontece ao reiniciar o app.

Enquanto nao existir nenhuma release publicada, a checagem termina em silencio
(estado `none` ou `error` apenas no log), sem qualquer aviso na interface.

## Aviso do SmartScreen

O instalador nao tem assinatura de codigo (code signing). Na primeira execucao,
o Windows SmartScreen pode exibir "O Windows protegeu o computador". Basta
clicar em **Mais informacoes** e depois em **Executar assim mesmo**. Isso e
esperado para um app privado distribuido entre amigos.

---

## Estrutura do projeto

```
src/
  main/       processo principal (janela, settings, captura, updater)
  preload/    ponte tipada `window.zoi` (contextIsolation + sandbox)
  renderer/
    src/
      core/       nucleo PURO: protocolo, estado de sala, admissao, eleicao
      services/   transporte: PeerJS, mesh, reconexao, midia, sons
      ui/         telas e componentes
  shared/     contratos usados pelos tres processos (IPC, protocolo, presets)
tests/unit/   suite Vitest do nucleo puro
audios/       fonte canonica dos 7 sons (copiados para o bundle do renderer)
logo/         arte de origem do icone
build/        icone gerado (icon.ico / icon.png)
```

## Notas de arquitetura

- Sinalizacao pelo servidor publico do PeerJS; STUN publico do Google. Sem TURN:
  quando a conexao direta falha (NAT simetrico), o app avisa quem nao conectou.
- O estado da sala (participantes, dono, banidos) vive nos clientes e morre com
  a sala. O cliente do dono e a autoridade de roster e moderacao.
- Toda a decisao de sala fica em `renderer/src/core`, sem dependencia de
  PeerJS, DOM ou Electron, e e coberta por testes unitarios.
