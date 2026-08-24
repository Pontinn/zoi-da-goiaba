import { describe, expect, it } from 'vitest'
import { ROOM_CODE_MAX_LENGTH, ROOM_ID_PREFIX } from '@shared/config'
import {
  fromPeerId,
  generateRoomCode,
  normalize,
  ROOM_CODE_WORDS,
  toPeerId,
  validateRoomCode
} from '@renderer/core/room-code'

describe('room-code / validacao RF-46 (AC-28)', () => {
  it('rejeita codigo curto demais com erro discriminado', () => {
    expect(validateRoomCode('ab')).toEqual({ ok: false, error: 'too_short' })
    expect(validateRoomCode('   ')).toEqual({ ok: false, error: 'too_short' })
    expect(validateRoomCode('')).toEqual({ ok: false, error: 'too_short' })
  })

  it('aceita exatamente 3 e exatamente 32 caracteres', () => {
    expect(validateRoomCode('abc')).toEqual({ ok: true, code: 'abc' })
    const maxCode = 'a'.repeat(ROOM_CODE_MAX_LENGTH)
    expect(validateRoomCode(maxCode)).toEqual({ ok: true, code: maxCode })
  })

  it('rejeita codigo longo demais', () => {
    expect(validateRoomCode('a'.repeat(ROOM_CODE_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: 'too_long'
    })
  })

  it('rejeita caracteres fora de [a-zA-Z0-9-]', () => {
    expect(validateRoomCode('sala do pontin')).toEqual({ ok: false, error: 'invalid_chars' })
    expect(validateRoomCode('sala_pontin')).toEqual({ ok: false, error: 'invalid_chars' })
    expect(validateRoomCode('sala@pontin')).toEqual({ ok: false, error: 'invalid_chars' })
    expect(validateRoomCode('sala.pontin')).toEqual({ ok: false, error: 'invalid_chars' })
  })

  it('aceita hifen e alfanumericos misturados', () => {
    expect(validateRoomCode('Sala-Do-Pontin-42')).toEqual({ ok: true, code: 'sala-do-pontin-42' })
  })
})

describe('room-code / normalizacao case-insensitive (AC-29)', () => {
  it('trim + lowercase', () => {
    expect(normalize('  SALA-do-Pontin  ')).toBe('sala-do-pontin')
  })

  it('codigos equivalentes mapeiam para o mesmo peer id', () => {
    expect(toPeerId('SALA-do-Pontin')).toBe(toPeerId('  sala-do-pontin '))
  })
})

describe('room-code / codigo aleatorio', () => {
  it('gera no formato <palavra>-<4 alfanumericos>', () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const code = generateRoomCode()
      expect(code).toMatch(/^[a-z]+-[a-z0-9]{4}$/)
      const [word] = code.split('-')
      expect(ROOM_CODE_WORDS).toContain(word)
      expect(validateRoomCode(code).ok).toBe(true)
    }
  })

  it('e deterministico com gerador injetado', () => {
    const constant = (): number => 0
    expect(generateRoomCode(constant)).toBe('filme-aaaa')
  })

  it('nunca estoura o indice com random proximo de 1', () => {
    const almostOne = (): number => 0.999999999
    const code = generateRoomCode(almostOne)
    expect(code).toMatch(/^[a-z]+-[a-z0-9]{4}$/)
  })
})

describe('room-code / mapeamento para peer id (RF-03)', () => {
  it('aplica o prefixo de namespace', () => {
    expect(toPeerId('pipoca-1a2b')).toBe(`${ROOM_ID_PREFIX}pipoca-1a2b`)
  })

  it('faz o caminho de volta', () => {
    expect(fromPeerId(toPeerId('Zoi-9x8y'))).toBe('zoi-9x8y')
    expect(fromPeerId('outro-app-zoi')).toBeNull()
  })
})
