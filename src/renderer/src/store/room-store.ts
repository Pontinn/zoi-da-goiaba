// Espelho do RoomState do reducer + registro de streams do media-manager.
// O reducer e a fonte da verdade; a store so publica para o React com selectors
// granulares (as streams vivem fora do RoomState por decisao do backend).
import { create } from 'zustand'
import { QUALITY_STALE_MS, WATCHING_UPDATE_DEBOUNCE_MS } from '@shared/config'
import { createInitialState, type RoomState } from '../core/room-state'
import { mediaManager, type LocalTransmission } from '../services/media-manager'
import { session, type SessionHealth } from '../services/session'
import type { InboundVideoStats } from '../services/stats-monitor'

export interface RoomStore {
  room: RoomState
  streams: ReadonlyMap<string, MediaStream>
  /** txIds cuja midia foi anunciada e nunca chegou (conexao direta falhou). */
  mediaFailures: ReadonlySet<string>
  localTx: LocalTransmission | null
  /** Saude do transporte (sinalizacao e porta da sala), fora do RoomState. */
  health: SessionHealth
  /** Tique lento so para reavaliar "sem dados" de qualidade (QUALITY_STALE_MS). */
  qualityTick: number
  /** Transmissao aberta no player. Muda na hora; o broadcast vai com debounce. */
  selectedTxId: string | null
  /**
   * Contadores de quadro por transmissao; prova "decodificado" do aviso de
   * espera e insumo da video-codec-upgrade. Republicado a cada tick de 3s do
   * monitor de qualidade, sem nenhum laco proprio.
   */
  inboundVideoStats: ReadonlyMap<string, InboundVideoStats>
}

export const useRoomStore = create<RoomStore>(() => ({
  room: createInitialState(),
  streams: new Map(),
  mediaFailures: new Set(),
  localTx: null,
  health: session.getHealth(),
  qualityTick: 0,
  selectedTxId: null,
  inboundVideoStats: new Map()
}))

let watchTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Abre (ou fecha, com null) uma transmissao no player. O WATCHING_UPDATE sai com
 * o debounce da SPEC para nao inundar o mesh em trocas rapidas (RF-37).
 *
 * Primeira camada do bloqueio de auto-visualizacao (RF-09): a propria
 * transmissao NUNCA vira selecao, entao nenhum caminho consegue montar o player
 * com a propria stream (e o retorno de audio deixa de existir por construcao).
 */
export function selectTransmission(txId: string | null): void {
  const { room } = useRoomStore.getState()
  if (txId !== null && room.transmissions[txId]?.peerId === room.selfPeerId) return
  useRoomStore.setState({ selectedTxId: txId })
  if (watchTimer !== null) clearTimeout(watchTimer)
  watchTimer = setTimeout(() => {
    watchTimer = null
    session.watch(txId)
  }, WATCHING_UPDATE_DEBOUNCE_MS)
}

/** Liga a store aos servicos. Chamada UMA vez no bootstrap do app. */
export function attachRoomStore(): () => void {
  const unsubscribeSession = session.subscribe((room) => {
    // Transmissao que sumiu (parou, transmissor removido) fecha o player.
    const selected = useRoomStore.getState().selectedTxId
    const stillLive = selected !== null && room.transmissions[selected] !== undefined
    useRoomStore.setState({
      room,
      localTx: mediaManager.getLocalTransmission(),
      selectedTxId: stillLive ? selected : null
    })
  })

  const unsubscribeStreams = mediaManager.subscribeStreams((streams) => {
    useRoomStore.setState({ streams, localTx: mediaManager.getLocalTransmission() })
  })

  const unsubscribeFailures = mediaManager.subscribeMediaFailures((mediaFailures) => {
    useRoomStore.setState({ mediaFailures })
  })

  const unsubscribeVideoStats = session.onInboundVideoStats((inboundVideoStats) => {
    useRoomStore.setState({ inboundVideoStats })
  })

  const unsubscribeHealth = session.onHealth((health) => {
    useRoomStore.setState({ health })
  })

  const tick = setInterval(() => {
    useRoomStore.setState((state) => ({ qualityTick: state.qualityTick + 1 }))
  }, QUALITY_STALE_MS / 2)

  return () => {
    unsubscribeSession()
    unsubscribeStreams()
    unsubscribeFailures()
    unsubscribeVideoStats()
    unsubscribeHealth()
    clearInterval(tick)
  }
}

/** Sincroniza `localTx` apos acoes de transmissao (start/stop/switch). */
export function refreshLocalTransmission(): void {
  useRoomStore.setState({ localTx: mediaManager.getLocalTransmission() })
}
