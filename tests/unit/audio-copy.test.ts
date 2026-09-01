// Copy dos avisos de captura de audio (F1.1). O projeto nao tem Testing
// Library, e o Vitest roda em ambiente node: nada aqui RENDERIZA a tela, so
// importa o modulo de strings (que nao tem import nenhum de proposito) e prova
// mecanicamente as regras de escrita e os textos congelados.
//
// A cobertura visual do toast vive no exercicio com render de F1.1.
import { describe, expect, it } from 'vitest'
import { AUDIO_CAPTURE_COPY } from '@renderer/ui/screens/audio-copy'

const APP = 'steam.exe'

/**
 * ASCII imprimivel apenas. Proibe de uma vez acento, travessao e en-dash
 * (RNF-08/AC-27): qualquer um deles cai fora desta faixa. E a defesa contra
 * homoglifo, que leitura humana nao pega (LESSONS 2026-08-27).
 */
const ASCII_ONLY = /^[\x20-\x7E]+$/

const ALL_STRINGS: readonly [string, string][] = [
  ['fullLoopbackStart', AUDIO_CAPTURE_COPY.fullLoopbackStart],
  ['degradedRuntime', AUDIO_CAPTURE_COPY.degradedRuntime],
  ['failedRuntime', AUDIO_CAPTURE_COPY.failedRuntime],
  ['appNotCaptured', AUDIO_CAPTURE_COPY.appNotCaptured(APP)],
  ['noAudio', AUDIO_CAPTURE_COPY.noAudio]
]

describe('copy dos avisos de captura de audio', () => {
  it('e 100% ASCII imprimivel: sem acento e sem travessao', () => {
    for (const [label, text] of ALL_STRINGS) {
      expect(text, label).toMatch(ASCII_ONLY)
      expect(text.includes('—'), label + ' com travessao').toBe(false)
      expect(text.includes('–'), label + ' com en-dash').toBe(false)
    }
  })

  it('nenhuma string e vazia', () => {
    for (const [label, text] of ALL_STRINGS) {
      expect(text.trim().length, label).toBeGreaterThan(0)
    }
  })

  it('o aviso de sistema inteiro nomeia a CONSEQUENCIA, nao a causa (RF-13)', () => {
    expect(AUDIO_CAPTURE_COPY.fullLoopbackStart).toContain('sistema')
    expect(AUDIO_CAPTURE_COPY.fullLoopbackStart).toContain('Discord')
    // O texto antigo descrevia a causa e foi entendido ao contrario em campo.
    expect(AUDIO_CAPTURE_COPY.fullLoopbackStart).not.toContain('Nao foi possivel isolar')
  })

  it('os dois avisos de runtime estao CONGELADOS letra por letra (RF-16/AC-15)', () => {
    expect(AUDIO_CAPTURE_COPY.degradedRuntime).toBe(
      'A captura de audio por aplicativo falhou; a transmissao segue com o som do sistema inteiro.'
    )
    expect(AUDIO_CAPTURE_COPY.failedRuntime).toBe(
      'O audio da transmissao caiu; pare e transmita de novo para restaurar o som.'
    )
  })

  it('o aviso por aplicativo interpola o nome recebido (RF-19)', () => {
    expect(AUDIO_CAPTURE_COPY.appNotCaptured(APP)).toContain(APP)
    expect(AUDIO_CAPTURE_COPY.appNotCaptured('jogo.exe')).toContain('jogo.exe')
  })
})
