// Logomarca do app (UISPEC secao 2b): `logo-goiaba.png` sem esticar e sem
// recolorir; proporcao preservada por `height` + `width: auto`.
import logoGoiaba from '../../assets/brand/logo-goiaba.png'

export interface BrandProps {
  size?: 'lg' | 'sm'
  withName?: boolean
}

export function Brand({ size = 'lg', withName = true }: BrandProps): JSX.Element {
  return (
    <div className={`z-brand z-brand--${size}`}>
      <img className="z-brand__mark" src={logoGoiaba} alt="Zói da Goiaba" draggable={false} />
      {withName ? <h1 className="z-brand__name">Zói da Goiaba</h1> : null}
    </div>
  )
}

/** Marca discreta em canto de interface (UISPEC secao 2b). */
export function BrandCorner(): JSX.Element {
  return <img className="z-brand-corner" src={logoGoiaba} alt="" aria-hidden="true" />
}
