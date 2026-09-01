---
feature: addon-host-quit-abort
language: pt-BR
type: fix
status: in-progress
created: 2026-08-31
---

# IDEA: abort no encerramento gracioso do processo que hospeda o addon de audio

## 1. Objetivo

Achado pelo forge-imp-backend durante a Stage 4 da audio-quality (2026-08-31), SEM correcao (regra do usuario: bug achado no meio de outro trabalho vira ideia).

Encerrar o processo hospedeiro do addon nativo com `app.quit()` GRACIOSO, havendo frames PCM ainda na fila da ThreadSafeFunction, aborta em `Napi::ArrayBuffer::New` durante o `FreeEnvironment` do N-API.

## 7. Regras e evidencia

- PRE-EXISTENTE: o trecho envolvido e byte-identico ao de antes da audio-quality (nao e regressao dela).
- SEM EFEITO NO APP REAL hoje: o app mata o worker com `worker.kill()`, nunca por quit gracioso; o abort so aparece em cenarios de encerramento gracioso (ex.: harness/probe).
- Reproducao: encerrar graciosamente o utilityProcess do addon com frames PCM enfileirados na TSFN.

## 12. Pontos em aberto

- P1: drenar/fechar a TSFN antes do FreeEnvironment (aborter no unload do addon)? Ou basta documentar que o host nunca encerra gracioso?
- P2: existe cenario futuro (ex.: recycle do worker) em que o quit gracioso passe a acontecer no app real?

## 13. APENDICE

Descoberto durante a Stage 4 da audio-quality, zero mudanca de codigo relacionada a isto.
