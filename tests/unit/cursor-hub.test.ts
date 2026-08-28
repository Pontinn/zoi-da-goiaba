// O coracao da viewer-cursors: o unico lugar por onde posicao de cursor entra e
// sai. Regra deste arquivo: cada caso precisa DISCRIMINAR, isto e, falhar se a
// regra for invertida. Um teste que passa com a implementacao errada nao serve.
//
// Preparo obrigatorio de ambiente: o hub fala com DUAS superficies externas e as
// duas precisam de dublagem. (a) a porta `CursorSessionPort`, injetada por
// `attach`; (b) `window.zoi.pointerOverlay.sendFrame`, que nao existe no
// ambiente do Vitest. Um caso dedicado roda SEM o stub e prova que o hub nao
// lanca, que e a razao de o acessor ser defensivo.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CURSOR_IDLE_MS,
  CURSOR_RECEIVE_MIN_GAP_MS,
  CURSOR_SEND_INTERVAL_MS,
  POINTER_OVERLAY_FRAME_MS
} from '@shared/config'
import type { ProtocolMessage } from '@shared/protocol'
import {
  createInitialState,
  type RoomState,
  type TransmissionState
} from '@renderer/core/room-state'
import { cursorHub, type CursorSessionPort } from '@renderer/services/cursor-hub'

const START_TIME = 1_800_000_000_000

function transmission(txId: string, peerId: string, pointersEnabled: boolean): TransmissionState {
  return {
    txId,
    peerId,
    presetId: 'p720_30',
    hasAudio: false,
    sourceKind: 'screen',
    sourceLabel: 'Tela 1',
    startedAt: 10,
    status: 'live',
    videoCodec: 'VP8',
    pointersEnabled
  }
}

/**
 * Sala do exemplo trabalhado de 5.C2: Leo transmite A, Bruna e Joao assistem A,
 * Carla transmite e assiste B.
 */
function roomState(selfPeerId: string, selfWatchingTxId: string | null): RoomState {
  return {
    ...createInitialState(),
    phase: 'active',
    selfPeerId,
    ownerPeerId: 'Leo',
    selfWatchingTxId,
    members: [
      { peerId: 'Leo', installId: 'i1', nickname: 'Leo', joinedAt: 1, isOwner: true },
      { peerId: 'Bruna', installId: 'i2', nickname: 'Bruna', joinedAt: 2, isOwner: false },
      { peerId: 'Joao', installId: 'i3', nickname: 'Joao', joinedAt: 3, isOwner: false },
      { peerId: 'Carla', installId: 'i4', nickname: 'Carla', joinedAt: 4, isOwner: false }
    ],
    transmissions: { A: transmission('A', 'Leo', true), B: transmission('B', 'Carla', true) },
    watching: { Bruna: 'A', Joao: 'A', Carla: 'B' }
  }
}

interface Sent {
  peerIds: readonly string[]
  message: ProtocolMessage
}

interface Harness {
  port: CursorSessionPort
  sent: Sent[]
  /** Empurra um estado novo pelos assinantes, como `session.notify()` faz. */
  push(next: RoomState): void
}

function makeHarness(initial: RoomState): Harness {
  let current = initial
  const listeners = new Set<(next: RoomState) => void>()
  const sent: Sent[] = []
  return {
    sent,
    push(next) {
      current = next
      for (const listener of listeners) listener(next)
    },
    port: {
      getState: () => current,
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      sendCursor(peerIds, message) {
        sent.push({ peerIds, message })
      }
    }
  }
}

function move(txId: string, x: number, y: number): ProtocolMessage {
  return { type: 'CURSOR_MOVE', payload: { txId, x, y } }
}

function end(txId: string): ProtocolMessage {
  return { type: 'CURSOR_END', payload: { txId } }
}

let sendFrame: ReturnType<typeof vi.fn>

function stubOverlay(): void {
  sendFrame = vi.fn()
  vi.stubGlobal('window', { zoi: { pointerOverlay: { sendFrame } } })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START_TIME)
  stubOverlay()
})

afterEach(() => {
  cursorHub.dispose()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('cursor-hub / envio (lado de quem aponta)', () => {
  it('manda no maximo 25 por segundo: 1 000 ms dao EXATAMENTE 25 envios', () => {
    // Prova numerica de RF-32. Falha se alguem trocar o timer por envio direto
    // no mousemove (ai seriam 1 000) ou mexer no intervalo.
    const harness = makeHarness(roomState('Bruna', 'A'))
    cursorHub.attach(harness.port)
    cursorHub.setSendContext({ txId: 'A', enabled: true })

    for (let step = 1; step <= 1_000; step += 1) {
      cursorHub.reportLocalPoint(step / 2_000, 0.5)
      vi.advanceTimersByTime(1)
    }

    expect(harness.sent).toHaveLength(1_000 / CURSOR_SEND_INTERVAL_MS)
    expect(harness.sent).toHaveLength(25)
    expect(harness.sent.length).not.toBe(26)
  })

  it('coalesce: 10 posicoes dentro de uma janela de 40 ms viram UM envio', () => {
    const harness = makeHarness(roomState('Bruna', 'A'))
    cursorHub.attach(harness.port)
    cursorHub.setSendContext({ txId: 'A', enabled: true })

    for (let index = 0; index < 10; index += 1) {
      cursorHub.reportLocalPoint(0.1 + index * 0.01, 0.2)
    }
    vi.advanceTimersByTime(CURSOR_SEND_INTERVAL_MS)

    expect(harness.sent).toHaveLength(1)
    // A ULTIMA posicao e a que vale: o cursor nao anda para tras.
    expect(harness.sent[0]?.message).toEqual(move('A', 0.19, 0.2))
  })

  it('sem movimento, sem envio (RF-30)', () => {
    const harness = makeHarness(roomState('Bruna', 'A'))
    cursorHub.attach(harness.port)
    cursorHub.setSendContext({ txId: 'A', enabled: true })

    cursorHub.reportLocalPoint(0.4, 0.4)
    vi.advanceTimersByTime(CURSOR_SEND_INTERVAL_MS)
    expect(harness.sent).toHaveLength(1)

    // Mouse parado no mesmo pixel por dez ciclos: nenhum envio novo.
    for (let index = 0; index < 10; index += 1) {
      cursorHub.reportLocalPoint(0.4, 0.4)
      vi.advanceTimersByTime(CURSOR_SEND_INTERVAL_MS)
    }
    expect(harness.sent).toHaveLength(1)

    // Ruido de subpixel tambem nao conta como movimento.
    cursorHub.reportLocalPoint(0.4001, 0.4001)
    vi.advanceTimersByTime(CURSOR_SEND_INTERVAL_MS)
    expect(harness.sent).toHaveLength(1)
  })

  it('manda para os co-espectadores E o transmissor, nunca para a sala inteira', () => {
    // Exemplo trabalhado de 5.C2: Bruna aponta em A, entao os destinatarios sao
    // Joao (co-espectador) e Leo (transmissor). Carla assiste B e fica de fora,
    // e a propria Bruna nunca entra na lista (primeira rede de RF-14).
    const harness = makeHarness(roomState('Bruna', 'A'))
    cursorHub.attach(harness.port)
    cursorHub.setSendContext({ txId: 'A', enabled: true })

    cursorHub.reportLocalPoint(0.3, 0.6)
    vi.advanceTimersByTime(CURSOR_SEND_INTERVAL_MS)

    expect(harness.sent[0]?.peerIds).toEqual(['Joao', 'Leo'])
    expect(harness.sent[0]?.peerIds).not.toContain('Carla')
    expect(harness.sent[0]?.peerIds).not.toContain('Bruna')
  })

  it('com o toggle DESLIGADO na transmissao nada sai, por mais que o mouse ande', () => {
    const state = roomState('Bruna', 'A')
    const harness = makeHarness({
      ...state,
      transmissions: { ...state.transmissions, A: transmission('A', 'Leo', false) }
    })
    cursorHub.attach(harness.port)
    cursorHub.setSendContext({ txId: 'A', enabled: true })

    for (let index = 0; index < 20; index += 1) {
      cursorHub.reportLocalPoint(0.1 + index * 0.02, 0.5)
      vi.advanceTimersByTime(CURSOR_SEND_INTERVAL_MS)
    }
    expect(harness.sent).toHaveLength(0)
  })

  it('endLocal manda UM CURSOR_END e e idempotente', () => {
    const harness = makeHarness(roomState('Bruna', 'A'))
    cursorHub.attach(harness.port)
    cursorHub.setSendContext({ txId: 'A', enabled: true })

    cursorHub.endLocal('A')
    cursorHub.endLocal('A')
    expect(harness.sent).toHaveLength(1)
    expect(harness.sent[0]?.message).toEqual(end('A'))
    expect(harness.sent[0]?.peerIds).toEqual(['Joao', 'Leo'])
  })

  it('trocar de txId encerra o ponteiro na transmissao ANTERIOR (RF-18)', () => {
    const harness = makeHarness(roomState('Bruna', 'A'))
    cursorHub.attach(harness.port)
    cursorHub.setSendContext({ txId: 'A', enabled: true })
    cursorHub.reportLocalPoint(0.2, 0.2)
    vi.advanceTimersByTime(CURSOR_SEND_INTERVAL_MS)

    cursorHub.setSendContext({ txId: 'B', enabled: true })
    expect(harness.sent[harness.sent.length - 1]?.message).toEqual(end('A'))
  })

  it('nao lanca quando ainda nao ha porta (ordem de carga dos modulos)', () => {
    // `applyRemote`, `flush` e `endLocal` antes de `attach` viram no-op: e o que
    // torna a ordem de carga dos modulos irrelevante.
    expect(() => cursorHub.setSendContext({ txId: 'A', enabled: true })).not.toThrow()
    expect(() => cursorHub.reportLocalPoint(0.5, 0.5)).not.toThrow()
    expect(() => vi.advanceTimersByTime(CURSOR_SEND_INTERVAL_MS)).not.toThrow()
    expect(() => cursorHub.endLocal('A')).not.toThrow()
    expect(() => cursorHub.applyRemote('Bruna', move('A', 0.5, 0.5))).not.toThrow()
    expect(cursorHub.debugSnapshot()).toEqual({})
  })
})

describe('cursor-hub / matriz 5c no recebimento', () => {
  /** Joao assiste A: ele e um receptor legitimo das posicoes da Bruna. */
  function attachAsJoao(state = roomState('Joao', 'A')): Harness {
    const harness = makeHarness(state)
    cursorHub.attach(harness.port)
    return harness
  }

  it('aceita a posicao de um espectador legitimo', () => {
    // Controle: sem ele, os casos negativos abaixo poderiam passar por engano.
    attachAsJoao()
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()['A']).toHaveLength(1)
    expect(cursorHub.debugSnapshot()['A']?.[0]).toMatchObject({
      peerId: 'Bruna',
      x: 0.3,
      y: 0.4,
      idle: false
    })
  })

  it('(1) descarta remetente que nao esta no roster, SEM fechar conexao', () => {
    const harness = attachAsJoao()
    cursorHub.applyRemote('Zeca', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()).toEqual({})
    // Risco R8: esta mensagem nao passa pelo reducer, entao nao existe caminho
    // para `rejectFrom` nem para `closeConnection`. A porta so tem `sendCursor`.
    expect(harness.sent).toHaveLength(0)
    expect(Object.keys(harness.port)).toEqual(['getState', 'subscribe', 'sendCursor'])
  })

  it('(2) descarta txId que nao existe no estado', () => {
    const harness = attachAsJoao()
    cursorHub.applyRemote('Bruna', move('nao-existe', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()).toEqual({})
    expect(harness.sent).toHaveLength(0)
  })

  it('(3) descarta quando a transmissao esta com os ponteiros DESLIGADOS', () => {
    const state = roomState('Joao', 'A')
    attachAsJoao({
      ...state,
      transmissions: { ...state.transmissions, A: transmission('A', 'Leo', false) }
    })
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('(4) descarta quem NAO anunciou que assiste aquela transmissao', () => {
    const state = roomState('Joao', 'A')
    attachAsJoao({ ...state, watching: { Joao: 'A', Carla: 'B' } })
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('(5) descarta quando o RECEPTOR nao participa daquela transmissao', () => {
    // Carla assiste B: ela nunca pode ver ponteiro de quem aponta em A (RF-16).
    attachAsJoao(roomState('Carla', 'B'))
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('(5) o TRANSMISSOR tambem e receptor legitimo', () => {
    attachAsJoao(roomState('Leo', null))
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()['A']).toHaveLength(1)
  })

  it('(6) descarta valor fora de [0..1] SEM clampar', () => {
    // Clampar prenderia um ponteiro na borda da tela, que e o defeito que RF-17
    // proibe: por isso o descarte e total e nao uma correcao.
    attachAsJoao()
    cursorHub.applyRemote('Bruna', move('A', 5, 0.4))
    cursorHub.applyRemote('Bruna', move('A', 0.4, -3))
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('(7) descarta a propria posicao voltando por engano', () => {
    // Ultima rede de RF-14: ninguem ve o proprio cursor.
    attachAsJoao(roomState('Bruna', 'A'))
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('(8) descarta a segunda mensagem dentro de CURSOR_RECEIVE_MIN_GAP_MS', () => {
    attachAsJoao()
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    vi.advanceTimersByTime(CURSOR_RECEIVE_MIN_GAP_MS - 1)
    cursorHub.applyRemote('Bruna', move('A', 0.9, 0.9))
    // A enxurrada nao entra: a posicao continua sendo a primeira.
    expect(cursorHub.debugSnapshot()['A']?.[0]).toMatchObject({ x: 0.3, y: 0.4 })

    vi.advanceTimersByTime(1)
    cursorHub.applyRemote('Bruna', move('A', 0.9, 0.9))
    expect(cursorHub.debugSnapshot()['A']?.[0]).toMatchObject({ x: 0.9, y: 0.9 })
  })

  it('CURSOR_END e aceito mesmo de quem JA parou de assistir (RF-18)', () => {
    const state = roomState('Joao', 'A')
    const harness = attachAsJoao(state)
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()['A']).toHaveLength(1)

    // Bruna trocou de transmissao: a checagem (4) deixaria de valer para MOVE,
    // mas o END precisa passar, senao o ponteiro dela ficaria preso.
    harness.push({ ...state, watching: { Joao: 'A', Carla: 'B' } })
    cursorHub.applyRemote('Bruna', end('A'))
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('CURSOR_END de quem nunca mandou posicao e no-op', () => {
    attachAsJoao()
    expect(() => cursorHub.applyRemote('Bruna', end('A'))).not.toThrow()
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('separa as entradas por txId: duas transmissoes nao se misturam', () => {
    // Leo transmite A e assiste B ao mesmo tempo (persona 3 da PRD).
    const base = roomState('Leo', 'B')
    const state: RoomState = { ...base, watching: { Bruna: 'A', Joao: 'B', Carla: 'B' } }
    attachAsJoao(state)
    cursorHub.applyRemote('Bruna', move('A', 0.1, 0.1))
    cursorHub.applyRemote('Joao', move('B', 0.9, 0.9))

    const snapshot = cursorHub.debugSnapshot()
    expect(Object.keys(snapshot).sort()).toEqual(['A', 'B'])
    expect(snapshot['A']?.[0]?.peerId).toBe('Bruna')
    expect(snapshot['B']?.[0]?.peerId).toBe('Joao')

    // Mexer no contexto de ENVIO de um nao apaga as entradas do outro.
    cursorHub.setSendContext({ txId: 'B', enabled: true })
    expect(Object.keys(cursorHub.debugSnapshot()).sort()).toEqual(['A', 'B'])
  })
})

describe('cursor-hub / ciclo de vida das entradas', () => {
  function attached(state = roomState('Joao', 'A')): Harness {
    const harness = makeHarness(state)
    cursorHub.attach(harness.port)
    return harness
  }

  it('esmaece depois de CURSOR_IDLE_MS e volta na proxima posicao', () => {
    attached()
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()['A']?.[0]?.idle).toBe(false)

    vi.advanceTimersByTime(CURSOR_IDLE_MS - POINTER_OVERLAY_FRAME_MS)
    expect(cursorHub.debugSnapshot()['A']?.[0]?.idle).toBe(false)

    vi.advanceTimersByTime(POINTER_OVERLAY_FRAME_MS * 2)
    expect(cursorHub.debugSnapshot()['A']?.[0]?.idle).toBe(true)

    cursorHub.applyRemote('Bruna', move('A', 0.31, 0.4))
    expect(cursorHub.debugSnapshot()['A']?.[0]?.idle).toBe(false)
  })

  it('relogio andando para TRAS conta como idle, e nao prende o ponteiro', () => {
    attached()
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    // Ajuste de horario do sistema: `now - lastAt` fica negativo e o ponteiro
    // nunca esmaeceria sem o tratamento do caso absurdo.
    vi.setSystemTime(START_TIME - 60 * 60 * 1_000)
    vi.advanceTimersByTime(POINTER_OVERLAY_FRAME_MS)
    expect(cursorHub.debugSnapshot()['A']?.[0]?.idle).toBe(true)
  })

  it('poda o ponteiro de quem saiu do roster (RF-29)', () => {
    const state = roomState('Joao', 'A')
    const harness = attached(state)
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(cursorHub.debugSnapshot()['A']).toHaveLength(1)

    harness.push({ ...state, members: state.members.filter((m) => m.peerId !== 'Bruna') })
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('poda TODAS as entradas de um txId quando o toggle dele desliga (RF-27)', () => {
    const base = roomState('Leo', 'B')
    const state: RoomState = { ...base, watching: { Bruna: 'A', Joao: 'B', Carla: 'B' } }
    const harness = attached(state)
    cursorHub.applyRemote('Bruna', move('A', 0.1, 0.1))
    cursorHub.applyRemote('Joao', move('B', 0.9, 0.9))
    expect(Object.keys(cursorHub.debugSnapshot()).sort()).toEqual(['A', 'B'])

    harness.push({
      ...state,
      transmissions: { ...state.transmissions, A: transmission('A', 'Leo', false) }
    })
    // So o txId afetado some; o outro continua intacto.
    expect(Object.keys(cursorHub.debugSnapshot())).toEqual(['B'])
  })

  it('poda o txId que sumiu do estado (transmissao encerrada)', () => {
    const state = roomState('Joao', 'A')
    const harness = attached(state)
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    harness.push({ ...state, transmissions: { B: transmission('B', 'Carla', true) } })
    expect(cursorHub.debugSnapshot()).toEqual({})
  })

  it('reset limpa as entradas mas PRESERVA a porta', () => {
    // `session.reset()` chama `teardown()`, que chama `reset()` do hub. Se a
    // porta fosse zerada aqui, sair de uma sala e entrar em outra deixaria o hub
    // mudo para sempre.
    attached()
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    cursorHub.reset()
    expect(cursorHub.debugSnapshot()).toEqual({})

    cursorHub.applyRemote('Bruna', move('A', 0.5, 0.5))
    expect(cursorHub.debugSnapshot()['A']).toHaveLength(1)
  })
})

describe('cursor-hub / frame agregado e timers', () => {
  it('emite UM frame por tick com TODOS os ponteiros, e nao um por ponteiro', () => {
    const base = roomState('Leo', null)
    const state: RoomState = { ...base, watching: { Bruna: 'A', Joao: 'A', Carla: 'A' } }
    const harness = makeHarness(state)
    cursorHub.attach(harness.port)
    cursorHub.setOverlayContext({ txId: 'A', enabled: true })

    cursorHub.applyRemote('Bruna', move('A', 0.1, 0.1))
    cursorHub.applyRemote('Joao', move('A', 0.2, 0.2))
    cursorHub.applyRemote('Carla', move('A', 0.3, 0.3))
    sendFrame.mockClear()

    vi.advanceTimersByTime(POINTER_OVERLAY_FRAME_MS)
    expect(sendFrame).toHaveBeenCalledTimes(1)
    const frame = sendFrame.mock.calls[0]?.[0] as {
      txId: string
      pointers: { peerId: string; nickname: string; fill: string; idle: boolean }[]
    }
    expect(frame.txId).toBe('A')
    expect(frame.pointers).toHaveLength(3)
    // Nickname e cor ja vem RESOLVIDOS: a janela de overlay nao tem roster.
    expect(frame.pointers.map((pointer) => pointer.nickname).sort()).toEqual([
      'Bruna',
      'Carla',
      'Joao'
    ])
    for (const pointer of frame.pointers) {
      expect(pointer.fill).toMatch(/^hsl\(\d+ 100% \d+%\)$/)
    }
    // Cores diferentes por pessoa (RF-21): tres pessoas, tres cores.
    expect(new Set(frame.pointers.map((pointer) => pointer.fill)).size).toBe(3)
  })

  it('nao lanca quando window.zoi.pointerOverlay NAO existe', () => {
    // A guarda do acessor defensivo: sem ela, so instanciar o hub quebraria este
    // arquivo, porque o ambiente do Vitest nao tem `window.zoi`.
    vi.stubGlobal('window', undefined)
    const harness = makeHarness(roomState('Leo', null))
    cursorHub.attach(harness.port)
    cursorHub.setOverlayContext({ txId: 'A', enabled: true })
    cursorHub.applyRemote('Bruna', move('A', 0.1, 0.1))
    expect(() => vi.advanceTimersByTime(POINTER_OVERLAY_FRAME_MS * 3)).not.toThrow()
    expect(cursorHub.debugSnapshot()['A']).toHaveLength(1)
  })

  it('sem ponteiro e sem envio, NENHUM dos dois timers fica armado', () => {
    // Prova de RNF-01 no caso mais comum, que e a sala parada.
    const harness = makeHarness(roomState('Joao', 'A'))
    cursorHub.attach(harness.port)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('o tick de frame se desarma sozinho quando a ultima entrada some', () => {
    const state = roomState('Joao', 'A')
    const harness = makeHarness(state)
    cursorHub.attach(harness.port)
    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    cursorHub.applyRemote('Bruna', end('A'))
    // Um tick para emitir o frame final vazio, outro para desarmar.
    vi.advanceTimersByTime(POINTER_OVERLAY_FRAME_MS * 3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('avisa o assinante de roster so quando o CONJUNTO muda', () => {
    const harness = makeHarness(roomState('Joao', 'A'))
    cursorHub.attach(harness.port)
    const seen: string[][] = []
    const dispose = cursorHub.subscribeRoster('A', (peerIds) => seen.push(peerIds))
    // A assinatura entrega o estado corrente na hora.
    expect(seen).toEqual([[]])

    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    vi.advanceTimersByTime(POINTER_OVERLAY_FRAME_MS)
    expect(seen[seen.length - 1]).toEqual(['Bruna'])

    // Mais posicoes da MESMA pessoa nao mexem no conjunto: nenhum aviso novo.
    const before = seen.length
    for (let index = 0; index < 5; index += 1) {
      vi.advanceTimersByTime(CURSOR_RECEIVE_MIN_GAP_MS)
      cursorHub.applyRemote('Bruna', move('A', 0.3 + index * 0.01, 0.4))
      vi.advanceTimersByTime(POINTER_OVERLAY_FRAME_MS)
    }
    expect(seen).toHaveLength(before)
    dispose()
  })

  it('entrega as posicoes ao assinante de frame a cada tick', () => {
    const harness = makeHarness(roomState('Joao', 'A'))
    cursorHub.attach(harness.port)
    const frames: number[] = []
    const dispose = cursorHub.subscribeFrame('A', (entries) => frames.push(entries.length))

    cursorHub.applyRemote('Bruna', move('A', 0.3, 0.4))
    vi.advanceTimersByTime(POINTER_OVERLAY_FRAME_MS * 2)
    expect(frames.length).toBeGreaterThanOrEqual(2)
    expect(frames[frames.length - 1]).toBe(1)
    dispose()
  })
})
