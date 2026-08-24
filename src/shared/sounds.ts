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
