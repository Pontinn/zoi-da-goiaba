// Espelho do RoomState do reducer + registro de streams do media-manager.
// O reducer e a fonte da verdade; a store so publica para o React com selectors
// granulares (as streams vivem fora do RoomState por decisao do backend).
import { create } from 'zustand'
import { QUALITY_STALE_MS } from '@shared/config'
import { createInitialState, type RoomState } from '../core/room-state'
import { mediaManager, type LocalTransmission } from '../services/media-manager'
import { session } from '../services/session'

export interface RoomStore {
  room: RoomState
  streams: ReadonlyMap<string, MediaStream>
  localTx: LocalTransmission | null
  /** Tique lento so para reavaliar "sem dados" de qualidade (QUALITY_STALE_MS). */
  qualityTick: number
}

export const useRoomStore = create<RoomStore>(() => ({
  room: createInitialState(),
  streams: new Map(),
  localTx: null,
  qualityTick: 0
}))

/** Liga a store aos servicos. Chamada UMA vez no bootstrap do app. */
export function attachRoomStore(): () => void {
  const unsubscribeSession = session.subscribe((room) => {
    useRoomStore.setState({ room, localTx: mediaManager.getLocalTransmission() })
  })

  const unsubscribeStreams = mediaManager.subscribeStreams((streams) => {
    useRoomStore.setState({ streams, localTx: mediaManager.getLocalTransmission() })
  })

  const tick = setInterval(() => {
    useRoomStore.setState((state) => ({ qualityTick: state.qualityTick + 1 }))
  }, QUALITY_STALE_MS / 2)

  return () => {
    unsubscribeSession()
    unsubscribeStreams()
    clearInterval(tick)
  }
}

/** Sincroniza `localTx` apos acoes de transmissao (start/stop/switch). */
export function refreshLocalTransmission(): void {
  useRoomStore.setState({ localTx: mediaManager.getLocalTransmission() })
}
