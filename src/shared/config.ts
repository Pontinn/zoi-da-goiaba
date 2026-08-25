// Constantes de protocolo e de temporizacao. Ponto UNICO de configuracao da
// sinalizacao (risco R1 da SPEC: trocar de servidor PeerJS mexe so aqui).

/** Prefixo do id de sala no PeerJS (assumption A2: hifen, o charset nao aceita ':'). */
export const ROOM_ID_PREFIX = 'zoidagoiaba-'

/** Janela de reconexao de um par antes da remocao definitiva (RF-40/RF-48). */
export const RECONNECT_WINDOW_MS = 15_000

/** Heartbeat PING/PONG por par. */
export const HEARTBEAT_INTERVAL_MS = 2_000
export const HEARTBEAT_TIMEOUT_MS = 6_000

/** Tempo maximo para um par NOVO fechar a conexao de mesh (RF-41). */
export const MESH_CONNECT_TIMEOUT_MS = 20_000

/**
 * Nova tentativa de dial enquanto o par novo ainda nao fechou o mesh. Serve para
 * nao depender de uma unica oferta e, principalmente, para ouvir do servidor de
 * sinalizacao que o par ja nao existe (`peer-unavailable`).
 */
export const MESH_CONNECT_RETRY_INTERVAL_MS = 5_000

/** Re-dial durante a janela de reconexao. */
export const RECONNECT_REDIAL_INTERVAL_MS = 3_000

/** Retentativa em background para par marcado como inalcancavel (secao 2.7). */
export const UNREACHABLE_RETRY_INTERVAL_MS = 10_000

/** HELLO que chega antes do ROSTER_UPDATE fica em quarentena por este tempo. */
export const HELLO_QUARANTINE_MS = 5_000

/** Re-emissao do primeiro ROSTER_UPDATE do dono eleito (secao 2.7). */
export const OWNER_REBROADCAST_INTERVAL_MS = 5_000
export const OWNER_REBROADCAST_COUNT = 3

/** Registro do door peer pelo novo dono, com backoff (risco R5). */
export const DOOR_REGISTER_RETRY_WINDOW_MS = 10_000
export const DOOR_REGISTER_RETRY_INTERVAL_MS = 800

/** Ingresso: tempo de espera da resposta do dono e retry de "sala nao encontrada". */
export const JOIN_RESPONSE_TIMEOUT_MS = 10_000
export const JOIN_PEER_UNAVAILABLE_RETRY_WINDOW_MS = 10_000
export const JOIN_PEER_UNAVAILABLE_RETRY_INTERVAL_MS = 1_000
/** Segunda (e ultima) chance quando o door abriu mas o dono nao respondeu. */
export const JOIN_TIMEOUT_RETRIES = 1

/** Candidato que abre o canal de admissao e nao envia JOIN_REQUEST. */
export const ADMISSION_IDLE_TIMEOUT_MS = 10_000

/** Broadcast de qualidade (RF-38) e tempo ate a exibicao virar "sem dados". */
export const QUALITY_UPDATE_INTERVAL_MS = 3_000
export const QUALITY_STALE_MS = 10_000

/** Thresholds de qualidade (assumption A5, calibraveis). */
export const QUALITY_GOOD_MAX_RTT_MS = 150
export const QUALITY_BAD_MIN_RTT_MS = 400
export const QUALITY_BAD_MIN_PACKET_LOSS = 0.05

/** Espera pelo TX_START correspondente ao metadata de uma chamada de midia. */
export const CALL_METADATA_WAIT_MS = 5_000

/** Debounce do WATCHING_UPDATE ao alternar rapidamente entre streams. */
export const WATCHING_UPDATE_DEBOUNCE_MS = 300

/** Limites de tamanho da sala (RNF-03 / RF-02). */
export const ROOM_MIN_LIMIT = 2
export const ROOM_MAX_LIMIT = 8
export const ROOM_DEFAULT_LIMIT = 6

/** Limites do codigo de sala personalizado (RF-46). */
export const ROOM_CODE_MIN_LENGTH = 3
export const ROOM_CODE_MAX_LENGTH = 32

/**
 * Configuracao do cliente PeerJS. Vazio = servidor publico (0.peerjs.com) com o
 * STUN publico do Google. Sem TURN por decisao explicita (RF-42).
 */
export const PEER_OPTIONS = {
  debug: 1,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }
} as const
