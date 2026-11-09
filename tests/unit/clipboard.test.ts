import { afterEach, describe, expect, it, vi } from 'vitest'
import { readText } from '@renderer/ui/clipboard'

function stubClipboard(readTextImpl: () => Promise<string>): void {
  vi.stubGlobal('navigator', { clipboard: { readText: vi.fn(readTextImpl) } })
}

describe('clipboard / readText (botao Colar codigo)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('devolve o texto da area de transferencia', async () => {
    stubClipboard(() => Promise.resolve('goiaba-4f2k'))
    await expect(readText()).resolves.toBe('goiaba-4f2k')
  })

  it('devolve null quando a leitura e negada', async () => {
    stubClipboard(() =>
      Promise.reject(new DOMException('Read permission denied.', 'NotAllowedError'))
    )
    await expect(readText()).resolves.toBeNull()
  })

  it('devolve null quando a Clipboard API nao existe', async () => {
    vi.stubGlobal('navigator', {})
    await expect(readText()).resolves.toBeNull()
  })
})
