// Presets de qualidade da transmissao (RF-16, tabela da SPEC secao 2.6).
// Nenhuma logica de adaptacao propria: o preset define o TETO e a engine WebRTC
// cuida da degradacao sob rede ruim (RF-47/RNF-11).
import type { PresetId } from './protocol'

export interface QualityPreset {
  id: PresetId
  /** Rotulo curto para badge do player, ex "1080p30". */
  label: string
  width: number
  height: number
  frameRate: number
  /** Teto de bitrate de VIDEO, identico para todos os receivers (RF-24). */
  maxBitrate: number
}

export const PRESETS: Record<PresetId, QualityPreset> = {
  p720_30: {
    id: 'p720_30',
    label: '720p30',
    width: 1280,
    height: 720,
    frameRate: 30,
    maxBitrate: 2_500_000
  },
  p1080_30: {
    id: 'p1080_30',
    label: '1080p30',
    width: 1920,
    height: 1080,
    frameRate: 30,
    maxBitrate: 4_000_000
  },
  p1080_60: {
    id: 'p1080_60',
    label: '1080p60',
    width: 1920,
    height: 1080,
    frameRate: 60,
    maxBitrate: 6_000_000
  }
}

export const PRESET_LIST: readonly QualityPreset[] = [
  PRESETS.p720_30,
  PRESETS.p1080_30,
  PRESETS.p1080_60
]

export const DEFAULT_PRESET_ID: PresetId = 'p1080_30'
