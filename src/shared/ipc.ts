// Contrato IPC do Electron (SPEC secao 5.B). Fonte unica importada por main,
// preload e renderer. Os nomes de canal sao VERBATIM da tabela da SPEC.

export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  captureListSources: 'capture:list-sources',
  captureSelectSource: 'capture:select-source',
  appGetVersion: 'app:get-version',
  logsOpenFolder: 'logs:open-folder',
  updateCheck: 'update:check',
  updateInstall: 'update:install',
  updateStatus: 'update:status',
  systemResume: 'system:resume',
  audioExclusionStart: 'audio-exclusion:start',
  audioExclusionStop: 'audio-exclusion:stop',
  audioExclusionStatus: 'audio-exclusion:status',
  audioExclusionPort: 'audio-exclusion:port',
  pointerOverlayShow: 'pointer-overlay:show',
  pointerOverlayHide: 'pointer-overlay:hide',
  pointerOverlayFrame: 'pointer-overlay:frame',
  pointerOverlayRender: 'pointer-overlay:render'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

// ---------------------------------------------------------------------------
// settings
// ---------------------------------------------------------------------------

export interface AppSettings {
  /** null enquanto o usuario nunca escolheu um nickname (primeira execucao, RF-11). */
  nickname: string | null
  /** UUID v4 estavel por instalacao; chave da ban list (RF-08/RF-33). */
  installId: string
  /** Volume dos sons do app (0..1). Ausente ou invalido no disco vira o padrao. */
  soundVolume: number
  /** Escape "modo compatibilidade": transmite E recebe sempre VP8 (RF-12..RF-14). */
  forceVp8: boolean
}

/** Cada campo presente e aplicado; os ausentes ficam como estao. */
export interface SettingsSetRequest {
  nickname?: string
  soundVolume?: number
  forceVp8?: boolean
}

/** Limites de nickname (assumption A9 da SPEC): 1 a 24 chars apos trim. */
export const NICKNAME_MIN_LENGTH = 1
export const NICKNAME_MAX_LENGTH = 24

/** Codigos de erro devolvidos por `settings:set` quando o nickname e invalido. */
export type NicknameErrorCode = 'empty' | 'too_long'

// ---------------------------------------------------------------------------
// capture
// ---------------------------------------------------------------------------

export type CaptureSourceKind = 'screen' | 'window'

export interface CaptureSource {
  id: string
  name: string
  kind: CaptureSourceKind
  thumbnailDataUrl: string
  displayId: string | null
}

export interface CaptureListSourcesRequest {
  thumbnailWidth: number
}

export interface CaptureSelectSourceRequest {
  sourceId: string
  withAudio: boolean
}

/** Janela de validade da fonte armada por `capture:select-source`. */
export const CAPTURE_SELECTION_TTL_MS = 30_000

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

export type UpdateState = 'checking' | 'available' | 'downloading' | 'downloaded' | 'none' | 'error'

export interface UpdateStatus {
  state: UpdateState
  version: string | null
  percent: number | null
}

// ---------------------------------------------------------------------------
// audio-exclusion
// ---------------------------------------------------------------------------

export type AudioExclusionUnavailableReason =
  /** ZOI_DISABLE_AUDIO_EXCLUSION definida (dev/E2E). */
  | 'disabled-by-env'
  /** Build do Windows abaixo de 10.0.20348: sem WASAPI Process Loopback. */
  | 'os-unsupported'
  /** O require do addon nativo falhou (binario ausente ou toolchain faltando). */
  | 'addon-load-failed'
  /** O utilityProcess nao subiu. */
  | 'worker-spawn-failed'
  /** O probe ou a ativacao do WASAPI devolveu erro. */
  | 'activation-failed'

export type AudioExclusionStartResult =
  | { mode: 'process-exclusion'; sampleRate: 48000; channels: 2; captureId: string }
  | { mode: 'unavailable'; reason: AudioExclusionUnavailableReason }

export type AudioExclusionState =
  | 'active'
  | 'degraded-full-loopback'
  | 'failed'
  /**
   * Um aplicativo especifico foi visto pelo motor e NAO esta sendo capturado,
   * por um motivo que o sistema consegue detectar (RF-19). Nunca e emitido para
   * o motivo `arvore-proibida`, que e a exclusao PRETENDIDA (Discord e o proprio
   * Zoi): avisar sobre ele seria alarmar o usuario com o produto funcionando.
   */
  | 'app-not-captured'

export interface AudioExclusionStatus {
  state: AudioExclusionState
  /** Texto tecnico curto para log; a UI usa `state` e `app`. */
  detail: string | null
  /** Sessao de captura a que este status pertence (RF-08). Null antes de haver sessao. */
  captureId: string | null
  /** Basename do executavel; preenchido SO quando `state === 'app-not-captured'`. */
  app: string | null
}

/** Canal do `window.postMessage` que leva o MessagePort ao mundo principal. */
export const AUDIO_EXCLUSION_PORT_CHANNEL = 'zoi:audio-exclusion-port'

/** Cadencia e formato do PCM entregue pelo worker (contrato do SPEC 5.C). */
export const AUDIO_EXCLUSION_SAMPLE_RATE = 48000
export const AUDIO_EXCLUSION_CHANNELS = 2
export const AUDIO_EXCLUSION_FRAME_MS = 10

/**
 * Frame PCM de 10 ms no MessagePort worker -> renderer. `data` e float32
 * interleaved LR e vai por COPIA: o MessagePortMain do Electron so aceita
 * MessagePortMain na lista de transferencia, entao nao existe transferencia de
 * ArrayBuffer aqui (verificado no spike do Sprint 1).
 */
export interface AudioExclusionPcmMessage {
  type: 'pcm'
  timestampUs: number
  data: ArrayBuffer
}

// ---------------------------------------------------------------------------
// pointer-overlay
// ---------------------------------------------------------------------------

/** Um ponteiro ja resolvido para desenho: nickname e cor vem do renderer principal. */
export interface PointerOverlayPointer {
  peerId: string
  nickname: string
  /**
   * Cor de PREENCHIMENTO ja resolvida, no formato `hsl(H 100% L%)`. E o campo
   * `fill` de `PersonColor`, e nao o objeto inteiro: a janela de overlay nao tem
   * roster nem desenha avatar, entao o `soft` nao serve para nada la.
   */
  fill: string
  /** Fracao [0..1] da largura/altura do monitor compartilhado. */
  x: number
  y: number
  /** Parado ha mais de CURSOR_IDLE_MS: o overlay desenha esmaecido (RF-26). */
  idle: boolean
}

export interface PointerOverlayFrame {
  txId: string
  pointers: PointerOverlayPointer[]
}

export interface PointerOverlayShowRequest {
  /** `displayId` da fonte escolhida (`CaptureSource.displayId`). */
  displayId: string | null
}

export type PointerOverlayShowResult =
  | { ok: true }
  | { ok: false; reason: 'display-not-found' | 'content-protection-failed' | 'window-failed' }

/** Titulo fixo da janela de overlay; e por ele que o e2e a encontra. */
export const POINTER_OVERLAY_TITLE = 'zoi-pointer-overlay'

// ---------------------------------------------------------------------------
// Superficie exposta no renderer como `window.zoi`
// ---------------------------------------------------------------------------

export interface ZoiApi {
  settings: {
    get(): Promise<AppSettings>
    set(request: SettingsSetRequest): Promise<AppSettings>
  }
  capture: {
    listSources(request: CaptureListSourcesRequest): Promise<CaptureSource[]>
    selectSource(request: CaptureSelectSourceRequest): Promise<void>
  }
  app: {
    getVersion(): Promise<string>
  }
  logs: {
    /**
     * Abre a pasta `userData/logs` no explorador de arquivos. E por onde o
     * usuario pega o log do dia para mandar quando algo deu errado.
     */
    openFolder(): Promise<void>
  }
  update: {
    check(): Promise<void>
    install(): Promise<void>
    /** Registra listener de `update:status`; retorna a funcao de descarte. */
    onStatus(listener: (status: UpdateStatus) => void): () => void
  }
  audioExclusion: {
    /**
     * Arma a captura de audio com exclusao das arvores proibidas. Nunca lanca:
     * qualquer falha vira `{ mode: 'unavailable', reason }`.
     */
    start(): Promise<AudioExclusionStartResult>
    /** Idempotente: parar sem captura ativa e no-op. */
    stop(): Promise<void>
    /** Registra listener de `audio-exclusion:status`; retorna o descarte. */
    onStatus(listener: (status: AudioExclusionStatus) => void): () => void
  }
  pointerOverlay: {
    /** Sobe o overlay sobre o monitor da fonte. Nunca lanca: falha vira `{ ok: false }`. */
    show(request: PointerOverlayShowRequest): Promise<PointerOverlayShowResult>
    /** Derruba o overlay. Idempotente. */
    hide(): Promise<void>
    /** Entrega um frame agregado ao overlay. Fire and forget, sem resposta. */
    sendFrame(frame: PointerOverlayFrame): void
    /** SO a janela de overlay usa. Registra o listener; devolve o descarte. */
    onRender(listener: (frame: PointerOverlayFrame) => void): () => void
  }
  system: {
    /**
     * Maquina voltou de suspensao. O websocket da sinalizacao morre durante o
     * sono sem avisar o renderer: acordar dispara verificacao imediata da porta
     * da sala. Retorna a funcao de descarte.
     */
    onResume(listener: () => void): () => void
  }
}
