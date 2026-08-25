// Identificadores dos 7 sons do app (RF-39). Vivem no shared para que o nucleo
// puro possa emitir efeitos de som sem importar nada do runtime do renderer.

export type SoundId =
  | 'entered'
  | 'left'
  | 'transmitting'
  | 'stoppedTransmitting'
  | 'removed'
  | 'connectionError'
  | 'reconnected'

export const SOUND_IDS: readonly SoundId[] = [
  'entered',
  'left',
  'transmitting',
  'stoppedTransmitting',
  'removed',
  'connectionError',
  'reconnected'
]

/** Volume dos sons do app quando nada foi escolhido ainda: tudo em 100%. */
export const DEFAULT_SOUND_VOLUME = 1

/**
 * Normaliza um volume vindo do disco, do IPC ou da UI. Fora da faixa 0..1 vira o
 * limite mais proximo; ausente ou invalido (NaN, string, null) volta ao padrao.
 */
export function clampSoundVolume(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_SOUND_VOLUME
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
