// Codigo de sala: geracao aleatoria, validacao do personalizado (RF-46),
// normalizacao case-insensitive e mapeamento para o id do door peer (RF-03).
// Modulo puro.
import { ROOM_CODE_MAX_LENGTH, ROOM_CODE_MIN_LENGTH, ROOM_ID_PREFIX } from '@shared/config'

/** Palavras do universo do app usadas no codigo aleatorio. */
export const ROOM_CODE_WORDS = ['filme', 'sala', 'zoi', 'goiaba', 'pipoca', 'serie'] as const

const SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const SUFFIX_LENGTH = 4
const VALID_CODE_PATTERN = /^[a-zA-Z0-9-]+$/

export type RoomCodeErrorCode = 'too_short' | 'too_long' | 'invalid_chars'

export type RoomCodeValidation =
  | { ok: true; code: string }
  | { ok: false; error: RoomCodeErrorCode }

/** Normalizacao canonica: trim + lowercase (AC-29). */
export function normalize(code: string): string {
  return code.trim().toLowerCase()
}

/**
 * Valida um codigo personalizado (RF-46) e devolve a forma normalizada.
 * O erro e discriminado para a UI montar a mensagem (AC-28).
 */
export function validateRoomCode(input: string): RoomCodeValidation {
  const code = normalize(input)
  if (code.length < ROOM_CODE_MIN_LENGTH) return { ok: false, error: 'too_short' }
  if (code.length > ROOM_CODE_MAX_LENGTH) return { ok: false, error: 'too_long' }
  if (!VALID_CODE_PATTERN.test(code)) return { ok: false, error: 'invalid_chars' }
  return { ok: true, code }
}

/**
 * Gera um codigo no formato `<palavra>-<4 alfanumericos>`.
 * `random` e injetavel para tornar a geracao testavel.
 */
export function generateRoomCode(random: () => number = Math.random): string {
  const index = Math.floor(random() * ROOM_CODE_WORDS.length) % ROOM_CODE_WORDS.length
  const word = ROOM_CODE_WORDS[index] ?? ROOM_CODE_WORDS[0]
  let suffix = ''
  for (let position = 0; position < SUFFIX_LENGTH; position += 1) {
    const pick = Math.floor(random() * SUFFIX_ALPHABET.length) % SUFFIX_ALPHABET.length
    suffix += SUFFIX_ALPHABET[pick] ?? '0'
  }
  return `${word}-${suffix}`
}

/** Mapeia o codigo da sala para o id do door peer no PeerJS. */
export function toPeerId(code: string): string {
  return `${ROOM_ID_PREFIX}${normalize(code)}`
}

/** Operacao inversa de `toPeerId`; devolve null se o id nao for de uma sala. */
export function fromPeerId(peerId: string): string | null {
  if (!peerId.startsWith(ROOM_ID_PREFIX)) return null
  return peerId.slice(ROOM_ID_PREFIX.length)
}
