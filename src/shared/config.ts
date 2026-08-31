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

/**
 * Corrida de dial simultaneo no mesh: depois que a PRIMEIRA conexao de um par
 * abre, a outra continua viva por esta janela. Se as duas abrirem dentro dela, o
 * desempate lexicografico decide (os dois lados chegam ao mesmo resultado); se
 * so uma abrir, ela fica e a outra e fechada no fim da janela.
 */
export const MESH_RACE_GRACE_MS = 1_500

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

/**
 * Saude da sinalizacao (SPEC secao 2.7, item 1). O servidor publico do PeerJS
 * derruba websockets ociosos e a maquina pode dormir: sem verificacao periodica,
 * um door peer que perdeu o registro fica invisivel para sempre enquanto a sala
 * local continua com cara de saudavel.
 */
export const SIGNALING_HEALTH_CHECK_INTERVAL_MS = 30_000
/** Espera pelo `open` depois de um `peer.reconnect()`. */
export const SIGNALING_RECONNECT_TIMEOUT_MS = 8_000
/** Teto do backoff do ciclo de reconexao da sinalizacao. */
export const SIGNALING_RECONNECT_MAX_BACKOFF_MS = 15_000
/** Teto do backoff entre tentativas de recuperacao do door peer. */
export const DOOR_RECOVERY_MAX_BACKOFF_MS = 15_000
/** Tempo de porta fechada a partir do qual o dono precisa ser avisado. */
export const DOOR_RECOVERY_WARN_AFTER_MS = 20_000

/** Ingresso: tempo de espera da resposta do dono e retry de "sala nao encontrada". */
export const JOIN_RESPONSE_TIMEOUT_MS = 10_000
export const JOIN_PEER_UNAVAILABLE_RETRY_WINDOW_MS = 10_000
export const JOIN_PEER_UNAVAILABLE_RETRY_INTERVAL_MS = 1_000
/** Segunda (e ultima) chance quando o door abriu mas o dono nao respondeu. */
export const JOIN_TIMEOUT_RETRIES = 1

/** Candidato que abre o canal de admissao e nao envia JOIN_REQUEST. */
export const ADMISSION_IDLE_TIMEOUT_MS = 10_000

/**
 * Fallback de direcao na admissao: se o canal aberto PELO candidato nao subir
 * neste prazo, o dono disca de volta a partir do door peer. Precisa ser bem
 * menor que JOIN_RESPONSE_TIMEOUT_MS para o canal reverso ainda dar tempo de
 * completar o ingresso da tentativa em andamento.
 */
export const DOOR_DIALBACK_AFTER_MS = 4_000

/** Broadcast de qualidade (RF-38) e tempo ate a exibicao virar "sem dados". */
export const QUALITY_UPDATE_INTERVAL_MS = 3_000
export const QUALITY_STALE_MS = 10_000

/** Thresholds de qualidade (assumption A5, calibraveis). */
export const QUALITY_GOOD_MAX_RTT_MS = 150
export const QUALITY_BAD_MIN_RTT_MS = 400
export const QUALITY_BAD_MIN_PACKET_LOSS = 0.05

/**
 * Escolha e rebaixamento de codec de video. As unidades em "SAMPLES" sao
 * amostras do tick de 3s do monitor de qualidade (QUALITY_UPDATE_INTERVAL_MS),
 * que e o unico relogio usado pela feature (RNF-07: nenhum coletor novo).
 */
/** Amostras ignoradas depois de comecar ou trocar de codec: o arranque do encoder gera 'cpu' transitorio. */
export const CODEC_CPU_WARMUP_SAMPLES = 3
/** Amostras CONSECUTIVAS de 'cpu' que configuram saturacao persistente (12s). */
export const CODEC_CPU_PERSISTENT_SAMPLES = 4
/** Teto de rebaixamentos por CPU numa mesma transmissao (evita cadeia de redials). */
export const CODEC_MAX_DOWNGRADES = 2
/** Cadencia do log periodico de codec por conexao (5 amostras = 15s). */
export const CODEC_LOG_EVERY_N_SAMPLES = 5
/**
 * Carencia POR MEMBRO ate um par que nunca anunciou passar a contar como
 * ['VP8']. Dobro do tick de 3s: cobre o tempo de o mesh dele abrir mais um
 * QUALITY_UPDATE.
 */
export const CODEC_MEMBER_GRACE_MS = 6_000

/** Espera pelo TX_START correspondente ao metadata de uma chamada de midia. */
export const CALL_METADATA_WAIT_MS = 5_000

/**
 * Diagnostico de ICE. A `peerConnection` de um objeto do PeerJS pode demorar
 * alguns ticks para existir, entao a observacao espera por ela antes de desistir
 * (40 x 250ms = 10s, a mesma ordem de grandeza do resto do ingresso).
 */
export const ICE_ATTACH_RETRY_INTERVAL_MS = 250
export const ICE_ATTACH_MAX_ATTEMPTS = 40
/** `disconnected` so vira relatorio de falha se persistir por este tempo. */
export const ICE_DISCONNECTED_REPORT_AFTER_MS = 5_000

/**
 * Tempo ate declarar que a midia recebida NAO chegou. O evento `stream` do
 * PeerJS dispara ainda na negociacao (SDP), muito antes do primeiro pacote RTP:
 * sem este prazo, um ICE que nunca fecha vira tela preta silenciosa.
 */
export const MEDIA_STALL_TIMEOUT_MS = 10_000

/**
 * Espera do PRIMEIRO quadro no player, do lado de quem assiste (RF-01/RF-05).
 *
 * `FIRST_FRAME_GRACE_MS`: carencia antes de mostrar qualquer aviso. Abertura
 * saudavel entrega quadro bem antes disso, entao esperar 1,5s evita um aviso que
 * pisca e some no caminho feliz.
 *
 * `FIRST_FRAME_ESCALATE_MS`: tempo EFETIVO total (descontadas as pausas) ate o
 * segundo estagio do aviso. Deliberadamente maior que `MEDIA_STALL_TIMEOUT_MS`:
 * uma falha tecnica de midia vira o overlay de falha antes disso; quem chega aqui
 * e quem nao falhou, so ainda nao pintou nenhum quadro.
 *
 * `WAITING_MIN_VISIBLE_MS`: tempo minimo que o aviso, uma vez VISIVEL, permanece
 * na tela antes de a saida comecar. Sem ele, um quadro chegando em ~1,6s faria o
 * aviso aparecer e sumir em ~100ms, um flash que le como defeito da interface.
 * Nunca atrasa o video: o que espera e apenas o veu escuro do overlay.
 */
export const FIRST_FRAME_GRACE_MS = 1_500
export const FIRST_FRAME_ESCALATE_MS = 12_000
export const WAITING_MIN_VISIBLE_MS = 300

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

/**
 * Ponteiros dos espectadores (feature viewer-cursors). Nenhuma destas constantes
 * vai para disco: a feature inteira e efemera (RF-03).
 *
 * `CURSOR_SEND_INTERVAL_MS`: intervalo do flush de envio de posicao. 40 ms da 25
 * envios por segundo, dentro da faixa de 20 a 30 de RF-32 e abaixo do teto.
 *
 * `CURSOR_IDLE_MS`: tempo parado ate o ponteiro esmaecer no lado de quem desenha
 * (RF-26). Tambem e o piso de seguranca contra ponteiro preso: nenhum sobrevive
 * mais de 5 s sem posicao nova.
 *
 * `CURSOR_RECEIVE_MIN_GAP_MS`: piso de intervalo aceito POR PEER no recebimento.
 * 20 ms aceita ate 50 por segundo, o dobro da cadencia nominal, o que tolera
 * jitter de rede sem aceitar enxurrada de um cliente adulterado.
 *
 * `POINTER_OVERLAY_FRAME_MS`: intervalo do frame agregado, tick UNICO do
 * CursorHub. 33 ms da aproximadamente 30 frames por segundo, e o custo passa a
 * ser independente do numero de espectadores.
 *
 * `POINTER_LOG_INTERVAL_MS`: janela minima entre duas linhas de log de descarte
 * por peer. Sem isso, uma mensagem por descarte encheria o log do dia a 25 Hz.
 */
export const CURSOR_SEND_INTERVAL_MS = 40
export const CURSOR_IDLE_MS = 5_000
export const CURSOR_RECEIVE_MIN_GAP_MS = 20
export const POINTER_OVERLAY_FRAME_MS = 33
export const POINTER_LOG_INTERVAL_MS = 10_000

/**
 * Diagnostico do caminho de audio (feature audio-quality).
 *
 * `AUDIO_LOG_WINDOW_MS`: janela minima, em milissegundos, entre duas linhas de
 * log de um MESMO ponto instrumentado. 10 s foi escolhido pelo calculo de pior
 * caso da SPEC: sete pontos disparando sem parar por 4 horas dao cerca de 8 200
 * linhas (~1,15 MB), bem abaixo do teto de 5 MB por dia do file-logger, cujo
 * estouro silenciaria o log do APP INTEIRO. Deliberadamente NAO reusa o
 * `POINTER_LOG_INTERVAL_MS`: sao dominios diferentes, e amarrar os dois no mesmo
 * numero faria mexer num quebrar o outro em silencio.
 *
 * `AUDIO_FADE_MS`: duracao, em milissegundos, da rampa de entrada e de saida do
 * silencio no lado do renderer. 1 ms e um decimo do frame de 10 ms (nunca soa
 * como corte de volume) e uma ordem de grandeza acima do periodo de amostragem,
 * o que espalha o transiente por 48 amostras em vez de concentra-lo em uma. O
 * motor nativo carrega a propria copia deste numero em `kFadeMs` (mixer.cc):
 * C++ nao importa TypeScript, e gerar um cabecalho para UM numero seria
 * maquinaria maior que o problema.
 *
 * `AUDIO_MAX_SKIP_MS`: teto de quanto o relogio da track pode avancar de uma vez
 * para cobrir frames descartados. Sem teto, uma rajada de mil descartes daria um
 * salto unico de 10 segundos, muito alem do jitter que a track ja sofre. Acima
 * do teto o relogio avanca 200 ms e o resto do buraco e absorvido (a linha do
 * tempo comprime, como antes desta feature); a magnitude REAL nunca se perde,
 * porque a linha `[audio-drop]` carrega a contagem verdadeira de descartes.
 */
export const AUDIO_LOG_WINDOW_MS = 10_000
export const AUDIO_FADE_MS = 1
export const AUDIO_MAX_SKIP_MS = 200
