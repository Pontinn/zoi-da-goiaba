// Copy do aviso de espera (Feature 4.3). O projeto nao tem Testing Library, e o
// Vitest roda em ambiente node: nada aqui RENDERIZA o componente, so importa a
// constante exportada e prova mecanicamente as regras de escrita do projeto.
//
// A cobertura visual do componente vive no e2e, via `data-testid`.
import { describe, expect, it } from 'vitest'
import { WAITING_COPY } from '@renderer/ui/components/WaitingOverlay'

const NICKNAME = 'Pontin'

/**
 * ASCII imprimivel apenas. Proibe de uma vez acento, travessao e en-dash
 * (RNF-08/AC-24): qualquer um deles cai fora desta faixa.
 */
const ASCII_ONLY = /^[\x20-\x7E]+$/

const ALL_STRINGS: readonly [string, string][] = [
  ['noticeText', WAITING_COPY.noticeText],
  ['noticeHint', WAITING_COPY.noticeHint(NICKNAME)],
  ['escalatedText', WAITING_COPY.escalatedText],
  ['escalatedHint', WAITING_COPY.escalatedHint(NICKNAME)]
]

describe('copy do aviso de espera', () => {
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

  it('os hints citam o transmissor pelo apelido', () => {
    expect(WAITING_COPY.noticeHint(NICKNAME)).toContain(NICKNAME)
    expect(WAITING_COPY.escalatedHint(NICKNAME)).toContain(NICKNAME)
  })

  it('o segundo estagio sugere fechar e abrir, sem botao nenhum (RF-12)', () => {
    expect(WAITING_COPY.escalatedHint(NICKNAME)).toContain('Feche e abra')
  })
})
