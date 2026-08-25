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

/**
 * Sobe o motor de captura e devolve o handle da sessao.
 *
 * Em `process-exclusion` o mix e composto por capturas INCLUDE ancoradas no
 * PROPRIO PID de cada sessao de audio permitida; nenhuma arvore proibida ganha
 * captura. Em `endpoint-loopback` as listas de exclusao sao IGNORADAS (loopback
 * classico do endpoint padrao, usado como rede de seguranca da degradacao).
 *
 * `onPcm` recebe um frame a cada `frameMs`, SEMPRE (silencio incluido), com
 * float32 interleaved e `timestampUs` acumulado por contagem de amostras.
 * `onStatus` recebe `'active'` ou `'failed'` com um detalhe tecnico curto.
 */
export function start(options: StartOptions, onPcm: PcmListener, onStatus: StatusListener): number

/** Derruba a captura do handle. Idempotente: handle desconhecido e no-op. */
export function stop(handle: number): void
