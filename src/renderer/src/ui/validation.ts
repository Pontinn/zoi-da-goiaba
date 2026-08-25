// Validacoes de formulario espelhando EXATAMENTE as regras do backend, para que
// a mensagem apareca inline antes da chamada de IPC/sessao.
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@shared/ipc'
import type { RoomCodeErrorCode } from '../core/room-code'

/** Mensagens por erro de codigo de sala (AC-28). */
export const ROOM_CODE_MESSAGES: Record<RoomCodeErrorCode, string> = {
  too_short: 'O codigo precisa ter pelo menos 3 caracteres.',
  too_long: 'O codigo pode ter no maximo 32 caracteres.',
  invalid_chars: 'Use apenas letras, numeros e hifen.'
}

export type NicknameValidation = { ok: true; nickname: string } | { ok: false; error: string }

/** Nickname: 1 a 24 caracteres depois do trim (mesma regra de `settings:set`). */
export function validateNickname(input: string): NicknameValidation {
  const nickname = input.trim()
  if (nickname.length < NICKNAME_MIN_LENGTH) {
    return { ok: false, error: 'Escolha um apelido (so espaco nao vale).' }
  }
  if (nickname.length > NICKNAME_MAX_LENGTH) {
    return { ok: false, error: `O apelido pode ter no maximo ${NICKNAME_MAX_LENGTH} caracteres.` }
  }
  return { ok: true, nickname }
}

/**
 * Traduz o erro estruturado de `settings:set`
 * (`nickname_invalid:<codigo>:<mensagem>`) para texto exibivel.
 */
export function messageFromError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  const match = /nickname_invalid:(empty|too_long):(.*)$/.exec(error.message)
  if (match) {
    return match[1] === 'empty'
      ? 'Escolha um apelido (so espaco nao vale).'
      : `O apelido pode ter no maximo ${NICKNAME_MAX_LENGTH} caracteres.`
  }
  return error.message || fallback
}
