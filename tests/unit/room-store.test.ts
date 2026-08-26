// Primeira camada do bloqueio de auto-visualizacao (RF-09): a propria
// transmissao nunca vira selecao, entao nenhum caminho de UI consegue montar o
// player com a propria stream (e o retorno de audio deixa de existir).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WATCHING_UPDATE_DEBOUNCE_MS } from '@shared/config'
import { createInitialState, type TransmissionState } from '@renderer/core/room-state'
import { session } from '@renderer/services/session'
import { selectTransmission, useRoomStore } from '@renderer/store/room-store'

const SELF = 'peer-eu'
const OTHER = 'peer-outro'

function transmission(txId: string, peerId: string): TransmissionState {
  return {
    txId,
    peerId,
    presetId: 'p720_30',
    hasAudio: false,
    sourceKind: 'screen',
    sourceLabel: 'Tela 1',
    startedAt: 0,
    status: 'live',
    videoCodec: null
  }
}

/** Estado montado direto: o alvo aqui e o guard da store, nao o reducer. */
function seedRoom(): void {
  const room = createInitialState(SELF, 'install-eu')
  useRoomStore.setState({
    room: {
      ...room,
      transmissions: {
        'tx-meu': transmission('tx-meu', SELF),
        'tx-dele': transmission('tx-dele', OTHER)
      }
    },
    selectedTxId: null
  })
}

describe('selectTransmission', () => {
  let watch: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    watch = vi.spyOn(session, 'watch').mockImplementation(() => {})
    seedRoom()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    watch.mockRestore()
  })

  it('ignora a propria transmissao: nao seleciona nem avisa o mesh', () => {
    selectTransmission('tx-meu')

    expect(useRoomStore.getState().selectedTxId).toBeNull()
    vi.advanceTimersByTime(WATCHING_UPDATE_DEBOUNCE_MS * 2)
    expect(watch).not.toHaveBeenCalled()
  })

  it('nao derruba uma selecao valida ao tentar selecionar a propria', () => {
    selectTransmission('tx-dele')
    vi.advanceTimersByTime(WATCHING_UPDATE_DEBOUNCE_MS)
    expect(useRoomStore.getState().selectedTxId).toBe('tx-dele')

    selectTransmission('tx-meu')

    expect(useRoomStore.getState().selectedTxId).toBe('tx-dele')
  })

  it('seleciona transmissao de terceiro e agenda o WATCHING_UPDATE', () => {
    selectTransmission('tx-dele')

    expect(useRoomStore.getState().selectedTxId).toBe('tx-dele')
    vi.advanceTimersByTime(WATCHING_UPDATE_DEBOUNCE_MS)
    expect(watch).toHaveBeenCalledWith('tx-dele')
  })

  it('fecha o player com null', () => {
    selectTransmission('tx-dele')
    vi.advanceTimersByTime(WATCHING_UPDATE_DEBOUNCE_MS)

    selectTransmission(null)

    expect(useRoomStore.getState().selectedTxId).toBeNull()
    vi.advanceTimersByTime(WATCHING_UPDATE_DEBOUNCE_MS)
    expect(watch).toHaveBeenLastCalledWith(null)
  })
})
