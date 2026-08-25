// Log em arquivo. No app INSTALADO nao ha DevTools (`devTools: false` quando
// empacotado), entao tudo que o renderer escreve no console se perde: quando um
// amigo ve tela preta em outra rede, nao sobra nada para diagnosticar. Aqui o
// main escuta `console-message` da janela e grava um arquivo por dia.
//
// Sem dependencia nova (nada de electron-log): uma fila simples com
// `fs.appendFile` basta. O unico I/O sincrono acontece na virada do arquivo
// (uma vez por dia) e na limpeza do boot, nunca no caminho quente.
import { appendFile, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

/** Nome dos arquivos: `zoi-2026-08-25.log`. */
const FILE_PATTERN = /^zoi-(\d{4})-(\d{2})-(\d{2})\.log$/
const RETENTION_DAYS = 7
const MAX_FILE_BYTES = 5 * 1024 * 1024
/** Mensagem de console gigante nao pode entupir o arquivo do dia. */
const MAX_MESSAGE_LENGTH = 4_000

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

let directory: string | null = null
let currentFile = ''
let currentBytes = 0
/** Arquivo do dia passou do teto: para de gravar ate a virada do dia. */
let capped = false
let queue: string[] = []
let flushing = false
let writeErrorReported = false

/** Pasta dos logs (`userData/logs`), calculada sob demanda. */
export function getLogDirectory(): string {
  if (directory === null) directory = join(app.getPath('userData'), 'logs')
  return directory
}

export function ensureLogDirectory(): string {
  const path = getLogDirectory()
  try {
    mkdirSync(path, { recursive: true })
  } catch (error) {
    process.stderr.write(`[log] nao foi possivel criar a pasta de logs: ${String(error)}\n`)
  }
  return path
}

/** Data LOCAL no formato do nome do arquivo (o usuario pensa no fuso dele). */
function dayStamp(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function sizeOf(path: string): number {
  try {
    return statSync(path).size
  } catch {
    // Ainda nao existe: comeca do zero.
    return 0
  }
}

function flush(): void {
  if (flushing || queue.length === 0 || currentFile === '') return
  flushing = true
  const chunk = queue.join('')
  queue = []
  appendFile(currentFile, chunk, 'utf8', (error) => {
    flushing = false
    if (error && !writeErrorReported) {
      writeErrorReported = true
      // console.* aqui voltaria para a fila: escreve direto no stderr.
      process.stderr.write(`[log] falha ao gravar o log em arquivo: ${error.message}\n`)
    }
    flush()
  })
}

/** Grava uma linha (timestamp ISO + nivel + texto). Nunca lanca. */
export function logToFile(level: LogLevel, text: string): void {
  const now = new Date()
  const path = join(getLogDirectory(), `zoi-${dayStamp(now)}.log`)
  if (path !== currentFile) {
    currentFile = path
    currentBytes = sizeOf(path)
    capped = false
  }
  if (capped) return

  const message = text.length > MAX_MESSAGE_LENGTH ? `${text.slice(0, MAX_MESSAGE_LENGTH)}...` : text
  const line = `${now.toISOString()} ${level.toUpperCase()} ${message}\n`

  if (currentBytes >= MAX_FILE_BYTES) {
    capped = true
    queue.push(
      `${now.toISOString()} WARN [log] arquivo passou de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB; o resto do dia nao sera gravado\n`
    )
    flush()
    return
  }

  currentBytes += Buffer.byteLength(line, 'utf8')
  queue.push(line)
  flush()
}

/** Nivel do `console-message` do Chromium traduzido para o do arquivo. */
function toLevel(level: string): LogLevel {
  if (level === 'error') return 'error'
  if (level === 'warning') return 'warn'
  if (level === 'debug') return 'debug'
  return 'info'
}

function purgeOldLogs(path: string): void {
  const limit = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1_000
  let entries: string[]
  try {
    entries = readdirSync(path)
  } catch {
    return
  }
  for (const name of entries) {
    const match = FILE_PATTERN.exec(name)
    if (!match) continue
    const date = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)
    if (!Number.isFinite(date) || date >= limit) continue
    try {
      unlinkSync(join(path, name))
    } catch {
      // Arquivo em uso por outra instancia: a proxima limpeza tenta de novo.
    }
  }
}

/** Prepara a pasta, apaga o que passou da retencao e abre o arquivo do dia. */
export function startFileLogger(): void {
  const path = ensureLogDirectory()
  purgeOldLogs(path)
  logToFile('info', `[app] Zoi da Goiaba v${app.getVersion()} iniciado; logs em ${path}`)
}

/**
 * Espelha o console do RENDERER no arquivo. E o unico jeito de o usuario final
 * mandar o que aconteceu na maquina dele (os logs de ICE moram todos la).
 */
export function attachRendererLogging(webContents: Electron.WebContents): void {
  webContents.on('console-message', (details) => {
    logToFile(toLevel(details.level), details.message)
  })
}
