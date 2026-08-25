// Tela 2 do UISPEC: home com duas acoes grandes e engrenagem de configuracoes.
import { useState } from 'react'
import { useAppStore } from '../../store/app-store'
import { Brand, BrandCorner } from '../components/Brand'
import { IconButton } from '../components/Button'
import { GearIcon, KeyIcon, PlusIcon } from '../components/icons'
import { SettingsModal } from '../components/SettingsModal'

export function HomeScreen(): JSX.Element {
  const nickname = useAppStore((state) => state.nickname)
  const version = useAppStore((state) => state.version)
  const setRoute = useAppStore((state) => state.setRoute)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="z-shell">
      <div className="z-shell__topbar">
        <Brand size="sm" />
        <div className="z-home__who">
          <span>
            voce e <strong>{nickname}</strong>
          </span>
          <IconButton label="Configuracoes" onClick={() => setSettingsOpen(true)}>
            <GearIcon />
          </IconButton>
        </div>
      </div>

      <div className="z-shell__center z-screen-enter">
        <div className="z-panel z-panel--wide">
          <div className="z-panel__head">
            <h2 className="z-panel__title">O que vamos fazer hoje?</h2>
            <p className="z-panel__lead">
              Crie uma sala e chame a galera, ou entre em uma sala com o codigo que te passaram.
            </p>
          </div>

          <div className="z-home__actions">
            <button className="z-action" onClick={() => setRoute('create')}>
              <span className="z-action__icon">
                <PlusIcon size={22} />
              </span>
              <span className="z-action__title">Criar sala</span>
              <span className="z-action__desc">
                Voce vira o dono, escolhe o codigo e quantas pessoas cabem.
              </span>
            </button>

            <button className="z-action" onClick={() => setRoute('join')}>
              <span className="z-action__icon">
                <KeyIcon size={22} />
              </span>
              <span className="z-action__title">Entrar com codigo</span>
              <span className="z-action__desc">
                Digite o codigo da sala do seu amigo e entre na hora.
              </span>
            </button>
          </div>

          <p className="z-field__hint z-tabular">{version ? `Zói da Goiaba v${version}` : ''}</p>
        </div>
      </div>

      <BrandCorner />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
