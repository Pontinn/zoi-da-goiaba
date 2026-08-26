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
import { DEFAULT_FORCE_VP8, normalizeForceVp8 } from '@shared/codecs'
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
): value is {
  nickname?: unknown
  installId?: unknown
  soundVolume?: unknown
  forceVp8?: unknown
} {
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
    // Volume e modo compatibilidade ausentes ou tortos nao invalidam o arquivo:
    // caem no padrao (arquivo de versao anterior a video-codec-upgrade).
    return {
      nickname,
      installId,
      soundVolume: clampSoundVolume(parsed.soundVolume),
      forceVp8: normalizeForceVp8(parsed.forceVp8)
    }
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

/**
 * Valvula de teste do e2e: com `ZOI_FORCE_VP8=1` o app inteiro roda em modo
 * compatibilidade SEM gravar nada em disco (mesmo precedente de
 * `ZOI_DISABLE_AUDIO_EXCLUSION`). Default desligado.
 */
function withEnvOverrides(settings: AppSettings): AppSettings {
  if (process.env.ZOI_FORCE_VP8 === '1') return { ...settings, forceVp8: true }
  return settings
}

/** Settings realmente PERSISTIDOS, sem nenhuma valvula de ambiente por cima. */
function ensureCache(): AppSettings {
  if (cache) return cache

  const persisted = readFromDisk()
  if (persisted) {
    cache = persisted
    return cache
  }

  cache = {
    nickname: null,
    installId: randomUUID(),
    soundVolume: DEFAULT_SOUND_VOLUME,
    forceVp8: DEFAULT_FORCE_VP8
  }
  writeToDisk(cache)
  return cache
}

/** Le os settings, criando o installId sob demanda na primeira chamada. */
export function getSettings(): AppSettings {
  return withEnvOverrides(ensureCache())
}

/** Valida e persiste o nickname. Lanca `NicknameValidationError` se invalido. */
export function setNickname(rawNickname: unknown): AppSettings {
  const nickname = typeof rawNickname === 'string' ? rawNickname.trim() : ''
  if (nickname.length < NICKNAME_MIN_LENGTH) throw new NicknameValidationError('empty')
  if (nickname.length > NICKNAME_MAX_LENGTH) throw new NicknameValidationError('too_long')

  const current = ensureCache()
  const next: AppSettings = { ...current, nickname }
  writeToDisk(next)
  cache = next
  // A UI usa o retorno como verdade: ele espelha o que a leitura mostraria.
  return withEnvOverrides(next)
}

/** Persiste o volume dos sons do app; valor invalido ou fora de 0..1 e ajustado. */
export function setSoundVolume(rawVolume: unknown): AppSettings {
  const current = ensureCache()
  const next: AppSettings = { ...current, soundVolume: clampSoundVolume(rawVolume) }
  writeToDisk(next)
  cache = next
  // A UI usa o retorno como verdade: ele espelha o que a leitura mostraria.
  return withEnvOverrides(next)
}

/** Persiste o escape de modo compatibilidade; so o booleano `true` liga. */
export function setForceVp8(rawValue: unknown): AppSettings {
  const current = ensureCache()
  const next: AppSettings = { ...current, forceVp8: normalizeForceVp8(rawValue) }
  writeToDisk(next)
  cache = next
  // A UI usa o retorno como verdade: ele espelha o que a leitura mostraria.
  return withEnvOverrides(next)
}

/** Apenas para testes/manutencao: descarta o cache em memoria. */
export function resetSettingsCache(): void {
  cache = null
}
