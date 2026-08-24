// Sons de notificacao do app (RF-39/RNF-09).
//
// FONTE CANONICA dos arquivos: a pasta `audios\` na raiz do repo. Os `.m4a` aqui
// em `assets\audios\` sao uma COPIA versionada, importada como asset do Vite para
// entrar no bundle: zero download em runtime. Ao trocar um som, troque na raiz e
// copie de novo (a pasta `audios\originais` nunca e empacotada).
import { SOUND_IDS, type SoundId } from '@shared/sounds'
import enteredUrl from '../assets/audios/entrou.m4a'
import leftUrl from '../assets/audios/saiu.m4a'
import transmittingUrl from '../assets/audios/transmitindo.m4a'
import stoppedTransmittingUrl from '../assets/audios/parou-transmissao.m4a'
import removedUrl from '../assets/audios/desconectado.m4a'
import connectionErrorUrl from '../assets/audios/erro-conexao.m4a'
import reconnectedUrl from '../assets/audios/reconectado.m4a'

export { SOUND_IDS, type SoundId }

/** URLs dos assets ja resolvidas pelo bundler (uteis para diagnostico). */
export const SOUND_URLS: Record<SoundId, string> = {
  entered: enteredUrl,
  left: leftUrl,
  transmitting: transmittingUrl,
  stoppedTransmitting: stoppedTransmittingUrl,
  removed: removedUrl,
  connectionError: connectionErrorUrl,
  reconnected: reconnectedUrl
}

/**
 * Volume dos sons do app. Fixo em 1.0 por decisao da SPEC: e independente do
 * volume da transmissao assistida (que vive no elemento de video do player).
 */
const APP_SOUND_VOLUME = 1

const preloaded = new Map<SoundId, HTMLAudioElement>()

function elementFor(id: SoundId): HTMLAudioElement {
  const cached = preloaded.get(id)
  if (cached) return cached
  const audio = new Audio(SOUND_URLS[id])
  audio.preload = 'auto'
  audio.volume = APP_SOUND_VOLUME
  preloaded.set(id, audio)
  return audio
}

/** Pre-instancia os 7 sons para que o primeiro toque nao tenha latencia de I/O. */
export function preloadSounds(): void {
  for (const id of SOUND_IDS) {
    const audio = elementFor(id)
    audio.load()
  }
}

/**
 * Toca um som. Usa um clone por disparo para permitir sobreposicao (dois eventos
 * quase simultaneos nao cortam um ao outro) e para ser idempotente em re-chamadas.
 */
export function playSound(id: SoundId): void {
  try {
    const instance = elementFor(id).cloneNode(true) as HTMLAudioElement
    instance.volume = APP_SOUND_VOLUME
    void instance.play().catch((error: unknown) => {
      console.warn(`[sound] falha ao tocar "${id}":`, error)
    })
  } catch (error) {
    console.warn(`[sound] falha ao preparar "${id}":`, error)
  }
}
