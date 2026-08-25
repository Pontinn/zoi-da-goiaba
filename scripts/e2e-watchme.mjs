// Variante ASSISTIDA do smoke E2E (step 5 do Sprint 10 e preferencia global do
// usuario para testes de UI): mesma suite, com pausa visivel entre os passos
// para dar tempo de acompanhar a automacao na tela.
//
// O Electron sempre abre com janela (nao existe headless de verdade), entao o
// unico ajuste necessario e o ritmo. Um wrapper em Node mantem o script portavel
// (definir variavel de ambiente inline muda de sintaxe entre cmd e sh).
import { spawn } from 'node:child_process'

const SLOWMO_MS = process.env.ZOI_E2E_SLOWMO ?? '2000'

const child = spawn('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, ZOI_E2E_SLOWMO: SLOWMO_MS }
})

child.on('exit', (code) => process.exit(code ?? 1))
