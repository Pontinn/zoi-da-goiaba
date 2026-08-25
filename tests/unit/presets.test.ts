import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESET_ID, PRESET_LIST, PRESETS } from '@shared/presets'
import { isTxStartPayload, type PresetId } from '@shared/protocol'

describe('presets / tabela de qualidade', () => {
  it('mantem os 3 presets originais da SPEC intactos', () => {
    expect(PRESETS.p720_30).toEqual({
      id: 'p720_30',
      label: '720p30',
      width: 1280,
      height: 720,
      frameRate: 30,
      maxBitrate: 2_500_000
    })
    expect(PRESETS.p1080_30).toEqual({
      id: 'p1080_30',
      label: '1080p30',
      width: 1920,
      height: 1080,
      frameRate: 30,
      maxBitrate: 4_000_000
    })
    expect(PRESETS.p1080_60).toEqual({
      id: 'p1080_60',
      label: '1080p60',
      width: 1920,
      height: 1080,
      frameRate: 60,
      maxBitrate: 6_000_000
    })
  })

  it('adiciona os presets de alta qualidade', () => {
    expect(PRESETS.p1080_30_hq).toEqual({
      id: 'p1080_30_hq',
      label: '1080p30 alta',
      width: 1920,
      height: 1080,
      frameRate: 30,
      maxBitrate: 8_000_000
    })
    expect(PRESETS.p1080_60_hq).toEqual({
      id: 'p1080_60_hq',
      label: '1080p60 alta',
      width: 1920,
      height: 1080,
      frameRate: 60,
      maxBitrate: 12_000_000
    })
  })

  it('o preset "alta" so mexe no teto de bitrate do irmao normal', () => {
    for (const [normal, hq] of [
      [PRESETS.p1080_30, PRESETS.p1080_30_hq],
      [PRESETS.p1080_60, PRESETS.p1080_60_hq]
    ] as const) {
      expect(hq.width).toBe(normal.width)
      expect(hq.height).toBe(normal.height)
      expect(hq.frameRate).toBe(normal.frameRate)
      expect(hq.maxBitrate).toBeGreaterThan(normal.maxBitrate)
    }
  })

  it('lista o seletor na ordem do mais leve para o mais pesado', () => {
    expect(PRESET_LIST.map((preset) => preset.id)).toEqual([
      'p720_30',
      'p1080_30',
      'p1080_30_hq',
      'p1080_60',
      'p1080_60_hq'
    ])
  })

  it('o padrao continua sendo 1080p30', () => {
    expect(DEFAULT_PRESET_ID).toBe('p1080_30')
    expect(PRESETS[DEFAULT_PRESET_ID].label).toBe('1080p30')
  })

  it('cada entrada de PRESETS tem id e rotulo coerentes e unicos', () => {
    const ids = Object.keys(PRESETS) as PresetId[]
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(ids.map((id) => PRESETS[id].label)).size).toBe(ids.length)
    for (const id of ids) {
      expect(PRESETS[id].id).toBe(id)
    }
    // PRESET_LIST cobre a tabela inteira: nada de preset "escondido" do seletor.
    expect(PRESET_LIST).toHaveLength(ids.length)
  })

  it('todo preset do seletor passa na validacao do protocolo', () => {
    for (const preset of PRESET_LIST) {
      const payload = {
        txId: 't1',
        presetId: preset.id,
        hasAudio: true,
        sourceKind: 'screen',
        sourceLabel: 'Tela 1',
        startedAt: 1
      }
      expect(isTxStartPayload(payload), preset.id).toBe(true)
    }
  })
})
