---
feature: hq-presets
language: pt-BR
type: change
status: done
created: 2026-08-25
mode: quick
---

# IDEA (quick): Presets de alta qualidade

## Objetivo
Dar teto de bitrate maior pra quem tem internet boa: a imagem 1080p atual (4 Mbps) e honesta, mas filme "cristalino" pede 8-12 Mbps. Pedido do usuario em 2026-08-25 (contexto: pergunta sobre como deixar a transmissao mais bonita; codec fica pra feature separada).

## Plano inline
1. `src/shared/presets.ts` + `src/shared/protocol.ts` (tipo PresetId): adicionar 2 presets ao seletor, mantendo os 3 atuais intactos:
   - `p1080_30_hq` "1080p30 alta", 1920x1080, 30fps, maxBitrate 8_000_000
   - `p1080_60_hq` "1080p60 alta", 1920x1080, 60fps, maxBitrate 12_000_000
2. UI: os novos aparecem no seletor de preset existente (PRESET_LIST); default continua p1080_30.
3. COMPATIBILIDADE (verificar e documentar): como protocol.ts valida presetId? Se um cliente antigo receber TX_START com preset desconhecido e DESCARTAR, o espectador desatualizado nao ve a transmissao. Mitigacao aceita: grupo pequeno com auto-update; notas da release mandam atualizar todos. Registrar o comportamento real no report.

## Fora de escopo
- Troca de codec (feature propria, ideia separada), modo nitidez, mudanca nos presets existentes.

## Bordas
- Cliente antigo recebendo preset novo (item 3 acima).
- Upload de quem transmite: 12 Mbps x N espectadores; e teto, o WebRTC degrada sozinho (RF-47), nada a fazer alem do ja existente.
