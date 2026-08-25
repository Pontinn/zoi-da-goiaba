// Tela 4 do UISPEC (Sala): barra de transmissao, sidebar de participantes com
// badges, grade de miniaturas ao vivo, fluxo de transmitir e moderacao do dono.
import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import { PRESETS } from '@shared/presets'
import { isOwner as computeIsOwner, nicknameOf } from '../../core/room-state'
import {
  CaptureFailedError,
  mediaManager,
  TransmissionInProgressError
} from '../../services/media-manager'
import { session } from '../../services/session'
import { useAppStore } from '../../store/app-store'
import { refreshLocalTransmission, selectTransmission, useRoomStore } from '../../store/room-store'
import { Button, IconButton } from '../components/Button'
import { Modal } from '../components/Modal'
import { ParticipantCard } from '../components/ParticipantCard'
import { SettingsModal } from '../components/SettingsModal'
import { SourcePickerModal, type SourceChoice } from '../components/SourcePickerModal'
import { StreamThumbnail } from '../components/StreamThumbnail'
import { TransmittingBar } from '../components/TransmittingBar'
import {
  BroadcastIcon,
  CheckIcon,
  CopyIcon,
  GearIcon,
  LogoutIcon
} from '../components/icons'
import { copyText } from '../clipboard'
import { PlayerView } from './PlayerView'

export function RoomScreen(): JSX.Element {
  const room = useRoomStore((state) => state.room)
  const streams = useRoomStore((state) => state.streams)
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

  const selected = selectedTxId === null ? null : (room.transmissions[selectedTxId] ?? null)

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
      if (choice.withAudio && !transmission.hasAudio) {
        pushToast(
          'warning',
          'Nao foi possivel capturar o audio do sistema; a transmissao segue so com video.'
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
        <IconButton label="Configuracoes" onClick={() => setSettingsOpen(true)}>
          <GearIcon />
        </IconButton>
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
        </aside>

        <main className="z-room__main">
          {selected ? (
            <>
              <PlayerView
                key={selected.txId}
                txId={selected.txId}
                stream={streams.get(selected.txId) ?? null}
                nickname={nicknameOf(room, selected.peerId)}
                presetLabel={PRESETS[selected.presetId].label}
                hasAudio={selected.hasAudio}
                reconnecting={selected.status === 'reconnecting'}
                quality={room.quality[selected.peerId]}
                qualityTick={qualityTick}
                onBack={() => selectTransmission(null)}
              />
              {transmissions.length > 1 ? (
                <div className="z-strip">
                  {transmissions
                    .filter((transmission) => transmission.txId !== selected.txId)
                    .map((transmission) => (
                      <div className="z-strip__item" key={transmission.txId}>
                        <StreamThumbnail
                          txId={transmission.txId}
                          stream={streams.get(transmission.txId) ?? null}
                          nickname={nicknameOf(room, transmission.peerId)}
                          presetLabel={PRESETS[transmission.presetId].label}
                          hasAudio={transmission.hasAudio}
                          isSelf={transmission.peerId === room.selfPeerId}
                          watching={false}
                          reconnecting={transmission.status === 'reconnecting'}
                          onSelect={selectTransmission}
                        />
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
                  <StreamThumbnail
                    txId={transmission.txId}
                    stream={streams.get(transmission.txId) ?? null}
                    nickname={
                      room.members.find((member) => member.peerId === transmission.peerId)
                        ?.nickname ?? 'alguem'
                    }
                    presetLabel={PRESETS[transmission.presetId].label}
                    hasAudio={transmission.hasAudio}
                    isSelf={transmission.peerId === room.selfPeerId}
                    watching={selectedTxId === transmission.txId}
                    reconnecting={transmission.status === 'reconnecting'}
                    onSelect={selectTransmission}
                  />
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
