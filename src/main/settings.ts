// Persistencia de settings (nickname + installId + volume dos sons) em
// `userData/settings.json`. Escrita atomica (temp + rename); um punhado de
// chaves nao justifica uma dependencia externa (SPEC secao 3, trade-off 9).
import { randomUUID } from 'node:crypto'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  type AppSettings,
  type NicknameErrorCode
} from '@shared/ipc'
import { clampSoundVolume, DEFAULT_SOUND_VOLUME } from '@shared/sounds'

export class NicknameValidationError extends Error {
  readonly code: NicknameErrorCode

  constructor(code: NicknameErrorCode) {
    super(
      code === 'empty'
        ? 'O apelido nao pode ficar vazio.'
        : `O apelido deve ter no maximo ${NICKNAME_MAX_LENGTH} caracteres.`
    )
    this.name = 'NicknameValidationError'
    this.code = code
  }
}

let cache: AppSettings | null = null

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function isValidPersistedShape(
  value: unknown
): value is { nickname?: unknown; installId?: unknown; soundVolume?: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readFromDisk(): AppSettings | null {
  const path = settingsPath()
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    // Ausente na primeira execucao: caminho normal, nao e erro.
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isValidPersistedShape(parsed)) throw new Error('formato invalido')
    const installId = typeof parsed.installId === 'string' ? parsed.installId : null
    const nickname = typeof parsed.nickname === 'string' ? parsed.nickname : null
    if (!installId) throw new Error('installId ausente')
    // Volume ausente ou torto nao invalida o arquivo: cai no padrao.
    return { nickname, installId, soundVolume: clampSoundVolume(parsed.soundVolume) }
  } catch (error) {
    // Arquivo corrompido: preserva como .bak e recomeca do zero (SPEC Sprint 2, edge case).
    console.warn('[settings] arquivo corrompido, renomeando para settings.bak:', error)
    try {
      renameSync(path, `${path}.bak`)
    } catch (renameError) {
      console.warn('[settings] nao foi possivel preservar o arquivo corrompido:', renameError)
    }
    return null
  }
}

function writeToDisk(settings: AppSettings): void {
  const path = settingsPath()
  const temporary = `${path}.tmp`
  writeFileSync(temporary, JSON.stringify(settings, null, 2), 'utf8')
  renameSync(temporary, path)
}

/** Le os settings, criando o installId sob demanda na primeira chamada. */
export function getSettings(): AppSettings {
  if (cache) return cache

  const persisted = readFromDisk()
  if (persisted) {
    cache = persisted
    return cache
  }

  cache = { nickname: null, installId: randomUUID(), soundVolume: DEFAULT_SOUND_VOLUME }
  writeToDisk(cache)
  return cache
}

/** Valida e persiste o nickname. Lanca `NicknameValidationError` se invalido. */
export function setNickname(rawNickname: unknown): AppSettings {
  const nickname = typeof rawNickname === 'string' ? rawNickname.trim() : ''
  if (nickname.length < NICKNAME_MIN_LENGTH) throw new NicknameValidationError('empty')
  if (nickname.length > NICKNAME_MAX_LENGTH) throw new NicknameValidationError('too_long')

  const current = getSettings()
  const next: AppSettings = { ...current, nickname }
  writeToDisk(next)
  cache = next
  return next
}

/** Persiste o volume dos sons do app; valor invalido ou fora de 0..1 e ajustado. */
export function setSoundVolume(rawVolume: unknown): AppSettings {
  const current = getSettings()
  const next: AppSettings = { ...current, soundVolume: clampSoundVolume(rawVolume) }
  writeToDisk(next)
  cache = next
  return next
}

/** Apenas para testes/manutencao: descarta o cache em memoria. */
export function resetSettingsCache(): void {
  cache = null
}
