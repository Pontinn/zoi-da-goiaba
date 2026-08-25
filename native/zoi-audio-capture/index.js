// Carga do binario nativo com degradacao segura: numa maquina sem toolchain o
// `npm install` do addon falha, mas o app precisa continuar subindo no caminho
// degradado (loopback total do endpoint). Por isso o require e protegido e o
// stub responde `probe()` com o motivo, em vez de explodir no import.
'use strict'

/** @type {import('./index.d.ts')} */
let addon

try {
  addon = require('./build/Release/zoi_audio_capture.node')
} catch (error) {
  const detail = error && error.message ? String(error.message) : 'erro desconhecido'
  addon = {
    probe() {
      return { ok: false, error: `native-binary-missing: ${detail}` }
    },
    start() {
      throw new Error('native-binary-missing')
    },
    stop() {
      // Sem binario nao existe captura ativa: parar e no-op.
    }
  }
}

module.exports = addon
