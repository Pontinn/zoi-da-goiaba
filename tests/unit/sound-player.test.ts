// Volume dos sons do app: clamp na entrada e aplicacao tanto nos elementos
// pre-carregados quanto no clone de cada disparo (o clone nasce no volume
// padrao do elemento novo, entao esquecer de reaplicar sairia sempre em 100%).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clampSoundVolume, DEFAULT_SOUND_VOLUME } from '@shared/sounds'
import {
  getSoundVolume,
  playSound,
  preloadSounds,
  setSoundVolume
} from '@renderer/services/sound-player'

/**
 * Audio falsa. `cloneNode` NAO copia a propriedade `volume` (so atributos), como
 * no DOM de verdade: e exatamente essa a armadilha que o teste vigia.
 */
class FakeAudio {
  static created: FakeAudio[] = []
  static played: FakeAudio[] = []

  volume = 1
  preload = ''
  readonly src: string

  constructor(src = '') {
    this.src = src
    FakeAudio.created.push(this)
  }

  load(): void {}

  cloneNode(): FakeAudio {
    return new FakeAudio(this.src)
  }

  play(): Promise<void> {
    FakeAudio.played.push(this)
    return Promise.resolve()
  }
}

function lastPlayed(): FakeAudio {
  const audio = FakeAudio.played.at(-1)
  if (!audio) throw new Error('nenhum som foi tocado')
  return audio
}

beforeEach(() => {
  FakeAudio.created = []
  FakeAudio.played = []
  vi.stubGlobal('Audio', FakeAudio)
})

afterEach(() => {
  setSoundVolume(DEFAULT_SOUND_VOLUME)
  vi.unstubAllGlobals()
})

describe('clampSoundVolume', () => {
  it('mantem valores dentro da faixa', () => {
    expect(clampSoundVolume(0)).toBe(0)
    expect(clampSoundVolume(0.42)).toBe(0.42)
    expect(clampSoundVolume(1)).toBe(1)
  })

  it('prende valores fora da faixa em 0..1', () => {
    expect(clampSoundVolume(-3)).toBe(0)
    expect(clampSoundVolume(7)).toBe(1)
  })

  it('cai no padrao quando o valor esta ausente ou invalido', () => {
    expect(clampSoundVolume(undefined)).toBe(DEFAULT_SOUND_VOLUME)
    expect(clampSoundVolume(null)).toBe(DEFAULT_SOUND_VOLUME)
    expect(clampSoundVolume('0.5')).toBe(DEFAULT_SOUND_VOLUME)
    expect(clampSoundVolume(Number.NaN)).toBe(DEFAULT_SOUND_VOLUME)
  })
})

describe('setSoundVolume', () => {
  it('comeca no padrao e guarda o valor normalizado', () => {
    expect(getSoundVolume()).toBe(DEFAULT_SOUND_VOLUME)
    setSoundVolume(0.3)
    expect(getSoundVolume()).toBe(0.3)
    setSoundVolume(-1)
    expect(getSoundVolume()).toBe(0)
    setSoundVolume(9)
    expect(getSoundVolume()).toBe(1)
  })

  it('aplica nos elementos ja pre-carregados', () => {
    preloadSounds()
    expect(FakeAudio.created.length).toBeGreaterThan(0)
    setSoundVolume(0.25)
    for (const audio of FakeAudio.created) expect(audio.volume).toBe(0.25)
  })
})

describe('playSound', () => {
  it('toca o clone no volume atual', () => {
    setSoundVolume(0.6)
    playSound('entered')
    expect(lastPlayed().volume).toBe(0.6)
  })

  it('acompanha a troca de volume entre dois disparos', () => {
    setSoundVolume(0.2)
    playSound('left')
    expect(lastPlayed().volume).toBe(0.2)
    setSoundVolume(0.9)
    playSound('left')
    expect(lastPlayed().volume).toBe(0.9)
  })

  it('no zero o clone sai mudo de verdade', () => {
    setSoundVolume(0)
    playSound('transmitting')
    expect(lastPlayed().volume).toBe(0)
  })
})
