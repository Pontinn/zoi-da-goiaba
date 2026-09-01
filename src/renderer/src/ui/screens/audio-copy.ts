/**
 * Textos dos avisos de captura de audio. Modulo sem NENHUM import de proposito:
 * o teste unitario (ambiente node) importa so isto, sem arrastar a tela.
 * Regra do projeto: pt-BR, SEM acento e SEM travessao (RNF-08).
 */
export const AUDIO_CAPTURE_COPY = {
  /** Estado C: a captura por aplicativo nunca vigorou (inclui Windows 10). RF-13. */
  fullLoopbackStart:
    'Atencao: esta transmissao esta enviando o som do sistema INTEIRO. Tudo que tocar no seu PC vai junto, inclusive a sua conversa no Discord.',
  /** Estado B: degradou em runtime. TEXTO IDENTICO ao de hoje (RF-16/AC-15). */
  degradedRuntime:
    'A captura de audio por aplicativo falhou; a transmissao segue com o som do sistema inteiro.',
  /** Falha total do motor. TEXTO IDENTICO ao de hoje (RF-16/AC-15). */
  failedRuntime: 'O audio da transmissao caiu; pare e transmita de novo para restaurar o som.',
  /** RF-19: um aplicativo especifico ficou de fora, por motivo detectavel. */
  appNotCaptured: (app: string): string =>
    `O som de ${app} nao esta indo na transmissao; os outros aplicativos seguem normalmente.`,
  /** Captura de audio pedida e nao obtida. TEXTO IDENTICO ao de hoje. */
  noAudio: 'Nao foi possivel capturar o audio do sistema; a transmissao segue so com video.'
} as const
