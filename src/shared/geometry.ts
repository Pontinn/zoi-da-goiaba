// Area REAL do video dentro de um elemento com `object-fit: contain` (RF-19).
//
// Modulo PURO: sem DOM, sem Electron, sem React. Por isso ele mora em
// `src/shared` e `tests/unit` consegue importa-lo sem tocar em modulo do main.
//
// A matematica e a do `object-fit: contain`: o conteudo e escalado pelo MENOR
// dos dois fatores e centralizado, e o que sobra vira faixa preta (letterbox em
// cima e embaixo, ou pillarbox nas laterais). Uma posicao de cursor precisa ser
// fracao do CONTEUDO, nunca da caixa, senao dois espectadores com janelas de
// tamanhos diferentes apontariam para lugares diferentes.
//
// Regra de medicao para quem chama, do lado do espectador: medir o `<video>`
// (`.z-player__video`) e NUNCA o container `.z-player`. O container tem
// `border: 1px solid var(--border)` que SOME em `.z-player--fullscreen`, o que
// introduziria um erro sistematico de 1 a 2 px que ainda por cima muda entre os
// dois modos.

export interface ContentRect {
  /** Deslocamento do conteudo dentro da caixa, em px. */
  left: number
  top: number
  /** Tamanho do conteudo real (sem as barras pretas), em px. */
  width: number
  height: number
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/**
 * Retangulo do conteudo real dentro de um elemento com `object-fit: contain`
 * (RF-19). Devolve `null` quando qualquer dimensao e invalida (video ainda sem
 * metadata, elemento com tamanho zero): quem chama trata `null` como
 * "nao ha area valida agora" e nao gera posicao.
 */
export function contentRectOf(
  boxWidth: number,
  boxHeight: number,
  videoWidth: number,
  videoHeight: number
): ContentRect | null {
  if (
    !isPositiveFinite(boxWidth) ||
    !isPositiveFinite(boxHeight) ||
    !isPositiveFinite(videoWidth) ||
    !isPositiveFinite(videoHeight)
  ) {
    return null
  }
  const scale = Math.min(boxWidth / videoWidth, boxHeight / videoHeight)
  const width = videoWidth * scale
  const height = videoHeight * scale
  return {
    left: (boxWidth - width) / 2,
    top: (boxHeight - height) / 2,
    width,
    height
  }
}

/**
 * Converte um ponto em coordenadas do ELEMENTO para fracao [0..1] do conteudo.
 * Devolve `null` quando o ponto cai FORA do conteudo (barra preta do letterbox,
 * RF-17): nunca clampa, porque clampar prenderia o ponteiro na borda.
 */
export function normalizedPointIn(
  rect: ContentRect,
  offsetX: number,
  offsetY: number
): { x: number; y: number } | null {
  if (!Number.isFinite(offsetX) || !Number.isFinite(offsetY)) return null
  if (!isPositiveFinite(rect.width) || !isPositiveFinite(rect.height)) return null
  const x = (offsetX - rect.left) / rect.width
  const y = (offsetY - rect.top) / rect.height
  if (x < 0 || x > 1 || y < 0 || y > 1) return null
  return { x, y }
}
