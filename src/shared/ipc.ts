// Contrato IPC do Electron (SPEC secao 5.B). Fonte unica importada por main,
// preload e renderer. Os nomes de canal sao VERBATIM da tabela da SPEC.

export const IPC = {
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  captureListSources: 'capture:list-sources',
  captureSelectSource: 'capture:select-source',
  appGetVersion: 'app:get-version',
  updateCheck: 'update:check',
  updateInstall: 'update:install',
  updateStatus: 'update:status',
  systemResume: 'system:resume'
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
}

export interface SettingsSetRequest {
  nickname: string
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

export type UpdateState =
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'none'
  | 'error'

export interface UpdateStatus {
  state: UpdateState
  version: string | null
  percent: number | null
}

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
  update: {
    check(): Promise<void>
    install(): Promise<void>
    /** Registra listener de `update:status`; retorna a funcao de descarte. */
    onStatus(listener: (status: UpdateStatus) => void): () => void
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
