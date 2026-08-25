// Superficie N-API consumida SOMENTE pelo worker de captura (utilityProcess).

export interface ProbeResult {
  ok: boolean
  error: string | null
}

export type CaptureMode = 'process-exclusion' | 'endpoint-loopback'

export interface StartOptions {
  mode: CaptureMode
  /** Executaveis proibidos, case-insensitive (ex.: 'discord.exe'). */
  excludedExecutables: string[]
  /** Raizes de arvores proibidas (ex.: o PID do proprio Zoi). */
  excludedRootPids: number[]
  sampleRate: number
  channels: number
  frameMs: number
}

export type PcmListener = (data: ArrayBuffer, timestampUs: number) => void
export type StatusListener = (state: string, detail: string) => void

/**
 * Ativacao real de Process Loopback (EXCLUDE no proprio PID) descartada em
 * seguida: e o teste de disponibilidade da API nesta maquina.
 */
export function probe(): ProbeResult

/** Nao implementado ate o Sprint 2: lanca `not-implemented`. */
export function start(options: StartOptions, onPcm: PcmListener, onStatus: StatusListener): number

/** Nao implementado ate o Sprint 2: lanca `not-implemented`. */
export function stop(handle: number): void
