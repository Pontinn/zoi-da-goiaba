// Heartbeat e maquina de estados do link de mesh (SPEC secao 2.7, matriz 5c).
// Relogio fake em todos os casos: nada aqui espera tempo de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HEARTBEAT_INTERVAL_MS,
  MESH_CONNECT_RETRY_INTERVAL_MS,
  MESH_CONNECT_TIMEOUT_MS,
  RECONNECT_WINDOW_MS
} from '@shared/config'
import { ReconnectionManager } from '@renderer/services/reconnection'

function harness(): {
  manager: ReconnectionManager
  pings: { peerId: string; seq: number }[]
  redials: string[]
  reconnecting: string[]
  timeouts: string[]
  failures: string[]
  rtts: { peerId: string; rttMs: number }[]
} {
  const pings: { peerId: string; seq: number }[] = []
  const redials: string[] = []
  const reconnecting: string[] = []
  const timeouts: string[] = []
  const failures: string[] = []
  const rtts: { peerId: string; rttMs: number }[] = []

  const manager = new ReconnectionManager({
    sendPing: (peerId, seq) => pings.push({ peerId, seq }),
    redial: (peerId) => redials.push(peerId),
    onReconnecting: (peerId) => reconnecting.push(peerId),
    onReconnectTimeout: (peerId) => timeouts.push(peerId),
    onConnectFailed: (peerId) => failures.push(peerId),
    onRtt: (peerId, rttMs) => rtts.push({ peerId, rttMs })
  })

  return { manager, pings, redials, reconnecting, timeouts, failures, rtts }
}

describe('reconnection / par que morreu vs par que nunca conectou', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('par novo que a sinalizacao diz nao existir entra na janela de 15s (RF-40)', () => {
    const { manager, reconnecting, timeouts, failures } = harness()
    manager.track('b')
    manager.markGone('b')

    expect(reconnecting).toEqual(['b'])
    expect(manager.phaseOf('b')).toBe('reconnecting')

    vi.advanceTimersByTime(RECONNECT_WINDOW_MS + 500)
    expect(timeouts).toEqual(['b'])
    // Nao pode cair no caminho de "nunca conectou": esse par ja foi admitido.
    expect(failures).toEqual([])
    manager.destroy()
  })

  it('par que nao responde mas continua existindo segue em "nunca conectou" (RF-41)', () => {
    const { manager, reconnecting, timeouts, failures, redials } = harness()
    manager.track('b')

    vi.advanceTimersByTime(MESH_CONNECT_TIMEOUT_MS + 500)
    expect(failures).toEqual(['b'])
    expect(reconnecting).toEqual([])
    expect(timeouts).toEqual([])
    expect(manager.phaseOf('b')).toBe('unreachable')
    // Novas ofertas dentro da janela de 20s (5s, 10s, 15s).
    expect(redials.length).toBe(Math.floor(MESH_CONNECT_TIMEOUT_MS / MESH_CONNECT_RETRY_INTERVAL_MS) - 1)
    manager.destroy()
  })

  it('markGone nao derruba link saudavel nem quebra com par desconhecido', () => {
    const { manager, reconnecting } = harness()
    manager.track('b')
    manager.markOpen('b')

    manager.markGone('b')
    manager.markGone('fantasma')

    expect(reconnecting).toEqual([])
    expect(manager.phaseOf('b')).toBe('up')
    expect(manager.phaseOf('fantasma')).toBeNull()
    manager.destroy()
  })

  it('queda de link estabelecido vai para reconnecting e depois para o timeout', () => {
    const { manager, reconnecting, timeouts, failures } = harness()
    manager.track('b')
    manager.markOpen('b')
    manager.markClosed('b')

    expect(reconnecting).toEqual(['b'])
    vi.advanceTimersByTime(RECONNECT_WINDOW_MS + 500)
    expect(timeouts).toEqual(['b'])
    expect(failures).toEqual([])
    manager.destroy()
  })

  it('PONG so vira amostra de RTT quando ecoa o seq enviado (5c)', () => {
    const { manager, pings, rtts } = harness()
    manager.track('b')
    manager.markOpen('b')

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + 100)
    const sent = pings.at(-1)
    expect(sent).toMatchObject({ peerId: 'b' })

    // Eco errado: ignorado como amostra (o link segue vivo, sem RTT novo).
    manager.handlePong('b', (sent?.seq ?? 0) + 500)
    expect(rtts).toEqual([])

    vi.advanceTimersByTime(120)
    manager.handlePong('b', sent?.seq ?? 0)
    expect(rtts).toHaveLength(1)
    expect(rtts[0]?.peerId).toBe('b')
    expect(rtts[0]?.rttMs).toBeGreaterThan(0)
    manager.destroy()
  })

  it('PONG de par desconhecido e descartado sem efeito (5c)', () => {
    const { manager, rtts } = harness()
    manager.track('b')
    manager.markOpen('b')

    manager.handlePong('intruso', 1)

    expect(rtts).toEqual([])
    expect(manager.phaseOf('intruso')).toBeNull()
    expect(manager.phaseOf('b')).toBe('up')
    manager.destroy()
  })

  it('sem PONG por 6s o link estabelecido entra sozinho na janela', () => {
    const { manager, reconnecting, pings } = harness()
    manager.track('b')
    manager.markOpen('b')

    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS + 500)
    expect(pings.length).toBeGreaterThan(0)

    vi.advanceTimersByTime(7_000)
    expect(reconnecting).toEqual(['b'])
    manager.destroy()
  })
})
