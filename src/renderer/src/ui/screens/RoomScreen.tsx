// Tela 4 do UISPEC (Sala): barra de transmissao, sidebar de participantes com
// badges, grade de miniaturas ao vivo, fluxo de transmitir e moderacao do dono.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { colorOfSlot, resolvePersonSlots, type PersonColor } from '@shared/person-colors'
import { PRESETS } from '@shared/presets'
import { isOwner as computeIsOwner, nicknameOf, viewersOf } from '../../core/room-state'
import {
  CaptureFailedError,
  mediaManager,
  TransmissionInProgressError
} from '../../services/media-manager'
import { session } from '../../services/session'
import { TOAST_TTL_LONG_MS, useAppStore } from '../../store/app-store'
import { refreshLocalTransmission, selectTransmission, useRoomStore } from '../../store/room-store'
import { Button, IconButton } from '../components/Button'
import { Modal } from '../components/Modal'
import { ParticipantCard } from '../components/ParticipantCard'
import { SettingsModal } from '../components/SettingsModal'
import { SourcePickerModal, type SourceChoice } from '../components/SourcePickerModal'
import { StreamThumbnail } from '../components/StreamThumbnail'
import { TransmissionStatusCard } from '../components/TransmissionStatusCard'
import { TransmittingBar } from '../components/TransmittingBar'
import { BroadcastIcon, CheckIcon, CopyIcon, GearIcon, LogoutIcon } from '../components/icons'
import { copyText } from '../clipboard'
import { AUDIO_CAPTURE_COPY } from './audio-copy'
import { PlayerView } from './PlayerView'

/** Corrida de render: um membro fora do mapa ainda desenha, com o slot 0. */
const FALLBACK_PERSON_COLOR = colorOfSlot(0)

export function RoomScreen(): JSX.Element {
  const room = useRoomStore((state) => state.room)
  const streams = useRoomStore((state) => state.streams)
  const mediaFailures = useRoomStore((state) => state.mediaFailures)
  const inboundVideoStats = useRoomStore((state) => state.inboundVideoStats)
  const localTx = useRoomStore((state) => state.localTx)
  const qualityTick = useRoomStore((state) => state.qualityTick)
  const selectedTxId = useRoomStore((state) => state.selectedTxId)
  const doorHealth = useRoomStore((state) => state.health.door)
  const setRoute = useAppStore((state) => state.setRoute)
  const pushToast = useAppStore((state) => state.pushToast)

  const [copied, setCopied] = useState(false)
  const [picker, setPicker] = useState<'closed' | 'start' | 'switch'>('closed')
  const [pickerBusy, setPickerBusy] = useState(false)
  const [banTarget, setBanTarget] = useState<{ peerId: string; nickname: string } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Modo nitidez: escopo da transmissao ATUAL. O backend tambem zera o estado a
  // cada `startTransmission`, entao as duas pontas precisam concordar. O txId
  // fica GUARDADO junto do valor em vez de um efeito que zera por mudanca de
  // transmissao: assim uma transmissao nova ja nasce desligada na renderizacao,
  // sem o render intermediario (e a regra de lint) de um setState em efeito.
  const [sharpnessOfTx, setSharpnessOfTx] = useState<{ txId: string; on: boolean } | null>(null)
  // Ponteiros dos espectadores: mesmo escopo e mesmo molde do modo nitidez. O
  // txId fica GUARDADO junto do valor para uma transmissao nova ja nascer
  // desligada na renderizacao, sem um setState em efeito.
  const [pointersOfTx, setPointersOfTx] = useState<{ txId: string; on: boolean } | null>(null)

  const iAmOwner = computeIsOwner(room)
  const code = room.roomMeta?.code ?? ''
  // Porta fechada = ninguem novo entra, por mais saudavel que a sala pareca.
  const doorClosed = iAmOwner && doorHealth !== 'open' && doorHealth !== 'closed'
  const transmissions = useMemo(() => Object.values(room.transmissions), [room.transmissions])

  /** peerId -> nickname de quem ele esta assistindo (RF-37/AC-21). */
  const watchingLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const [peerId, txId] of Object.entries(room.watching)) {
      if (!txId) continue
      const transmission = room.transmissions[txId]
      if (!transmission) continue
      const author = room.members.find((member) => member.peerId === transmission.peerId)
      if (author) labels[peerId] = author.nickname
    }
    return labels
  }, [room.watching, room.transmissions, room.members])

  /**
   * Cores PRONTAS por pessoa (RF-21/RF-22). Memoizar so os slots e chamar
   * `colorOfSlot` dentro do `map` do JSX criaria um objeto novo a cada render e
   * anularia o `memo` do `ParticipantCard`, re-renderizando a lista inteira.
   */
  const personColors = useMemo(() => {
    const slots = resolvePersonSlots(room.members)
    const out: Record<string, PersonColor> = {}
    for (const member of room.members) out[member.peerId] = colorOfSlot(slots[member.peerId] ?? 0)
    return out
  }, [room.members])

  const selected = selectedTxId === null ? null : (room.transmissions[selectedTxId] ?? null)
  /**
   * Terceira camada do bloqueio (RF-09): mesmo que uma selecao legada aponte
   * para a propria transmissao, o player nunca monta com ela.
   */
  const isSelfSelected = selected !== null && selected.peerId === room.selfPeerId

  /** Espectadores da propria transmissao agora (RF-11), do mesmo dado do roster. */
  const viewerCount = useMemo(() => (localTx ? viewersOf(room, localTx.txId) : 0), [room, localTx])
  /**
   * O `localTx` e a fonte mais fresca (o roster pode demorar um tique), mas no
   * primeiro render depois do start o roster ja pode ter chegado antes: o
   * fallback pelo estado da transmissao cobre os dois lados da corrida.
   */
  const ownSourceLabel = (fallback: string): string => localTx?.sourceLabel ?? fallback
  const ownHasAudio = (fallback: boolean): boolean => localTx?.hasAudio ?? fallback

  /**
   * Avisos de degradacao em RUNTIME (RF-08): o motor de audio pode cair no meio
   * da transmissao e o main degrada por baixo. O usuario nunca fica sem saber,
   * mas tambem nao leva o mesmo aviso duas vezes: o conjunto e por transmissao
   * (o efeito remonta quando o txId muda).
   */
  const excludedTxId = localTx?.audioMode === 'excluded' ? localTx.txId : null
  useEffect(() => {
    if (!excludedTxId) return undefined
    const alreadyWarned = new Set<string>()
    return window.zoi.audioExclusion.onStatus((status) => {
      // Sem nome de aplicativo nao ha aviso a dar, e a chave NAO pode ser
      // consumida: quem faz o aviso funcionar e a reemissao seguinte, que vem
      // com o nome preenchido (3/T10).
      if (status.state === 'app-not-captured' && !status.app) return
      if (alreadyWarned.has(status.state)) return
      alreadyWarned.add(status.state)
      if (status.state === 'degraded-full-loopback') {
        pushToast('warning', AUDIO_CAPTURE_COPY.degradedRuntime)
      } else if (status.state === 'failed') {
        pushToast('warning', AUDIO_CAPTURE_COPY.failedRuntime)
      } else if (status.state === 'app-not-captured' && status.app) {
        // O `&& status.app` nao muda comportamento (o descarte acima ja
        // devolveu quando o nome vem vazio): ele so ESTREITA o tipo de
        // `string | null` para `string` neste ramo.
        pushToast('warning', AUDIO_CAPTURE_COPY.appNotCaptured(status.app))
      }
    })
  }, [excludedTxId, pushToast])

  const localTxId = localTx?.txId ?? null
  // Vale so para a transmissao que esta no ar: qualquer txId novo le desligado.
  const sharpness = sharpnessOfTx !== null && sharpnessOfTx.txId === localTxId && sharpnessOfTx.on
  const pointers = pointersOfTx !== null && pointersOfTx.txId === localTxId && pointersOfTx.on

  const changeSharpness = useCallback(
    (next: boolean): void => {
      if (!localTxId) return
      setSharpnessOfTx({ txId: localTxId, on: next })
      try {
        mediaManager.setSharpnessMode(next)
      } catch {
        // O contrato diz que este caminho nao lanca; se lancar, o usuario fica
        // sabendo em vez de olhar um toggle que nao significa nada.
        pushToast('warning', 'Nao foi possivel mudar o modo nitidez agora.')
      }
    },
    [localTxId, pushToast]
  )

  /**
   * Molde do `changeSharpness`, so que `async`: o `setPointersMode` precisa
   * subir (ou derrubar) a janela de overlay antes de responder, e devolve
   * `false` quando o `show` falha. Nunca deixar o switch ligado com o overlay
   * caido: o retorno manda no controle.
   */
  const changePointers = useCallback(
    async (next: boolean): Promise<void> => {
      if (!localTxId) return
      const ok = await mediaManager.setPointersMode(next)
      if (ok) {
        setPointersOfTx({ txId: localTxId, on: next })
        return
      }
      setPointersOfTx({ txId: localTxId, on: false })
      pushToast('warning', 'Nao foi possivel abrir a camada de ponteiros agora.')
    },
    [localTxId, pushToast]
  )

  const transmittingPeers = useMemo(
    () => new Set(transmissions.map((transmission) => transmission.peerId)),
    [transmissions]
  )

  const copy = async (): Promise<void> => {
    const ok = await copyText(code)
    if (!ok) {
      pushToast('warning', 'Nao consegui copiar; selecione o codigo e use Ctrl+C.')
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1_600)
  }

  const leave = (): void => {
    session.leaveRoom()
    setRoute('home')
    // O LEAVE precisa sair pelo mesh antes de destruir os peers.
    setTimeout(() => session.reset(), 800)
  }

  const startTransmission = async (choice: SourceChoice): Promise<void> => {
    setPickerBusy(true)
    try {
      const transmission =
        picker === 'switch'
          ? await mediaManager.switchSource(choice)
          : await mediaManager.startTransmission(choice)
      refreshLocalTransmission()
      setPicker('closed')
      // O switch da barra ja nasce coerente com o do modal (caminho da F1.1).
      setPointersOfTx({ txId: transmission.txId, on: transmission.pointers })
      if (choice.withAudio && !transmission.hasAudio) {
        pushToast('warning', AUDIO_CAPTURE_COPY.noAudio)
      } else if (transmission.audioMode === 'full-loopback') {
        // Vazar a propria conversa para a sala inteira e mais grave que "a
        // fonte nao pode ser capturada": tom `danger` e tempo de LER as duas
        // frases, nao so de notar o aviso (RF-15).
        pushToast('danger', AUDIO_CAPTURE_COPY.fullLoopbackStart, TOAST_TTL_LONG_MS)
      }
      // O `startTransmission` ja resolveu o `setPointersMode`, entao este valor
      // e final: pediu ponteiros e nao veio = o overlay nao subiu (B3.2).
      if (choice.pointers && !transmission.pointers) {
        pushToast(
          'warning',
          'Nao foi possivel abrir a camada de ponteiros; a transmissao segue sem eles.'
        )
      }
    } catch (error) {
      if (error instanceof TransmissionInProgressError) {
        pushToast('warning', error.message)
        setPicker('closed')
      } else if (error instanceof CaptureFailedError) {
        pushToast('danger', 'Nao foi possivel capturar essa fonte. Escolha outra e tente de novo.')
      } else {
        pushToast('danger', 'Nao foi possivel iniciar a transmissao.')
      }
      refreshLocalTransmission()
    } finally {
      setPickerBusy(false)
    }
  }

  const stopTransmission = (): void => {
    mediaManager.stopTransmission('manual')
    refreshLocalTransmission()
  }

  const onKick = useCallback((peerId: string) => session.kick(peerId), [])
  const onBan = useCallback(
    (peerId: string) => {
      const target = room.members.find((member) => member.peerId === peerId)
      setBanTarget({ peerId, nickname: target?.nickname ?? 'essa pessoa' })
    },
    [room.members]
  )

  return (
    <div className="z-room z-room-enter">
      {localTx ? (
        <TransmittingBar
          sourceLabel={localTx.sourceLabel}
          presetLabel={PRESETS[localTx.presetId].label}
          hasAudio={localTx.hasAudio}
          sharpness={sharpness}
          onSharpnessChange={changeSharpness}
          pointers={pointers}
          pointersDisabled={localTx.sourceKind === 'window'}
          onPointersChange={(next) => void changePointers(next)}
          onSwitch={() => setPicker('switch')}
          onStop={stopTransmission}
        />
      ) : null}

      <div className="z-room__topbar">
        <span className="z-secondary">Sala</span>
        <span className="z-room__code">
          <span className="z-room__code-value" data-testid="room-code">
            {code}
          </span>
          <IconButton label="Copiar codigo da sala" onClick={() => void copy()}>
            {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
          </IconButton>
        </span>
        {copied ? <span className="z-badge z-badge--success">codigo copiado</span> : null}
        {doorClosed ? (
          <span
            className="z-badge z-badge--warning"
            title="A sala continua funcionando para quem ja esta dentro, mas o codigo nao encontra a sala ate a porta voltar."
            data-testid="door-warning"
          >
            reabrindo a porta da sala...
          </span>
        ) : null}

        <span className="z-room__spacer" />

        {localTx ? null : (
          <Button
            variant="primary"
            icon={<BroadcastIcon size={16} />}
            onClick={() => setPicker('start')}
            data-testid="transmit-button"
          >
            Transmitir
          </Button>
        )}
        <Button variant="danger" icon={<LogoutIcon />} onClick={leave} data-testid="leave-room">
          Sair
        </Button>
      </div>

      <div className="z-room__body">
        <aside className="z-room__aside">
          <div className="z-room__aside-title">
            <span>Participantes</span>
            <span className="z-tabular">
              {room.members.length}/{room.roomMeta?.limit ?? 0}
            </span>
          </div>
          {room.members.map((member, index) => (
            <div
              key={member.peerId}
              className="z-item-enter"
              style={{ '--z-delay': `${Math.min(index, 8) * 45}ms` } as CSSProperties}
            >
              <ParticipantCard
                peerId={member.peerId}
                nickname={member.nickname}
                isSelf={member.peerId === room.selfPeerId}
                isOwner={member.isOwner}
                color={personColors[member.peerId] ?? FALLBACK_PERSON_COLOR}
                canModerate={iAmOwner}
                transmitting={transmittingPeers.has(member.peerId)}
                watchingLabel={watchingLabels[member.peerId] ?? null}
                quality={room.quality[member.peerId]}
                qualityTick={qualityTick}
                linkStatus={room.peerLinks[member.peerId]?.status}
                onKick={onKick}
                onBan={onBan}
              />
            </div>
          ))}
          {/* Rodape da sidebar: a engrenagem mora no canto de baixo, longe dos
              botoes de acao da barra do topo. */}
          <div className="z-room__aside-footer">
            <IconButton
              label="Configuracoes"
              onClick={() => setSettingsOpen(true)}
              data-testid="open-settings"
            >
              <GearIcon />
            </IconButton>
          </div>
        </aside>

        <main className="z-room__main">
          {selected && isSelfSelected ? (
            <TransmissionStatusCard
              key={selected.txId}
              txId={selected.txId}
              sourceLabel={ownSourceLabel(selected.sourceLabel)}
              hasAudio={ownHasAudio(selected.hasAudio)}
              viewerCount={viewerCount}
              variant="tile"
            />
          ) : selected ? (
            <>
              <PlayerView
                key={selected.txId}
                txId={selected.txId}
                stream={streams.get(selected.txId) ?? null}
                nickname={nicknameOf(room, selected.peerId)}
                presetLabel={PRESETS[selected.presetId].label}
                hasAudio={selected.hasAudio}
                reconnecting={selected.status === 'reconnecting'}
                failed={mediaFailures.has(selected.txId)}
                quality={room.quality[selected.peerId]}
                qualityTick={qualityTick}
                videoStats={inboundVideoStats.get(selected.txId)}
                pointersEnabled={selected.pointersEnabled}
                members={room.members}
                selfPeerId={room.selfPeerId}
                onBack={() => selectTransmission(null)}
              />
              {transmissions.length > 1 ? (
                <div className="z-strip">
                  {transmissions
                    .filter((transmission) => transmission.txId !== selected.txId)
                    .map((transmission) => (
                      <div className="z-strip__item" key={transmission.txId}>
                        {transmission.peerId === room.selfPeerId ? (
                          <TransmissionStatusCard
                            txId={transmission.txId}
                            sourceLabel={ownSourceLabel(transmission.sourceLabel)}
                            hasAudio={ownHasAudio(transmission.hasAudio)}
                            viewerCount={viewerCount}
                            variant="strip"
                          />
                        ) : (
                          <StreamThumbnail
                            txId={transmission.txId}
                            stream={streams.get(transmission.txId) ?? null}
                            nickname={nicknameOf(room, transmission.peerId)}
                            presetLabel={PRESETS[transmission.presetId].label}
                            hasAudio={transmission.hasAudio}
                            isSelf={false}
                            watching={false}
                            reconnecting={transmission.status === 'reconnecting'}
                            failed={mediaFailures.has(transmission.txId)}
                            onSelect={selectTransmission}
                          />
                        )}
                      </div>
                    ))}
                </div>
              ) : null}
            </>
          ) : transmissions.length === 0 ? (
            <div className="z-empty">
              <span className="z-empty__icon">
                <BroadcastIcon size={26} />
              </span>
              <span className="z-empty__title">Ninguem esta transmitindo ainda</span>
              <span className="z-empty__text">
                Clique em Transmitir para mostrar um monitor ou uma janela para a galera. Quando
                alguem comecar, a transmissao aparece aqui.
              </span>
            </div>
          ) : (
            <div className="z-grid">
              {transmissions.map((transmission, index) => (
                <div
                  key={transmission.txId}
                  className="z-item-enter"
                  style={{ '--z-delay': `${Math.min(index, 8) * 50}ms` } as CSSProperties}
                >
                  {transmission.peerId === room.selfPeerId ? (
                    <TransmissionStatusCard
                      txId={transmission.txId}
                      sourceLabel={ownSourceLabel(transmission.sourceLabel)}
                      hasAudio={ownHasAudio(transmission.hasAudio)}
                      viewerCount={viewerCount}
                      variant="tile"
                    />
                  ) : (
                    <StreamThumbnail
                      txId={transmission.txId}
                      stream={streams.get(transmission.txId) ?? null}
                      nickname={
                        room.members.find((member) => member.peerId === transmission.peerId)
                          ?.nickname ?? 'alguem'
                      }
                      presetLabel={PRESETS[transmission.presetId].label}
                      hasAudio={transmission.hasAudio}
                      isSelf={false}
                      watching={selectedTxId === transmission.txId}
                      reconnecting={transmission.status === 'reconnecting'}
                      failed={mediaFailures.has(transmission.txId)}
                      onSelect={selectTransmission}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <SourcePickerModal
        open={picker !== 'closed'}
        mode={picker === 'switch' ? 'switch' : 'start'}
        busy={pickerBusy}
        onClose={() => setPicker('closed')}
        onConfirm={(choice) => void startTransmission(choice)}
      />

      <Modal
        open={banTarget !== null}
        title="Banir da sala?"
        subtitle={`${banTarget?.nickname ?? ''} sai agora e nao consegue mais entrar nesta sala.`}
        onClose={() => setBanTarget(null)}
        footer={
          <>
            <Button onClick={() => setBanTarget(null)}>Cancelar</Button>
            <Button
              variant="danger"
              data-testid="confirm-ban"
              onClick={() => {
                if (banTarget) session.ban(banTarget.peerId)
                setBanTarget(null)
              }}
            >
              Banir
            </Button>
          </>
        }
      >
        <p className="z-secondary" style={{ marginTop: 0 }}>
          O banimento vale enquanto a sala existir. Para so tirar da sala agora, use desconectar.
        </p>
      </Modal>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
