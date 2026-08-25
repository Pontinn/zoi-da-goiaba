// Tela 2 do UISPEC: home. Atmosfera com nevoa roxa lenta, heroi da goiaba com
// parallax de mouse, saudacao personalizada e as duas acoes grandes.
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import logoGoiaba from '../../assets/brand/logo-goiaba.png'
import { useAppStore } from '../../store/app-store'
import { Brand } from '../components/Brand'
import { Button, IconButton } from '../components/Button'
import { GearIcon, GoIcon, KeyIcon, PlusIcon } from '../components/icons'
import { SettingsModal } from '../components/SettingsModal'
import { readLastRoom } from '../last-room'
import { pickGreeting, pickTagline } from '../taglines'

/** Realce radial que segue o cursor dentro do card (custom properties). */
function trackPointer(event: MouseEvent<HTMLElement>): void {
  const target = event.currentTarget
  const bounds = target.getBoundingClientRect()
  target.style.setProperty('--mx', `${event.clientX - bounds.left}px`)
  target.style.setProperty('--my', `${event.clientY - bounds.top}px`)
}

export function HomeScreen(): JSX.Element {
  const nickname = useAppStore((state) => state.nickname)
  const version = useAppStore((state) => state.version)
  const setRoute = useAppStore((state) => state.setRoute)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Sorteadas uma vez por montagem da tela (uma por abertura do app).
  const [greeting] = useState(() => pickGreeting())
  const [tagline] = useState(() => pickTagline())
  const [lastRoom] = useState(() => readLastRoom())

  const artRef = useRef<HTMLImageElement>(null)
  const watermarkRef = useRef<HTMLImageElement>(null)

  // Parallax do heroi: so `transform`, com amortecimento, sem re-render e sem
  // laco ocioso (o rAF para quando a marca alcanca o alvo).
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const target = { x: 0, y: 0 }
    const current = { x: 0, y: 0 }
    let frame: number | null = null

    function step(): void {
      const element = artRef.current
      if (!element) {
        frame = null
        return
      }
      current.x += (target.x - current.x) * 0.08
      current.y += (target.y - current.y) * 0.08
      element.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0) rotate(${(current.x * 0.1).toFixed(2)}deg)`
      // A marca dagua de fundo acompanha com uma fracao do deslocamento.
      const watermark = watermarkRef.current
      if (watermark) {
        watermark.style.transform = `translate3d(${(current.x * 0.22).toFixed(2)}px, ${(current.y * 0.22).toFixed(2)}px, 0)`
      }
      frame =
        Math.abs(target.x - current.x) > 0.1 || Math.abs(target.y - current.y) > 0.1
          ? requestAnimationFrame(step)
          : null
    }

    const onMove = (event: globalThis.MouseEvent): void => {
      target.x = (event.clientX / window.innerWidth - 0.5) * 22
      target.y = (event.clientY / window.innerHeight - 0.5) * 16
      if (frame === null) frame = requestAnimationFrame(step)
    }

    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className="z-shell z-home">
      <div className="z-atmos" aria-hidden="true">
        <span className="z-atmos__glow" />
        <span className="z-atmos__blob z-atmos__blob--1" />
        <span className="z-atmos__blob z-atmos__blob--2" />
        <span className="z-atmos__blob z-atmos__blob--3" />
        <img
          className="z-atmos__watermark"
          ref={watermarkRef}
          src={logoGoiaba}
          alt=""
          draggable={false}
        />
        <span className="z-atmos__vignette" />
      </div>

      <div className="z-shell__topbar z-fade-enter">
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
          <div className="z-hero">
            <div className="z-hero__text">
              <h2 className="z-hero__greeting" data-testid="greeting">
                {greeting.before}
                <span className="z-hero__name">{nickname}</span>
                {greeting.after}
              </h2>
              <p className="z-hero__tagline">{tagline}</p>
            </div>
            <div className="z-hero__art z-logo-enter">
              <span className="z-hero__halo" />
              <img
                className="z-hero__goiaba"
                ref={artRef}
                src={logoGoiaba}
                alt=""
                draggable={false}
              />
            </div>
          </div>

          <div className="z-home__actions">
            <button
              className="z-action z-item-enter"
              style={{ '--z-delay': '60ms' } as CSSProperties}
              onMouseMove={trackPointer}
              onClick={() => setRoute('create')}
            >
              <span className="z-action__ring" aria-hidden="true" />
              <span className="z-action__inner">
                <span className="z-action__glow" aria-hidden="true" />
                <span className="z-action__icon">
                  <PlusIcon size={22} />
                </span>
                <span className="z-action__title">Criar sala</span>
                <span className="z-action__desc">
                  Voce vira o dono, escolhe o codigo e quantas pessoas cabem.
                </span>
              </span>
            </button>

            <button
              className="z-action z-item-enter"
              style={{ '--z-delay': '120ms' } as CSSProperties}
              onMouseMove={trackPointer}
              onClick={() => setRoute('join')}
            >
              <span className="z-action__ring" aria-hidden="true" />
              <span className="z-action__inner">
                <span className="z-action__glow" aria-hidden="true" />
                <span className="z-action__icon">
                  <KeyIcon size={22} />
                </span>
                <span className="z-action__title">Entrar com codigo</span>
                <span className="z-action__desc">
                  Digite o codigo da sala do seu amigo e entre na hora.
                </span>
              </span>
            </button>
          </div>

          <div className="z-home__foot">
            {lastRoom ? (
              <span className="z-chip z-item-enter" style={{ '--z-delay': '180ms' } as CSSProperties}>
                <span className="z-muted">ultima sala:</span>
                <span className="z-tabular">{lastRoom}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<GoIcon size={14} />}
                  onClick={() => {
                    useAppStore.getState().setPrefillCode(lastRoom)
                    setRoute('join')
                  }}
                  data-testid="rejoin-last"
                >
                  entrar de novo
                </Button>
              </span>
            ) : (
              <span />
            )}
            <span className="z-field__hint z-tabular">{version ? `v${version}` : ''}</span>
          </div>
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
