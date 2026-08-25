// Telas terminais (RF-31/RF-33/RF-40): o motivo vem de `endReason` do reducer.
import type { EndReason } from '../../core/room-state'
import { session } from '../../services/session'
import { useAppStore } from '../../store/app-store'
import { useRoomStore } from '../../store/room-store'
import { Button } from '../components/Button'
import { BanIcon } from '../components/icons'

const TEXTS: Record<EndReason, { title: string; text: string }> = {
  kicked: {
    title: 'Voce foi desconectado',
    text: 'O dono da sala te desconectou. Se quiser, e so entrar de novo com o mesmo codigo.'
  },
  banned: {
    title: 'Voce foi banido desta sala',
    text: 'O dono baniu voce. Novas tentativas de entrar nesta sala serao recusadas.'
  },
  connection_lost: {
    title: 'Voce perdeu a conexao com a sala',
    text: 'A sala pode ter sido encerrada ou a sua conexao caiu. Tente entrar de novo pelo codigo.'
  },
  left: {
    title: 'Voce saiu da sala',
    text: 'Ate a proxima.'
  }
}

export function EndedScreen(): JSX.Element {
  const endReason = useRoomStore((state) => state.room.endReason)
  const setRoute = useAppStore((state) => state.setRoute)
  const copy = TEXTS[endReason ?? 'connection_lost']

  return (
    <div className="z-shell">
      <div className="z-shell__center z-screen-enter">
        <div className="z-panel z-ended">
          <span className="z-ended__icon">
            <BanIcon size={26} />
          </span>
          <h2 className="z-ended__title">{copy.title}</h2>
          <p className="z-ended__text">{copy.text}</p>
          <Button
            variant="primary"
            size="lg"
            onClick={() => {
              session.reset()
              setRoute('home')
            }}
          >
            Voltar para o inicio
          </Button>
        </div>
      </div>
    </div>
  )
}
