// Barras de conexao (RF-38/AC-22): 3 barrinhas alimentadas por QUALITY_UPDATE.
// Componente folha e memoizado: amostra nova NAO re-renderiza card nem video.
import { memo } from 'react'
import { QUALITY_STALE_MS } from '@shared/config'
import type { QualitySample } from '../../core/room-state'

export interface ConnectionBarsProps {
  sample: QualitySample | undefined
  /** Tique lento da store; so serve para reavaliar a validade da amostra. */
  tick: number
}

const LEVEL_LABEL = {
  good: 'conexao boa',
  medium: 'conexao media',
  bad: 'conexao ruim'
} as const

export const ConnectionBars = memo(function ConnectionBars({
  sample
}: ConnectionBarsProps): JSX.Element {
  const stale = !sample || Date.now() - sample.receivedAt > QUALITY_STALE_MS
  const level = stale ? null : sample.level
  const title = stale
    ? 'sem dados de conexao'
    : `${LEVEL_LABEL[sample.level]} (${Math.round(sample.rttMs)} ms${
        sample.inboundBitrateKbps === null
          ? ''
          : `, ${Math.round(sample.inboundBitrateKbps)} kbps`
      })`

  return (
    <span className={level ? `z-bars z-bars--${level}` : 'z-bars'} title={title} aria-label={title}>
      <span className="z-bars__bar" />
      <span className="z-bars__bar" />
      <span className="z-bars__bar" />
    </span>
  )
})
