// Configuracao do smoke E2E (Sprint 10, itens 6 e 7 da SPEC).
//
// Os testes sobem o app JA BUILDADO (`out/`) em duas ou tres instancias reais do
// Electron, com perfis isolados por `ZOI_USER_DATA_DIR`, e conversam com o
// servidor PUBLICO do PeerJS. Por isso:
// - `workers: 1`: as instancias ja competem por rede, audio e captura de tela;
//   rodar arquivos em paralelo so aumentaria a flakiness sem ganhar tempo real.
// - `retries: 1`: a unica fonte de instabilidade conhecida e o servidor publico
//   de sinalizacao. Uma repeticao cobre a oscilacao pontual sem esconder bug de
//   verdade (falha nas duas tentativas continua vermelha).
// - timeouts generosos: o ingresso real tem retry de 10s e a transicao de portas
//   segura a cena por 1.5s de proposito.
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  // Uma sessao completa (subir 3 apps, criar sala, entrar, transmitir, moderar)
  // leva alguns minutos quando o servidor publico esta lento.
  timeout: 5 * 60 * 1_000,
  expect: { timeout: 45_000 },
  forbidOnly: Boolean(process.env['CI']),
  reporter: [['list']]
})
